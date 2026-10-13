import type {
  ChangedFile,
  RepositoryContextFile,
  ReviewConfiguration,
  ReviewResult,
} from "@revorbit/shared";

import type { AiClient } from "./client.js";
import { chunkFiles } from "./chunker.js";
import {
  capComments,
  filterCommentsToSentFiles,
  parseReviewResponse,
} from "./parser.js";
import {
  buildReviewPrompt,
  buildSystemPrompt,
  clampFile,
  MAX_PROMPT_CHARS,
} from "./prompts.js";

export interface ReviewEngineOptions {
  aiClient: AiClient;
  /** Maximum chunks reviewed in parallel. */
  concurrency?: number;
  /** Called when a single chunk fails but the review as a whole can continue. */
  onChunkError?: (error: unknown, chunkIndex: number) => void;
}

export interface ReviewRequestOptions {
  model?: string;
  maxTokens?: number;
  configuration?: ReviewConfiguration;
  signal?: AbortSignal;
  /**
   * Whole files the change depends on, fetched from the repository.
   *
   * Context is attached to every chunk: a file in chunk 3 may well call into
   * chunk 1, and the model cannot reason about the contract it is breaking
   * without seeing the other side of it.
   */
  context?: RepositoryContextFile[];
}

const DEFAULT_CONCURRENCY = 3;

export function createReviewEngine({
  aiClient,
  concurrency = DEFAULT_CONCURRENCY,
  onChunkError,
}: ReviewEngineOptions) {
  /**
   * Runs `worker` over `items` with a bounded number in flight. `Promise.all`
   * over every chunk would let one large pull request fan out unbounded
   * concurrent provider calls.
   */
  async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;

    const runners = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (cursor < items.length) {
          const index = cursor;
          cursor += 1;
          const item = items[index] as T;
          results[index] = await worker(item, index);
        }
      },
    );

    await Promise.all(runners);

    return results;
  }

  async function generateReview(
    pullRequest: { number: number; title: string; headSha: string },
    files: ChangedFile[],
    options: ReviewRequestOptions = {},
  ): Promise<ReviewResult> {
    const configuration = options.configuration;
    const systemPrompt = buildSystemPrompt(configuration);

    // Clamp before chunking so an oversized file is measured at its real size.
    const safeFiles = files.map((file) => clampFile(file, MAX_PROMPT_CHARS));
    const chunks = chunkFiles(safeFiles);

    const failures: string[] = [];

    const settled = await mapWithConcurrency(
      chunks,
      concurrency,
      async (chunk, index) => {
        const prompt = buildReviewPrompt(
          pullRequest,
          chunk,
          options.context ?? [],
        );

        try {
          const response = await aiClient.complete(systemPrompt, prompt, {
            ...(options.model ? { model: options.model } : {}),
            ...(options.maxTokens ? { maxTokens: options.maxTokens } : {}),
            ...(options.signal ? { signal: options.signal } : {}),
          });

          const parsed = parseReviewResponse(response);

          return {
            summary: parsed.summary,
            comments: filterCommentsToSentFiles(
              parsed.comments,
              chunk.map((file) => file.filename),
            ),
            failed: false as const,
          };
        } catch (error) {
          // One malformed or failed chunk should not discard the findings from
          // the chunks that succeeded, but the loss is recorded so the review
          // is never presented as if it covered the whole pull request.
          failures.push(error instanceof Error ? error.message : String(error));
          onChunkError?.(error, index);

          return { summary: "", comments: [], failed: true as const };
        }
      },
    );

    const partial = failures.length > 0;

    const summaryParts = settled
      .map((result) => result.summary.trim())
      .filter(Boolean);

    if (partial) {
      summaryParts.push(
        `**Partial review.** ${failures.length} of ${chunks.length} diff chunk(s) could not be analysed, so this review does not cover the entire pull request.`,
      );
    }

    const summary = summaryParts.length
      ? summaryParts.join("\n\n")
      : "No review summary was produced.";

    const comments = capComments(
      settled
        .flatMap((result) => result.comments)
        .map((comment) => ({
          filePath: comment.filePath,
          line: comment.line,
          category: comment.category,
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
      partial,
      ...(partial
        ? {
            partialReason: `${failures.length} of ${chunks.length} diff chunk(s) failed: ${failures.slice(0, 3).join("; ")}`,
          }
        : {}),
      chunksAnalyzed: settled.length - failures.length,
      chunksFailed: failures.length,
    };
  }

  return {
    generateReview,
  };
}

export type ReviewEngine = ReturnType<typeof createReviewEngine>;
