import type { AutonomyLevel } from "./autonomy.js";

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

/**
 * A file fetched from the repository to give the model context around a change.
 *
 * Deliberately not a `ChangedFile`: these are whole-file snapshots, not diffs,
 * and treating them as diffs rendered raw file contents as if they were hunks.
 */
export interface RepositoryContextFile {
  /** Repository-relative path, using forward slashes. */
  path: string;
  /** Full file content, or a prefix when `truncated` is true. */
  content: string;
  /** True when the content was cut to fit the context budget. */
  truncated: boolean;
  /** Size of the file on disk in bytes, before any truncation. */
  bytes: number;
}

export interface ReviewPullRequest {
  number: number;
  title: string;
  headSha: string;
}

export const SEVERITIES = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type Severity = (typeof SEVERITIES)[number];

export const FINDING_CATEGORIES = [
  "bug",
  "security",
  "performance",
  "quality",
  "maintainability",
  "architecture",
] as const;

export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export interface ReviewComment {
  filePath: string;
  line: number;
  category: FindingCategory;
  severity: Severity;
  title: string;
  body: string;
  problemCode: string;
  fixedCode: string;
}

export interface ReviewResult {
  summary: string;
  comments: ReviewComment[];
  /**
   * Set when one or more diff chunks could not be analysed. A partial result
   * must be labelled as such rather than presented as a full review.
   */
  partial: boolean;
  partialReason?: string;
  chunksAnalyzed: number;
  chunksFailed: number;
}

export type ReviewStatusType =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

/** Reviewer roles. Mirrors the `Role` enum in the Prisma schema. */
export const ROLES = [
  "REVIEWER",
  "SECURITY_RESEARCHER",
  "DEVELOPER",
  "HELPER",
] as const;

export type ReviewRole = (typeof ROLES)[number];

/**
 * Focus areas a review should consider. Carried on the job payload so the AI
 * prompt and the worker agree on what "disabled" means.
 */
export interface ReviewBehavior {
  security: boolean;
  correctness: boolean;
  performance: boolean;
  style: boolean;
}

export const DEFAULT_REVIEW_BEHAVIOR: ReviewBehavior = {
  security: true,
  correctness: true,
  performance: true,
  style: true,
};

export interface ReviewConfiguration {
  role: ReviewRole;
  customPrompt?: string | null;
  behavior: ReviewBehavior;
  maxTokens: number;
  autonomy: AutonomyLevel;
}

/**
 * Extra knobs the AI client understands. Kept separate from `model` so the
 * shared payload stays a plain data transfer object.
 */
export interface ReviewModelOptions {
  model?: string;
  maxTokens?: number;
}

/**
 * Job payload for a pull request review.
 *
 * Carries identifiers only. The worker re-fetches the pull request and its
 * files from GitHub when the job runs, so a large diff is never serialised
 * into Redis and a queued review always analyses the state at execution time.
 */
export interface ReviewRequest {
  reviewId: string;
  repository: ReviewRepository;
  pullRequest: ReviewPullRequest;
  model: string;
  configuration: ReviewConfiguration;
  maxFiles: number;
  deliveryId?: string;
}

export const ISSUE_TYPES = [
  "bug",
  "feature",
  "security",
  "documentation",
  "performance",
  "other",
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

export interface IssueAnalysis {
  summary: string;
  type: IssueType;
  confidence: number;
  suspectedFiles: string[];
  explanation: string;
  proposedApproach: string;
}

export interface IssueResult extends IssueAnalysis {
  partial: boolean;
  chunksAnalyzed: number;
  chunksFailed: number;
}

export interface IssueFix {
  summary: string;
  explanation: string;
  /** Complete file replacements keyed by repository path. */
  files: Array<{ path: string; content: string }>;
  commitMessage: string;
}

/**
 * Branch name for a proposed fix.
 *
 * Derived deterministically from the issue number rather than generated, so a
 * re-run targets the same branch instead of forking a new one.
 */
export function fixBranchName(issueNumber: number): string {
  return `revorbit/fix-${issueNumber}`;
}

/** Job payload for issue analysis. Identifiers only, as with reviews. */
export interface AnalyzeIssueRequest {
  issueId: string;
  repository: ReviewRepository;
  issue: { number: number; title: string };
  model: string;
  configuration: ReviewConfiguration;
  maxFiles: number;
  deliveryId?: string;
}

/** Job payload for turning an issue analysis into a proposed fix. */
export interface GenerateFixRequest {
  issueId: string;
  repository: ReviewRepository;
  issue: { number: number; title: string };
  analysis: IssueAnalysis;
  model: string;
  configuration: ReviewConfiguration;
  deliveryId?: string;
}
