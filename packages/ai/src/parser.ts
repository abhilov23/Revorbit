import { z } from "zod";

import { FINDING_CATEGORIES, SEVERITIES } from "@revorbit/shared";

const commentSchema = z.object({
  filePath: z.string(),
  line: z.number().int().positive(),
  category: z.enum(FINDING_CATEGORIES),
  severity: z.enum(SEVERITIES),
  title: z.string(),
  body: z.string(),
  problemCode: z.string(),
  fixedCode: z.string(),
});

export const reviewResultSchema = z.object({
  summary: z.string(),
  comments: z.array(commentSchema).max(50),
});

export type ParsedReviewResult = z.infer<typeof reviewResultSchema>;

/** At most this many comments are posted, regardless of what the model returns. */
export const MAX_COMMENTS = 10;

function extractJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as unknown;
  } catch (error) {
    // Models occasionally wrap the object in prose despite the instructions.
    // Fall back to the outermost brace-delimited span before giving up.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1) {
      throw new Error(
        `AI response contained no JSON object (${describe(error)})`,
      );
    }

    if (end <= start) {
      // A response that opens an object but never closes it was cut off —
      // almost always by the completion-token limit rather than bad formatting.
      // Saying "no JSON object found" here sent debugging in the wrong
      // direction entirely.
      throw new Error(
        `AI response was truncated before the JSON object closed (${describe(error)}). ` +
          `Raise the maximum response tokens (maxTokens) for this repository.`,
      );
    }

    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
    } catch (inner) {
      throw new Error(`AI response failed validation: ${describe(inner)}`);
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 120) : String(error);
}

export function parseReviewResponse(content: string): ParsedReviewResult {
  let parsed = extractJson(content);

  if (Array.isArray(parsed)) {
    parsed = { summary: "", comments: parsed };
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("AI response failed validation: expected a JSON object");
  }

  const result = reviewResultSchema.safeParse(parsed);

  if (!result.success) {
    throw new Error(`AI response failed validation: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Drops comments that reference files which were never sent to the model.
 *
 * The diff is attacker-controlled, so a prompt-injected model can be induced to
 * report against an arbitrary path. Posting those to GitHub would attach
 * invented findings to unrelated files under the app's verified identity.
 */
export function filterCommentsToSentFiles(
  comments: ParsedReviewResult["comments"],
  sentFilePaths: Iterable<string>,
): ParsedReviewResult["comments"] {
  const allowed = new Set(sentFilePaths);

  return comments.filter((comment) => allowed.has(comment.filePath));
}

export function capComments(
  comments: ParsedReviewResult["comments"],
  max: number = MAX_COMMENTS,
): ParsedReviewResult["comments"] {
  return comments.slice(0, max);
}
