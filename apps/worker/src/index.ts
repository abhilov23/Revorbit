import { createAiClient, createReviewEngine } from "@revorbit/ai";
import { prisma } from "@revorbit/database";
import { createGithubApp } from "@revorbit/github";
import { createLogger } from "@revorbit/logger";
import { createRedis, createReviewsWorker } from "@revorbit/queue";
import fs from "node:fs";
import path from "node:path";
import {
  formatReviewSummary,
  REVIEW_STATUS,
  type ReviewRequest,
  type ReviewResult,
} from "@revorbit/shared";

import { env, redisConfig } from "./config/env.js";

const logger = createLogger({
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === "development",
});

const github = createGithubApp({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY ?? getPrivateKeyFromFile(),
});

function getPrivateKeyFromFile(): string {
  if (!env.GITHUB_PRIVATE_KEY_PATH) {
    throw new Error(
      "Either GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH must be set",
    );
  }

  return fs.readFileSync(
    path.resolve(process.cwd(), env.GITHUB_PRIVATE_KEY_PATH),
    "utf8",
  );
}

const reviewEngine = createReviewEngine({
  aiClient: createAiClient({
    apiKey: env.AI_API_KEY,
    ...(env.AI_BASE_URL ? { baseUrl: env.AI_BASE_URL } : {}),
    ...(env.AI_MODEL ? { model: env.AI_MODEL } : {}),
  }),
});

async function generateReview(
  data: ReviewRequest,
): Promise<ReviewResult> {
  logger.info(
    { reviewId: data.reviewId, model: data.model },
    "Generating AI review",
  );

  return reviewEngine.generateReview(data.pullRequest, data.files, {
    model: data.model,
  });
}

function formatCommentBody(comment: ReviewResult["comments"][number]): string {
  const sections = [comment.body];

  if (comment.problemCode) {
    sections.push(`**Problem code:**\n\`\`\`\n${comment.problemCode}\n\`\`\``);
  }

  if (comment.fixedCode) {
    sections.push(`**Fix:**\n\`\`\`suggestion\n${comment.fixedCode}\n\`\`\``);
  }

  return sections.join("\n\n");
}

async function postReview(
  data: ReviewRequest,
  result: ReviewResult,
): Promise<void> {
  const comments = result.comments.map((comment) => ({
    path: comment.filePath,
    line: comment.line,
    body: formatCommentBody(comment),
  }));

  await github.createReview(
    data.repository.installationId,
    data.repository.owner,
    data.repository.name,
    data.pullRequest.number,
    data.pullRequest.headSha,
    formatReviewSummary(result.summary, comments.length),
    comments,
  );
}

async function persistReview(
  data: ReviewRequest,
  result: ReviewResult,
): Promise<void> {
  await prisma.$transaction([
    prisma.review.update({
      where: { id: data.reviewId },
      data: {
        status: REVIEW_STATUS.COMPLETED,
        summary: result.summary,
      },
    }),
    prisma.reviewComment.createMany({
      data: result.comments.map((comment) => ({
        reviewId: data.reviewId,
        filePath: comment.filePath,
        line: comment.line,
        severity: comment.severity,
        title: comment.title,
        body: comment.body,
        problemCode: comment.problemCode,
        fixedCode: comment.fixedCode,
      })),
    }),
  ]);
}

async function markFailed(reviewId: string, error: Error): Promise<void> {
  logger.error(
    { reviewId, errorMessage: error.message, errorStack: error.stack },
    "Review failed",
  );

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: REVIEW_STATUS.FAILED,
    },
  });
}

async function processReview(data: ReviewRequest): Promise<void> {
  await prisma.review.update({
    where: { id: data.reviewId },
    data: { status: REVIEW_STATUS.IN_PROGRESS },
  });

  try {
    const result = await generateReview(data);
    await postReview(data, result);
    await persistReview(data, result);
    logger.info({ reviewId: data.reviewId }, "Review completed");
  } catch (error) {
    await markFailed(data.reviewId, error as Error);
    throw error;
  }
}

async function recoverStaleReviews(): Promise<void> {
  const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);

  const result = await prisma.review.updateMany({
    where: {
      status: REVIEW_STATUS.IN_PROGRESS,
      updatedAt: { lt: staleCutoff },
    },
    data: { status: REVIEW_STATUS.FAILED },
  });

  if (result.count > 0) {
    logger.info({ count: result.count }, "Marked stale reviews as failed");
  }
}

async function main() {
  const connection = createRedis(redisConfig);

  await recoverStaleReviews();

  const worker = createReviewsWorker({
    connection,
    processor: processReview,
  });

  worker.on("completed", (job) => {
    logger.info({ reviewId: job.data.reviewId }, "Job completed");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      {
        reviewId: job?.data.reviewId,
        errorMessage: error.message,
        errorStack: error.stack,
      },
      "Job failed",
    );
  });

  logger.info("Review worker started");
}

main().catch((error) => {
  logger.error(error, "Worker failed to start");
  process.exit(1);
});
