import type { ChangedFile, ReviewPullRequest, ReviewResult } from "@revorbit/shared";

import type { AiClient } from "./client.js";
import { chunkFiles } from "./chunker.js";
import { parseReviewResponse } from "./parser.js";
import { buildReviewPrompt, REVIEW_SYSTEM_PROMPT } from "./prompts.js";

export interface ReviewEngineOptions {
  aiClient: AiClient;
}

export interface ReviewRequestOptions {
  model?: string;
}

export function createReviewEngine({ aiClient }: ReviewEngineOptions) {
  async function generateReview(
    pullRequest: ReviewPullRequest,
    files: ChangedFile[],
    options: ReviewRequestOptions = {},
  ): Promise<ReviewResult> {
    const chunks = chunkFiles(files);

    const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
        const prompt = buildReviewPrompt(pullRequest, chunk);
        const response = await aiClient.complete(
          REVIEW_SYSTEM_PROMPT,
          prompt,
          options,
        );
        return parseReviewResponse(response);
      }),
    );

    const summary = chunkResults.map((r) => r.summary).join("\n\n");
    const comments: ReviewResult["comments"] = chunkResults.flatMap((r) =>
      r.comments.map((comment) => ({
        filePath: comment.filePath,
        line: comment.line,
        severity: comment.severity,
        title: comment.title,
        body: comment.body,
        problemCode: comment.problemCode,
        fixedCode: comment.fixedCode,
      })),
    );

    return {
      summary,
      comments,
    };
  }

  return {
    generateReview,
  };
}

export type ReviewEngine = ReturnType<typeof createReviewEngine>;
