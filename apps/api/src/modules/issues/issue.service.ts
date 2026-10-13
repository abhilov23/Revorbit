import { Prisma, prisma } from "@revorbit/database";
import { hasCapability } from "@revorbit/shared";

import { ConflictError, ForbiddenError, NotFoundError } from "@/errors";
import { createIssuesQueue, createRedis } from "@revorbit/queue";

import { redisConfig } from "@/config/env";

const issuesQueue = createIssuesQueue(createRedis(redisConfig));

function ownedBy(userId: string) {
  return { repository: { installation: { userId } } };
}

export interface IssueSummary {
  id: string;
  number: number;
  title: string;
  repository: string;
  state: string;
  status: string;
  issueType: string | null;
  confidence: number | null;
  summary: string | null;
  suspectedFiles: string[];
  fixBranch: string | null;
  fixPullNumber: number | null;
  /**
   * Whether this repository's autonomy permits generating a fix.
   *
   * Computed server-side from the capability mapping rather than in the
   * browser, so the UI cannot drift from the rule that actually gates the
   * operation. The endpoint re-checks regardless.
   */
  canGenerateFix: boolean;
  autonomyLevel: string;
  createdAt: string;
}

type IssueWithSettings = Prisma.IssueGetPayload<{
  include: { repository: { include: { settings: true } } };
}>;

function canGenerateFix(issue: IssueWithSettings): boolean {
  return hasCapability(
    issue.repository.settings?.autonomyLevel ?? "OBSERVE",
    "COMMIT_CHANGES",
  );
}

function autonomyLevel(issue: IssueWithSettings): string {
  return issue.repository.settings?.autonomyLevel ?? "OBSERVE";
}

/**
 * Issues are scoped through their repository's installation owner, matching
 * the review service. Issue bodies frequently quote proprietary code.
 */
class IssueService {
  async listIssues(userId: string, limit = 50): Promise<IssueSummary[]> {
    const issues = await prisma.issue.findMany({
      where: ownedBy(userId),
      include: { repository: { include: { settings: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return issues.map((issue) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      repository: issue.repository.fullName,
      state: issue.state,
      status: issue.status,
      issueType: issue.issueType,
      confidence: issue.confidence,
      summary: issue.summary,
      suspectedFiles: issue.suspectedFiles,
      fixBranch: issue.fixBranch,
      fixPullNumber: issue.fixPullNumber,
      canGenerateFix: canGenerateFix(issue),
      autonomyLevel: autonomyLevel(issue),
      createdAt: issue.createdAt.toISOString(),
    }));
  }

  async getIssue(userId: string, issueId: string) {
    const issue = await prisma.issue.findFirst({
      where: { id: issueId, ...ownedBy(userId) },
      include: { repository: { include: { settings: true } } },
    });

    if (!issue) {
      throw new NotFoundError("Issue not found");
    }

    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      repository: issue.repository.fullName,
      state: issue.state,
      status: issue.status,
      issueType: issue.issueType,
      confidence: issue.confidence,
      summary: issue.summary,
      explanation: issue.explanation,
      proposedApproach: issue.proposedApproach,
      suspectedFiles: issue.suspectedFiles,
      fixBranch: issue.fixBranch,
      fixPullNumber: issue.fixPullNumber,
      canGenerateFix: canGenerateFix(issue),
      autonomyLevel: autonomyLevel(issue),
      errorMessage: issue.errorMessage,
      model: issue.model,
      createdAt: issue.createdAt.toISOString(),
    };
  }

  /**
   * Queues fix generation for an analysed issue.
   *
   * The autonomy level is read from the repository, never from the request, so
   * a client cannot escalate its own authority by asking for a fix.
   */
  async generateFix(userId: string, issueId: string) {
    const issue = await prisma.issue.findFirst({
      where: { id: issueId, ...ownedBy(userId) },
      include: {
        repository: {
          include: { installation: true, settings: true },
        },
      },
    });

    if (!issue) {
      throw new NotFoundError("Issue not found");
    }

    const settings = issue.repository.settings;

    if (!settings?.enabled) {
      throw new ForbiddenError("Automation is disabled for this repository");
    }

    if (issue.fixPullNumber) {
      throw new ConflictError("A fix has already been proposed for this issue");
    }

    const autonomy = settings.autonomyLevel;

    if (!hasCapability(autonomy, "COMMIT_CHANGES")) {
      throw new ForbiddenError(
        `This repository is set to ${autonomy} autonomy, which does not permit generating fixes. Raise it to PROPOSE or AUTONOMOUS.`,
      );
    }

    await issuesQueue.enqueueFix({
      issueId: issue.id,
      repository: {
        owner: issue.repository.owner,
        name: issue.repository.name,
        installationId: issue.repository.installation.githubId,
      },
      issue: { number: issue.number, title: issue.title },
      analysis: {
        summary: issue.summary ?? issue.title,
        type: (issue.issueType ?? "other") as
          | "bug"
          | "feature"
          | "security"
          | "documentation"
          | "performance"
          | "other",
        confidence: issue.confidence ?? 0,
        suspectedFiles: issue.suspectedFiles,
        explanation: issue.explanation ?? "",
        proposedApproach: issue.proposedApproach ?? "",
      },
      model: issue.model ?? settings.model,
      configuration: {
        role: settings.role,
        customPrompt: settings.customPrompt,
        autonomy: autonomy,
        behavior: {
          security: settings.security,
          correctness: settings.correctness,
          performance: settings.performance,
          style: settings.style,
        },
        maxTokens: settings.maxTokens,
      },
    });

    return { queued: true, issueId: issue.id };
  }

  /** Marks an issue as queued for analysis, used by the manual trigger. */
  async requestAnalysis(userId: string, issueId: string) {
    const issue = await prisma.issue.findFirst({
      where: { id: issueId, ...ownedBy(userId) },
      include: {
        repository: { include: { installation: true, settings: true } },
      },
    });

    if (!issue) {
      throw new NotFoundError("Issue not found");
    }

    const settings = issue.repository.settings;

    if (!settings?.enabled) {
      throw new ForbiddenError("Automation is disabled for this repository");
    }

    await prisma.issue.update({
      where: { id: issue.id },
      data: { status: "PENDING", errorMessage: null },
    });

    await issuesQueue.enqueueAnalysis({
      issueId: issue.id,
      repository: {
        owner: issue.repository.owner,
        name: issue.repository.name,
        installationId: issue.repository.installation.githubId,
      },
      issue: { number: issue.number, title: issue.title },
      model: issue.model ?? settings.model,
      configuration: {
        role: settings.role,
        customPrompt: settings.customPrompt,
        autonomy: settings.autonomyLevel,
        behavior: {
          security: settings.security,
          correctness: settings.correctness,
          performance: settings.performance,
          style: settings.style,
        },
        maxTokens: settings.maxTokens,
      },
      maxFiles: settings.maxFiles,
    });

    return { queued: true, issueId: issue.id };
  }
}

export const issueService = new IssueService();
