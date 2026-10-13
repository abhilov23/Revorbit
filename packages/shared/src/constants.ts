export const QUEUES = {
  REVIEWS: "reviews",
  ISSUES: "issues",
} as const;

export const REVIEW_JOB = {
  PROCESS: "process-review",
} as const;

export const ISSUE_JOB = {
  ANALYZE: "analyze-issue",
  GENERATE_FIX: "generate-issue-fix",
} as const;

export const REVIEW_STATUS = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type ReviewStatus = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];

export const ISSUE_STATUS = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;

export type IssueStatus = (typeof ISSUE_STATUS)[keyof typeof ISSUE_STATUS];

/** Webhook actions that trigger a pull request review. */
export const REVIEWABLE_PR_ACTIONS = [
  "opened",
  "reopened",
  "synchronize",
  "ready_for_review",
] as const;

/** Actions that mean a draft pull request became reviewable. */
export const NON_REVIEWABLE_PR_ACTIONS = [
  "closed",
  "edited",
  "labeled",
  "unlabeled",
  "assigned",
  "unassigned",
  "review_requested",
  "review_request_removed",
  "converted_to_draft",
] as const;
