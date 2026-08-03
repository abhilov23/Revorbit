import { z } from "zod";

const commentSchema = z.object({
  filePath: z.string(),
  line: z.number().int().positive(),
  severity: z.enum(["error", "warning", "info"]),
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

export function parseReviewResponse(content: string): ParsedReviewResult {
  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  let parsed = JSON.parse(cleaned) as unknown;

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
