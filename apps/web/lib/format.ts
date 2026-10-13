import type {
  AutonomyLevel,
  FindingCategory,
  Persona,
  ReviewStatus,
  Severity,
} from "@/lib/api-types";

/** Maps a review status to its badge variant. */
export function statusVariant(status: ReviewStatus) {
  if (status === "COMPLETED") return "default" as const;
  if (status === "FAILED") return "destructive" as const;
  return "secondary" as const;
}

/** Maps a finding severity to its badge variant. */
export function severityVariant(severity: Severity) {
  if (severity === "critical" || severity === "high") {
    return "destructive" as const;
  }

  if (severity === "medium") return "secondary" as const;
  return "outline" as const;
}

/** `2026-02-03T…` -> `Feb 3`. */
export function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** `2026-02-03T…` -> `Feb 3, 2026, 14:05`. */
export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ROLE_LABELS: Record<Persona, string> = {
  REVIEWER: "Code reviewer",
  SECURITY_RESEARCHER: "Security researcher",
  DEVELOPER: "Pragmatic developer",
  HELPER: "Helper",
};

export const ROLE_DESCRIPTIONS: Record<Persona, string> = {
  REVIEWER:
    "Prioritises correctness, bugs, edge cases, maintainability and architecture.",
  SECURITY_RESEARCHER:
    "Prioritises authentication, injection, secret exposure and privilege escalation.",
  DEVELOPER:
    "Prioritises implementation correctness, practical fixes and developer experience.",
  HELPER: "Reports only clear problems, without critiquing style or structure.",
};

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  OBSERVE: "Observe",
  SUGGEST: "Suggest",
  PROPOSE: "Propose",
  AUTONOMOUS: "Autonomous",
};

export const AUTONOMY_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  OBSERVE: "Analyses and stores findings. Nothing is written back to GitHub.",
  SUGGEST:
    "Analyses and posts review comments. Repository code is never modified.",
  PROPOSE:
    "May open a fix branch and a draft pull request for a human to review.",
  AUTONOMOUS:
    "Everything Propose allows, plus blocking reviews that change merge state.",
};

export const CAPABILITY_LABELS: Record<string, string> = {
  ANALYZE: "Analyse",
  COMMENT: "Post comments",
  CREATE_BRANCH: "Create branches",
  COMMIT_CHANGES: "Commit changes",
  CREATE_PR: "Open pull requests",
  REQUEST_CHANGES: "Request changes",
};

/**
 * Mirrors the server-side capability mapping in `@revorbit/shared`.
 *
 * Duplicated deliberately: this is display only, and the server is the single
 * authority that decides what a write is allowed to do. The API also returns
 * the resolved `capabilities` list, which is what the dashboard renders.
 */
export function capabilitiesFor(level: AutonomyLevel): string[] {
  switch (level) {
    case "OBSERVE":
      return ["ANALYZE"];
    case "SUGGEST":
      return ["ANALYZE", "COMMENT"];
    case "PROPOSE":
      return [
        "ANALYZE",
        "COMMENT",
        "CREATE_BRANCH",
        "COMMIT_CHANGES",
        "CREATE_PR",
      ];
    case "AUTONOMOUS":
      return [
        "ANALYZE",
        "COMMENT",
        "CREATE_BRANCH",
        "COMMIT_CHANGES",
        "CREATE_PR",
        "REQUEST_CHANGES",
      ];
  }
}

export const FOCUS_LABELS: Record<string, string> = {
  security: "Security",
  correctness: "Correctness & bugs",
  performance: "Performance",
  style: "Maintainability",
};

export const CATEGORY_LABELS: Record<FindingCategory, string> = {
  bug: "Bug",
  security: "Security",
  performance: "Performance",
  quality: "Quality",
  maintainability: "Maintainability",
  architecture: "Architecture",
};
