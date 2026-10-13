/**
 * Autonomy and capabilities.
 *
 * Autonomy is never checked directly at a call site (`if (autonomy === ...)`).
 * Every GitHub write resolves its required capability through
 * `hasCapability`, so the authority model lives in exactly one place and new
 * capabilities cannot be granted by accident.
 */

export const AUTONOMY_LEVELS = [
  "OBSERVE",
  "SUGGEST",
  "PROPOSE",
  "AUTONOMOUS",
] as const;

export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const AGENT_CAPABILITIES = [
  /** Read repository state and run analysis. */
  "ANALYZE",
  /** Post review comments on GitHub. */
  "COMMENT",
  /** Create a branch. */
  "CREATE_BRANCH",
  /** Commit generated changes. */
  "COMMIT_CHANGES",
  /** Open a pull request. */
  "CREATE_PR",
  /** Submit a blocking "request changes" review. */
  "REQUEST_CHANGES",
] as const;

export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

/**
 * Capabilities granted by each autonomy level.
 *
 * Ordered least to most privileged. Each level is additive so an upgrade never
 * has to reason about what it previously lacked.
 */
const CAPABILITIES_BY_LEVEL: Record<AutonomyLevel, readonly AgentCapability[]> =
  {
    // Analysis and storage only. Nothing is written to GitHub.
    OBSERVE: ["ANALYZE"],
    // Adds review comments.
    SUGGEST: ["ANALYZE", "COMMENT"],
    // Adds the ability to open a proposed fix.
    PROPOSE: [
      "ANALYZE",
      "COMMENT",
      "CREATE_BRANCH",
      "COMMIT_CHANGES",
      "CREATE_PR",
    ],
    // Adds blocking reviews, which change the merge state of a pull request.
    AUTONOMOUS: [
      "ANALYZE",
      "COMMENT",
      "CREATE_BRANCH",
      "COMMIT_CHANGES",
      "CREATE_PR",
      "REQUEST_CHANGES",
    ],
  };

/** Every capability a level grants, least privileged first. */
export function capabilitiesFor(
  level: AutonomyLevel,
): readonly AgentCapability[] {
  return CAPABILITIES_BY_LEVEL[level] ?? CAPABILITIES_BY_LEVEL.OBSERVE;
}

export function hasCapability(
  level: AutonomyLevel,
  capability: AgentCapability,
): boolean {
  return capabilitiesFor(level).includes(capability);
}

/** Raised when an operation exceeds a repository's configured authority. */
export class CapabilityNotGrantedError extends Error {
  readonly capability: AgentCapability;
  readonly level: AutonomyLevel;

  constructor(capability: AgentCapability, level: AutonomyLevel) {
    super(
      `This repository is set to ${level} autonomy, which does not grant ${capability}.`,
    );
    this.name = "CapabilityNotGrantedError";
    this.capability = capability;
    this.level = level;
  }
}

/**
 * Asserts a capability before a GitHub write.
 *
 * Call this immediately before every mutating Octokit call so a missing check
 * fails loudly in development instead of silently writing to a repository.
 */
export function assertCapability(
  level: AutonomyLevel,
  capability: AgentCapability,
): void {
  if (!hasCapability(level, capability)) {
    throw new CapabilityNotGrantedError(capability, level);
  }
}
