import {
  createAiClient,
  createIssueEngine,
  createReviewEngine,
  validateFixFiles,
} from "@revorbit/ai";
import { prisma } from "@revorbit/database";
import { createGithubApp } from "@revorbit/github";
import { extractMentionedPaths } from "@revorbit/github";
import { createLogger } from "@revorbit/logger";
import {
  createIssuesQueue,
  createIssuesWorker,
  createRedis,
  createReviewsQueue,
  createReviewsWorker,
} from "@revorbit/queue";
import fs from "node:fs";
import {
  formatReviewSummary,
  hasCapability,
  REVIEW_STATUS,
  resolveRepoPath,
} from "@revorbit/shared";
import type {
  AgentCapability,
  AnalyzeIssueRequest,
  GenerateFixRequest,
  IssueAnalysis,
  ReviewRequest,
  ReviewResult,
} from "@revorbit/shared";

import { env, redisConfig } from "./config/env.js";

const logger = createLogger({
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV === "development",
});

function getPrivateKeyFromFile(): string {
  if (!env.GITHUB_PRIVATE_KEY_PATH) {
    throw new Error(
      "Either GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH must be set",
    );
  }

  return fs.readFileSync(resolveRepoPath(env.GITHUB_PRIVATE_KEY_PATH), "utf8");
}

const github = createGithubApp({
  appId: env.GITHUB_APP_ID,
  privateKey: env.GITHUB_PRIVATE_KEY ?? getPrivateKeyFromFile(),
});

const aiClient = createAiClient({
  apiKey: env.AI_API_KEY,
  ...(env.AI_BASE_URL ? { baseUrl: env.AI_BASE_URL } : {}),
  ...(env.AI_MODEL ? { model: env.AI_MODEL } : {}),
});

const reviewEngine = createReviewEngine({
  aiClient,
  // A failed chunk must not discard findings from the chunks that succeeded,
  // so it is logged rather than thrown.
  onChunkError: (error, chunkIndex) => {
    logger.warn(
      {
        chunkIndex,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      "Review chunk failed; continuing with remaining chunks",
    );
  },
});

const issueEngine = createIssueEngine({ aiClient });

function assertCapability(
  autonomy: Parameters<typeof hasCapability>[0],
  capability: AgentCapability,
  context: Record<string, unknown>,
): boolean {
  if (hasCapability(autonomy, capability)) {
    return true;
  }

  logger.warn(
    { ...context, capability, autonomy },
    "autonomy.capability_denied",
  );

  return false;
}

function formatCommentBody(comment: ReviewResult["comments"][number]): string {
  const sections = [
    `**${comment.title}** (${comment.category}/${comment.severity})`,
    comment.body,
  ];

  if (comment.problemCode) {
    sections.push(`**Problem code:**\n\`\`\`\n${comment.problemCode}\n\`\`\``);
  }

  if (comment.fixedCode) {
    sections.push(`**Fix:**\n\`\`\`suggestion\n${comment.fixedCode}\n\`\`\``);
  }

  return sections.join("\n\n");
}

/**
 * Re-fetches the pull request and its files.
 *
 * Job payloads carry identifiers only, so the review always analyses current
 * state rather than whatever was queued.
 *
 * The fetched head SHA is also the one to publish under: GitHub resolves inline
 * positions against that commit's diff, so publishing under a stale SHA makes
 * every position unresolvable.
 */
async function loadReviewInput(data: ReviewRequest) {
  const { installationId, owner, name } = data.repository;

  const pullRequest = await github.getPullRequest(
    installationId,
    owner,
    name,
    data.pullRequest.number,
  );

  const files = await github.getPullRequestFiles(
    installationId,
    owner,
    name,
    data.pullRequest.number,
  );

  const changed = files.slice(0, data.maxFiles);

  // Context is advisory: a failure here must degrade the review to
  // diff-only analysis rather than fail it, so the diff remains the single
  // source of truth for what gets reported.
  const context = await loadRepositoryContext(
    { installationId, owner, name },
    // Read at the head commit so a file the PR adds can itself be a seed
    // without resolving against the base branch.
    pullRequest.headSha,
    changed.map((file) => file.filename),
  );

  return {
    pullRequest,
    // Guard against the review posting under a SHA that is not the one whose
    // files were just analysed.
    headSha: pullRequest.headSha,
    files: changed,
    context,
  };
}

/**
 * Fetches whole files the changed files depend on.
 *
 * Any failure is swallowed and logged. A repository context is an enhancement,
 * so losing it degrades the review instead of blocking it, and the caller must
 * never have to distinguish "no context" from "context lookup broke".
 */
async function loadRepositoryContext(
  repository: { installationId: number; owner: string; name: string },
  ref: string,
  seedPaths: string[],
) {
  try {
    return await github.getRepositoryContext(
      repository.installationId,
      repository.owner,
      repository.name,
      ref,
      seedPaths,
    );
  } catch (error) {
    logger.warn(
      {
        repository: `${repository.owner}/${repository.name}`,
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      "context_unavailable_continuing_diff_only",
    );

    return [];
  }
}

async function generateReview(
  data: ReviewRequest,
  files: Awaited<ReturnType<typeof loadReviewInput>>["files"],
  context: Awaited<ReturnType<typeof loadReviewInput>>["context"],
): Promise<ReviewResult> {
  return reviewEngine.generateReview(data.pullRequest, files, {
    model: data.model,
    maxTokens: data.configuration.maxTokens,
    configuration: data.configuration,
    context,
  });
}

/**
 * Publishes the review to GitHub and reports which findings could not be
 * anchored to a changed line.
 *
 * Returns an empty result without publishing when autonomy does not grant
 * `COMMENT`, so an `OBSERVE` repository is analysed and stored but never
 * written to.
 */
async function postReview(
  data: ReviewRequest,
  headSha: string,
  files: Awaited<ReturnType<typeof loadReviewInput>>["files"],
  result: ReviewResult,
): Promise<Set<number>> {
  // Autonomy is resolved from the configuration captured at enqueue time and
  // re-checked here, immediately before the write.
  if (
    !assertCapability(data.configuration.autonomy, "COMMENT", {
      reviewId: data.reviewId,
    })
  ) {
    logger.info(
      { reviewId: data.reviewId },
      "autonomy.observe_only_review_not_published",
    );

    // Nothing was published, so nothing is inline either.
    return new Set(result.comments.map((_, index) => index));
  }

  const comments = result.comments.map((comment, index) => ({
    index,
    path: comment.filePath,
    line: comment.line,
    body: formatCommentBody(comment),
  }));

  const published = await github.createReview(
    data.repository.installationId,
    data.repository.owner,
    data.repository.name,
    data.pullRequest.number,
    // The SHA whose files were analysed, not the one captured at enqueue time.
    headSha,
    formatReviewSummary(result.summary, comments.length),
    comments,
    files,
  );

  return new Set(
    published.unmapped
      .map((entry) => entry.index)
      .filter((index): index is number => index !== undefined),
  );
}

async function persistReview(
  data: ReviewRequest,
  result: ReviewResult,
  unmappedIndexes: Set<number>,
): Promise<void> {
  await prisma.$transaction([
    prisma.review.update({
      where: { id: data.reviewId },
      data: {
        status: REVIEW_STATUS.COMPLETED,
        summary: result.summary,
        // A partial review is recorded as partial rather than presented as if
        // it covered the whole pull request.
        partial: result.partial,
        partialReason: result.partialReason ?? null,
        chunksAnalyzed: result.chunksAnalyzed,
        chunksFailed: result.chunksFailed,
      },
    }),
    prisma.reviewComment.createMany({
      data: result.comments.map((comment, index) => ({
        reviewId: data.reviewId,
        filePath: comment.filePath,
        line: comment.line,
        category: comment.category,
        severity: comment.severity,
        title: comment.title,
        body: comment.body,
        problemCode: comment.problemCode,
        fixedCode: comment.fixedCode,
        // False when the finding had no anchorable diff line and was published
        // in the review body instead of as an inline comment.
        inline: !unmappedIndexes.has(index),
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
    data: { status: REVIEW_STATUS.FAILED },
  });
}

async function processReview(data: ReviewRequest): Promise<void> {
  await prisma.review.update({
    where: { id: data.reviewId },
    data: { status: REVIEW_STATUS.IN_PROGRESS },
  });

  try {
    const { headSha, files, context } = await loadReviewInput(data);
    const result = await generateReview(data, files, context);

    // Publishing happens first: it is the only step that can tell us which
    // findings failed to map to a changed line, and the rows need that to be
    // persisted accurately.
    const unmappedIndexes = await postReview(data, headSha, files, result);
    await persistReview(data, result, unmappedIndexes);

    logger.info(
      { reviewId: data.reviewId, partial: result.partial },
      "Review completed",
    );
  } catch (error) {
    await markFailed(
      data.reviewId,
      error instanceof Error ? error : new Error(String(error)),
    );
    throw error;
  }
}

// ── Issue intelligence ───────────────────────────────────────────────────

async function processIssueAnalysis(data: AnalyzeIssueRequest): Promise<void> {
  await prisma.issue.update({
    where: { id: data.issueId },
    data: { status: "IN_PROGRESS", errorMessage: null },
  });

  try {
    const issue = await github.getIssue(
      data.repository.installationId,
      data.repository.owner,
      data.repository.name,
      data.issue.number,
    );

    const baseBranch = await resolveBaseBranch(data);

    // Seeded from paths named in the report plus the stack manifests, so the
    // model sees the files the reporter is actually talking about rather than
    // whichever files happen to sort first.
    const context = await github.getRepositoryContext(
      data.repository.installationId,
      data.repository.owner,
      data.repository.name,
      baseBranch,
      extractMentionedPaths(`${issue.title}\n${issue.body ?? ""}`),
      {
        includeManifests: true,
        // A path named in the issue is the file triage needs to see, not a
        // file already on screen the way the review diff is.
        excludeSeeds: false,
        maxFiles: data.maxFiles,
        maxTotalBytes: 120_000,
      },
    );

    const analysis = await issueEngine.analyzeIssue(
      { number: issue.number, title: issue.title, body: issue.body },
      context,
      { model: data.model, maxTokens: data.configuration.maxTokens },
    );

    await prisma.issue.update({
      where: { id: data.issueId },
      data: {
        status: "COMPLETED",
        issueType: analysis.type,
        confidence: analysis.confidence,
        summary: analysis.summary,
        explanation: analysis.explanation,
        proposedApproach: analysis.proposedApproach,
        suspectedFiles: analysis.suspectedFiles,
      },
    });

    logger.info({ issueId: data.issueId }, "Issue analyzed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    logger.error(
      { issueId: data.issueId, errorMessage: message },
      "Issue analysis failed",
    );

    await prisma.issue.update({
      where: { id: data.issueId },
      data: { status: "FAILED", errorMessage: message.slice(0, 1000) },
    });

    throw error;
  }
}

async function resolveBaseBranch(
  data: AnalyzeIssueRequest | GenerateFixRequest,
): Promise<string> {
  const repository = await prisma.repository.findFirst({
    where: {
      installation: { githubId: data.repository.installationId },
      fullName: `${data.repository.owner}/${data.repository.name}`,
    },
    select: { defaultBranch: true },
  });

  return repository?.defaultBranch ?? "main";
}

async function processIssueFix(data: GenerateFixRequest): Promise<void> {
  const autonomy = data.configuration.autonomy;
  const context = { issueId: data.issueId };

  // Each write is gated separately, so a repository at SUGGEST can never
  // create a branch even if the route above were bypassed.
  for (const capability of [
    "CREATE_BRANCH",
    "COMMIT_CHANGES",
    "CREATE_PR",
  ] as const) {
    if (!assertCapability(autonomy, capability, context)) {
      logger.info(
        { ...context, capability },
        "fix_skipped_insufficient_autonomy",
      );
      return;
    }
  }

  // A second delivery of the same fix would fail creating the branch, and a
  // concurrent one would race on the same ref. Claiming the issue up front
  // makes the operation single-flight.
  const claimed = await prisma.issue.updateMany({
    where: { id: data.issueId, fixPullNumber: null },
    data: { status: "IN_PROGRESS", errorMessage: null },
  });

  if (claimed.count === 0) {
    logger.info({ ...context }, "fix_already_generated");
    return;
  }

  const issue = await github.getIssue(
    data.repository.installationId,
    data.repository.owner,
    data.repository.name,
    data.issue.number,
  );

  const baseBranch = await resolveBaseBranch(data);

  // A fix must see the files it is about to rewrite, so the analysis' suspect
  // list becomes the seed set rather than a whole-repository listing.
  const issueContext = await github.getRepositoryContext(
    data.repository.installationId,
    data.repository.owner,
    data.repository.name,
    baseBranch,
    data.analysis.suspectedFiles,
    { excludeSeeds: false, maxFiles: 20, maxTotalBytes: 120_000 },
  );

  const fix = await issueEngine.generateFix(
    { number: issue.number, title: issue.title, body: issue.body },
    data.analysis as IssueAnalysis,
    issueContext,
    { model: data.model, maxTokens: data.configuration.maxTokens },
  );

  // The model controls these paths, and the result may be merged by a human.
  // Anything unsafe is dropped here, before the branch is touched.
  const { accepted, rejected } = validateFixFiles(fix.files);

  if (rejected.length > 0) {
    logger.warn({ issueId: data.issueId, rejected }, "fix.paths_rejected");
  }

  if (accepted.length === 0) {
    throw new Error(
      `Issue fix produced no writable files (rejected: ${
        rejected.map((entry) => `${entry.path} — ${entry.reason}`).join("; ") ||
        "none returned"
      })`,
    );
  }

  const baseSha = await github.getRefSha(
    data.repository.installationId,
    data.repository.owner,
    data.repository.name,
    baseBranch,
  );

  const branch = `revorbit/fix-${issue.number}`;

  await github.createBranch(
    data.repository.installationId,
    data.repository.owner,
    data.repository.name,
    branch,
    baseSha,
  );

  await github.commitFiles(
    data.repository.installationId,
    data.repository.owner,
    data.repository.name,
    branch,
    fix.commitMessage,
    accepted,
  );

  // The pull request is opened as a draft so a human reviews the proposal
  // before it can merge.
  const pullNumber = await github.createPullRequest(
    data.repository.installationId,
    data.repository.owner,
    data.repository.name,
    {
      title: fix.summary,
      head: branch,
      base: baseBranch,
      body: [
        fix.explanation,
        "",
        `Proposed fix for #${issue.number}.`,
        "",
        "Opened by Revorbit as a draft for human review.",
      ].join("\n"),
      draft: true,
    },
  );

  await prisma.issue.update({
    where: { id: data.issueId },
    data: { fixBranch: branch, fixPullNumber: pullNumber },
  });

  logger.info(
    { issueId: data.issueId, branch, pullNumber },
    "Issue fix proposed",
  );
}

/**
 * Reviews left IN_PROGRESS by a crashed worker.
 *
 * Runs on a timer rather than only at boot: a worker that dies mid-job leaves
 * the row stuck until something else happens to restart a peer. The cutoff must
 * exceed a genuinely slow review.
 */
const STALE_REVIEW_TIMEOUT_MS = 30 * 60 * 1000;
const STALE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

async function recoverStaleReviews(): Promise<void> {
  const staleCutoff = new Date(Date.now() - STALE_REVIEW_TIMEOUT_MS);

  const [reviews, issues] = await Promise.all([
    prisma.review.updateMany({
      where: {
        status: REVIEW_STATUS.IN_PROGRESS,
        updatedAt: { lt: staleCutoff },
      },
      data: { status: REVIEW_STATUS.FAILED },
    }),
    prisma.issue.updateMany({
      where: { status: "IN_PROGRESS", updatedAt: { lt: staleCutoff } },
      data: { status: "FAILED" },
    }),
  ]);

  if (reviews.count > 0 || issues.count > 0) {
    logger.info(
      { reviews: reviews.count, issues: issues.count },
      "Marked stale work as failed",
    );
  }
}

async function main() {
  const connection = createRedis(redisConfig);

  await recoverStaleReviews();

  const staleSweep = setInterval(() => {
    recoverStaleReviews().catch((error) => {
      logger.error(error, "Stale review sweep failed");
    });
  }, STALE_SWEEP_INTERVAL_MS);

  // Keeps producers (Queue instances) referenced so BullMQ can close cleanly.
  const reviewsProducer = createReviewsQueue(connection);
  const issuesProducer = createIssuesQueue(connection);

  const reviewWorker = createReviewsWorker({
    connection,
    processor: processReview,
    concurrency: env.WORKER_CONCURRENCY,
  });

  const issueWorker = createIssuesWorker({
    connection,
    onAnalyze: processIssueAnalysis,
    onGenerateFix: processIssueFix,
    concurrency: env.WORKER_CONCURRENCY,
  });

  for (const worker of [reviewWorker, issueWorker]) {
    if (!worker) continue;

    worker.on("completed", (job) => {
      logger.info({ jobId: job.id, name: job.name }, "Job completed");
    });

    worker.on("failed", (job, error) => {
      logger.error(
        { jobId: job?.id, name: job?.name, errorMessage: error.message },
        "Job failed",
      );
    });
  }

  /**
   * Without this, SIGTERM (which Docker and most orchestrators send on
   * deploy/restart) kills the process mid-review, leaving the row IN_PROGRESS
   * and the BullMQ job locked until its lock expires.
   */
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    logger.info({ signal }, "Shutting down worker");

    clearInterval(staleSweep);

    // Stops accepting new jobs and waits for the in-flight ones to finish.
    await Promise.all([
      reviewWorker.close(),
      issueWorker?.close() ?? Promise.resolve(),
    ]);
    await reviewsProducer.queue.close();
    await issuesProducer.queue.close();
    await connection.quit();
    await prisma.$disconnect();

    process.exit(0);
  };

  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.on(signal, () => {
      void shutdown(signal);
    });
  }

  logger.info(
    { concurrency: env.WORKER_CONCURRENCY },
    "Review and issue workers started",
  );
}

main().catch((error) => {
  logger.error(error, "Worker failed to start");
  process.exit(1);
});
