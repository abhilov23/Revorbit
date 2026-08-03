export function formatReviewSummary(
  summary: string,
  commentCount: number,
): string {
  const header = `## AI Code Review`;
  const stats = `**${commentCount} comment${commentCount === 1 ? "" : "s"}**`;

  return `${header}\n\n${stats}\n\n${summary}`;
}
