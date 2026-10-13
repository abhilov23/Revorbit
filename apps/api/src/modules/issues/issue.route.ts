import { Hono } from "hono";

import type { AppContext, AppEnv } from "@/types/context";
import { requireUserId } from "@/types/context";
import { requireAuth } from "@/middleware/auth";
import { success } from "@/utils/response";
import { ValidationError } from "@/errors";

import { issueService } from "./issue.service";

const issuesRouter = new Hono<AppEnv>();

issuesRouter.use("*", requireAuth);

function requireIssueId(c: AppContext): string {
  const issueId = c.req.param("issueId");

  if (!issueId) {
    throw new ValidationError("Missing issue id");
  }

  return issueId;
}

issuesRouter.get("/", async (c: AppContext) => {
  const issues = await issueService.listIssues(requireUserId(c));
  return success(c, issues);
});

issuesRouter.get("/:issueId", async (c: AppContext) => {
  const issue = await issueService.getIssue(
    requireUserId(c),
    requireIssueId(c),
  );
  return success(c, issue);
});

issuesRouter.post("/:issueId/analyze", async (c: AppContext) => {
  const result = await issueService.requestAnalysis(
    requireUserId(c),
    requireIssueId(c),
  );
  return success(c, result);
});

/**
 * Queues fix generation.
 *
 * Autonomy is resolved server-side from the repository settings, so this route
 * can only ever succeed when the repository actually grants the capability.
 */
issuesRouter.post("/:issueId/fix", async (c: AppContext) => {
  const result = await issueService.generateFix(
    requireUserId(c),
    requireIssueId(c),
  );
  return success(c, result);
});

export default issuesRouter;
