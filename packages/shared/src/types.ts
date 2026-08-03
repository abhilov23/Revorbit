import type { REVIEW_STATUS } from "./constants.js";

export interface ChangedFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface ReviewRepository {
  owner: string;
  name: string;
  installationId: number;
}

export interface ReviewPullRequest {
  number: number;
  title: string;
  headSha: string;
}

export interface ReviewRequest {
  reviewId: string;
  repository: ReviewRepository;
  pullRequest: ReviewPullRequest;
  files: ChangedFile[];
  model: string;
}

export interface ReviewComment {
  filePath: string;
  line: number;
  severity: "error" | "warning" | "info";
  title: string;
  body: string;
  problemCode: string;
  fixedCode: string;
}

export interface ReviewResult {
  summary: string;
  comments: ReviewComment[];
}

export type ReviewStatusType = (typeof REVIEW_STATUS)[keyof typeof REVIEW_STATUS];
