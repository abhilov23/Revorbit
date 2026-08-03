export const QUEUES = {
  REVIEWS: "reviews",
} as const;

export const REVIEW_JOB = {
  PROCESS: "process-review",
} as const;

export const REVIEW_STATUS = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type ReviewStatus =
  (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];
