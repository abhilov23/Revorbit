import type { ChangedFile } from "@revorbit/shared";

export type DiffSide = "LEFT" | "RIGHT";

/** `@@ -oldStart,oldCount +newStart,newCount @@ optional section heading` */
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

/**
 * Line numbers that can legally receive an inline review comment, per file.
 *
 * GitHub rejects a review outright (HTTP 422) when a single comment references
 * a line that is not part of the diff, so the valid set has to be computed
 * from the patch rather than assumed from the file on disk.
 */
export type DiffPositions = Map<string, Map<number, Set<DiffSide>>>;

function parseFilePositions(
  patch: string | undefined,
): Map<number, Set<DiffSide>> {
  const positions = new Map<number, Set<DiffSide>>();

  if (!patch) {
    return positions;
  }

  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  const mark = (line: number, side: DiffSide) => {
    let sides = positions.get(line);

    if (!sides) {
      sides = new Set<DiffSide>();
      positions.set(line, sides);
    }

    sides.add(side);
  };

  for (const raw of patch.split("\n")) {
    const header = HUNK_HEADER.exec(raw);

    if (header) {
      // A zero count means the file is empty on that side (added or deleted
      // file); the start is still authoritative for the other side.
      oldLine = Number(header[1]);
      newLine = Number(header[3]);
      inHunk = true;
      continue;
    }

    // Anything before the first hunk header is the file preamble
    // (`diff --git`, `index`, `--- a/…`, `+++ b/…`).
    if (!inHunk) {
      continue;
    }

    if (raw.startsWith("\\")) {
      // "\ No newline at end of file" carries no line of its own.
      continue;
    }

    if (raw.startsWith("+")) {
      mark(newLine, "RIGHT");
      newLine += 1;
      continue;
    }

    if (raw.startsWith("-")) {
      mark(oldLine, "LEFT");
      oldLine += 1;
      continue;
    }

    if (raw.startsWith(" ") || raw === "") {
      // A blank context line is normally " ", but some tooling strips the
      // trailing space. Treating it as context keeps the remaining line
      // numbers aligned; a trailing empty segment is harmless.
      mark(newLine, "RIGHT");
      mark(oldLine, "LEFT");
      oldLine += 1;
      newLine += 1;
      continue;
    }

    // Anything else ends the current hunk.
    inHunk = false;
  }

  return positions;
}

export function buildDiffPositions(files: ChangedFile[]): DiffPositions {
  const positions: DiffPositions = new Map();

  for (const file of files) {
    // Binary files, pure renames and truncated patches have no usable hunks.
    // No entry is recorded so they resolve as "unknown-file" and get the
    // explanation that matches the cause, rather than being reported as simply
    // missing a line.
    if (!file.patch) {
      continue;
    }

    positions.set(file.filename, parseFilePositions(file.patch));
  }

  return positions;
}

export type ResolvedPosition =
  | { mappable: true; line: number; side: DiffSide }
  | { mappable: false; reason: "unknown-file" | "line-not-in-diff" };

/**
 * Resolves a (file, line) pair to a legal inline comment position.
 *
 * `RIGHT` is preferred for lines present on both sides because the AI was shown
 * the patch, in which unchanged context is written in terms of the new file.
 */
export function resolveCommentPosition(
  positions: DiffPositions,
  filePath: string,
  line: number,
): ResolvedPosition {
  const filePositions = positions.get(filePath);

  if (!filePositions) {
    return { mappable: false, reason: "unknown-file" };
  }

  const sides = filePositions.get(line);

  if (!sides) {
    return { mappable: false, reason: "line-not-in-diff" };
  }

  if (sides.has("RIGHT")) {
    return { mappable: true, line, side: "RIGHT" };
  }

  if (sides.has("LEFT")) {
    return { mappable: true, line, side: "LEFT" };
  }

  return { mappable: false, reason: "line-not-in-diff" };
}

export interface InlineCommentInput {
  path: string;
  line: number;
  body: string;
}

export type UnmappableReason = "unknown-file" | "line-not-in-diff";

export interface UnmappableFinding {
  path: string;
  line: number;
  body: string;
  reason: UnmappableReason;
}

export interface ResolvedReview {
  /** Comments GitHub will accept, each with an explicit side. */
  comments: Array<InlineCommentInput & { side: DiffSide }>;
  /** Findings that must be folded into the review body instead. */
  unmapped: UnmappableFinding[];
}

/**
 * Splits findings into mappable inline comments and those that must go in the
 * summary. Nothing is silently dropped and nothing is snapped to a nearby
 * line, which would attach a finding to code it does not describe.
 */
export function resolveInlineComments(
  comments: InlineCommentInput[],
  positions: DiffPositions,
): ResolvedReview {
  const inline: Array<InlineCommentInput & { side: DiffSide }> = [];
  const unmapped: UnmappableFinding[] = [];

  for (const comment of comments) {
    const resolved = resolveCommentPosition(
      positions,
      comment.path,
      comment.line,
    );

    if (resolved.mappable) {
      inline.push({
        path: comment.path,
        line: resolved.line,
        side: resolved.side,
        body: comment.body,
      });
    } else {
      unmapped.push({
        path: comment.path,
        line: comment.line,
        body: comment.body,
        reason: resolved.reason,
      });
    }
  }

  return { comments: inline, unmapped };
}

const UNMAPPED_HEADING =
  "**Findings that could not be attached to a changed line.**";

const UNMAPPED_REASON: Record<UnmappableReason, string> = {
  "unknown-file":
    "These files had no readable diff, so no line could be targeted (binary, renamed without changes, or the patch was truncated).",
  "line-not-in-diff":
    "These reported lines fall outside the pull request's diff, so GitHub has no position to anchor an inline comment to.",
};

/**
 * Folds unmappable findings into the review body.
 *
 * A finding is never dropped and never snapped to a nearby line: the position
 * would then describe different code than the finding does.
 */
export function composeReviewBody(
  summary: string,
  unmapped: UnmappableFinding[],
): string {
  if (unmapped.length === 0) {
    return summary;
  }

  const entries = unmapped.map((finding) =>
    [`#### \`${finding.path}:${finding.line}\``, "", finding.body, ""].join(
      "\n",
    ),
  );

  const present = (Object.keys(UNMAPPED_REASON) as UnmappableReason[]).filter(
    (reason) => unmapped.some((finding) => finding.reason === reason),
  );

  return [
    summary,
    "---",
    UNMAPPED_HEADING,
    ...present.map((reason) => UNMAPPED_REASON[reason]),
    ...entries,
  ].join("\n\n");
}
