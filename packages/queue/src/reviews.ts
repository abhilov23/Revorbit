import { Queue, Worker } from "bullmq";
import {
  ISSUE_JOB,
  QUEUES,
  REVIEW_JOB,
  type AnalyzeIssueRequest,
  type GenerateFixRequest,
  type ReviewRequest,
} from "@revorbit/shared";

import type { Redis } from "./redis.js";

/**
 * Job options shared by every queue.
 *
 * `jobId` is derived from the domain identifier so a duplicate enqueue is a
 * no-op in BullMQ rather than a second job that pays for the same AI calls.
 */
function jobOptions(jobId: string) {
  return {
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 5_000,
    },
    jobId,
    removeOnComplete: 1000,
    removeOnFail: 5000,
  };
}

/**
 * Adds a job, replacing any existing job with the same id.
 *
 * BullMQ treats `add` as a no-op when the `jobId` already exists, so a job left
 * behind in a failed state would silently swallow every future re-enqueue for
 * that review. Removing it first keeps deduplication for concurrent enqueues
 * while still allowing a genuine retry.
 */
async function addReplacingJob<T>(
  queue: Queue<T>,
  // BullMQ types `add` against a name literal table; the caller supplies it.
  name: string,
  data: T,
  jobId: string,
): Promise<void> {
  const existing = await queue.getJob(jobId);

  if (existing) {
    await existing.remove().catch(() => undefined);
  }

  await (
    queue.add as (name: string, data: T, opts: object) => Promise<unknown>
  )(name, data, jobOptions(jobId));
}

export function createReviewsQueue(connection: Redis) {
  const queue = new Queue<ReviewRequest>(QUEUES.REVIEWS, { connection });

  async function enqueue(data: ReviewRequest) {
    await addReplacingJob(
      queue,
      REVIEW_JOB.PROCESS,
      data,
      `review-${data.reviewId}`,
    );
  }

  return {
    queue,
    enqueue,
  };
}

export type ReviewsQueue = ReturnType<typeof createReviewsQueue>;

export interface CreateReviewsWorkerOptions {
  connection: Redis;
  processor: (data: ReviewRequest) => Promise<void>;
  /** Jobs processed in parallel. Defaults to 1 (BullMQ's own default). */
  concurrency?: number;
}

export function createReviewsWorker({
  connection,
  processor,
  concurrency = 1,
}: CreateReviewsWorkerOptions) {
  return new Worker<ReviewRequest>(
    QUEUES.REVIEWS,
    async (job) => {
      await processor(job.data);
    },
    {
      connection,
      concurrency,
    },
  );
}

export function createIssuesQueue(connection: Redis) {
  const queue = new Queue<AnalyzeIssueRequest | GenerateFixRequest>(
    QUEUES.ISSUES,
    { connection },
  );

  async function enqueueAnalysis(data: AnalyzeIssueRequest) {
    await addReplacingJob(
      queue,
      ISSUE_JOB.ANALYZE,
      data,
      `issue-analyze-${data.issueId}`,
    );
  }

  async function enqueueFix(data: GenerateFixRequest) {
    await addReplacingJob(
      queue,
      ISSUE_JOB.GENERATE_FIX,
      data,
      `issue-fix-${data.issueId}`,
    );
  }

  return {
    queue,
    enqueueAnalysis,
    enqueueFix,
  };
}

export type IssuesQueue = ReturnType<typeof createIssuesQueue>;

export interface CreateIssuesWorkerOptions {
  connection: Redis;
  onAnalyze: (data: AnalyzeIssueRequest) => Promise<void>;
  onGenerateFix: (data: GenerateFixRequest) => Promise<void>;
  concurrency?: number;
}

export function createIssuesWorker({
  connection,
  onAnalyze,
  onGenerateFix,
  concurrency = 1,
}: CreateIssuesWorkerOptions) {
  const worker = new Worker<AnalyzeIssueRequest | GenerateFixRequest>(
    QUEUES.ISSUES,
    async (job) => {
      if (job.name === ISSUE_JOB.GENERATE_FIX) {
        await onGenerateFix(job.data as GenerateFixRequest);
        return;
      }

      await onAnalyze(job.data as AnalyzeIssueRequest);
    },
    { connection, concurrency },
  );

  return worker;
}
