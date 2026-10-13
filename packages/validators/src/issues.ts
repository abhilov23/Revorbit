import { z } from "zod";

/**
 * Triggers a fix proposal for an analysed issue.
 *
 * The server derives the branch name and resolves the autonomy level itself;
 * the client only asks for the action, so autonomy cannot be overridden from
 * the browser.
 */
export const generateIssueFixSchema = z.object({
  /** When true, open a draft pull request instead of only proposing a branch. */
  openPullRequest: z.boolean().default(true),
});

export type GenerateIssueFixInput = z.infer<typeof generateIssueFixSchema>;
