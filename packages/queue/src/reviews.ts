import { Queue, Worker } from "bullmq";
import { QUEUES, REVIEW_JOB, type ReviewRequest } from "@revorbit/shared";

import type { Redis } from "./redis.js";

export function createReviewsQueue(connection: Redis) {
  const queue = new Queue<ReviewRequest>(QUEUES.REVIEWS, {
    connection,
  });

  async function enqueue(data: ReviewRequest) {
    await queue.add(REVIEW_JOB.PROCESS, data, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5_000,
      },
    });
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
}

export function createReviewsWorker({
  connection,
  processor,
}: CreateReviewsWorkerOptions) {
  return new Worker<ReviewRequest>(
    QUEUES.REVIEWS,
    async (job) => {
      await processor(job.data);
    },
    {
      connection,
    },
  );
}
