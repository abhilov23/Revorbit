/**
 * Shapes returned by the API. Defined once here rather than re-declared inside
 * each page, where the copies had already drifted apart.
 */

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  login: string | null;
  avatarUrl: string | null;
  githubId: number | null;
}

export type Persona =
  | "REVIEWER"
  | "SECURITY_RESEARCHER"
  | "DEVELOPER"
  | "HELPER";

export type AutonomyLevel = "OBSERVE" | "SUGGEST" | "PROPOSE" | "AUTONOMOUS";

export type AgentCapability =
  | "ANALYZE"
  | "COMMENT"
  | "CREATE_BRANCH"
  | "COMMIT_CHANGES"
  | "CREATE_PR"
  | "REQUEST_CHANGES";

export interface ReviewFocus {
  security: boolean;
  correctness: boolean;
  performance: boolean;
  style: boolean;
}

export interface RepositorySettings {
  enabled: boolean;
  security: boolean;
  correctness: boolean;
  performance: boolean;
  style: boolean;
  role: Persona;
  customPrompt: string | null;
  autonomyLevel: AutonomyLevel;
  capabilities: AgentCapability[];
  model: string;
  maxFiles: number;
  maxTokens: number;
}

export interface RepositorySummary {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  settings: RepositorySettings;
}

export type ReviewStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface ReviewSummary {
  id: string;
  pullNumber: number;
  pullTitle: string;
  repository: string;
  status: ReviewStatus;
  summary: string | null;
  model: string;
  commentCount: number;
  /** True when some diff chunks could not be analysed. */
  partial: boolean;
  createdAt: string;
}

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type FindingCategory =
  | "bug"
  | "security"
  | "performance"
  | "quality"
  | "maintainability"
  | "architecture";

export interface ReviewComment {
  id: string;
  filePath: string;
  line: number;
  category: FindingCategory;
  severity: Severity;
  title: string;
  body: string;
  problemCode: string;
  fixedCode: string;
  /** False when published in the review body instead of as an inline comment. */
  inline: boolean;
}

export interface ReviewDetail {
  id: string;
  pullNumber: number;
  pullTitle: string;
  repository: string;
  status: ReviewStatus;
  summary: string | null;
  model: string;
  partial: boolean;
  partialReason: string | null;
  chunksAnalyzed: number;
  chunksFailed: number;
  createdAt: string;
  comments: ReviewComment[];
}

export type IssueType =
  | "bug"
  | "feature"
  | "security"
  | "documentation"
  | "performance"
  | "other";

export type IssueStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export interface IssueSummary {
  id: string;
  number: number;
  title: string;
  repository: string;
  state: string;
  status: IssueStatus;
  issueType: IssueType | null;
  confidence: number | null;
  summary: string | null;
  suspectedFiles: string[];
  fixBranch: string | null;
  fixPullNumber: number | null;
  /** Server-computed from the repository's autonomy level. */
  canGenerateFix: boolean;
  autonomyLevel: AutonomyLevel;
  createdAt: string;
}

export interface IssueDetail extends IssueSummary {
  body: string | null;
  explanation: string | null;
  proposedApproach: string | null;
  errorMessage: string | null;
  model: string | null;
}

export interface GithubAppInfo {
  id: number | null;
  slug: string | null;
  name: string | null;
  htmlUrl: string | null;
  installUrl: string | null;
}

export interface InstallationRepository {
  githubId: number;
  fullName: string;
  defaultBranch: string;
  connected: boolean;
}

export interface Installation {
  id: string;
  githubId: number;
  accountLogin: string;
  accountType: string;
  repositories: InstallationRepository[];
}

export interface UserSettings {
  defaultModel: string;
  defaultMaxFiles: number;
  pullRequestReviews: boolean;
  inlineComments: boolean;
  mentionOnCritical: boolean;
  weeklyDigest: boolean;
  emailNotifications: boolean;
  defaultAutonomy: AutonomyLevel;
}
