import { Prisma, prisma } from "@revorbit/database";
import { github } from "@/lib/github";
import {
  createIssuesQueue,
  createRedis,
  createReviewsQueue,
} from "@revorbit/queue";
import {
  ISSUE_STATUS,
  REVIEW_STATUS,
  REVIEWABLE_PR_ACTIONS,
} from "@revorbit/shared";
import type {
  AnalyzeIssueRequest,
  ReviewConfiguration,
  ReviewRequest,
} from "@revorbit/shared";

import { redisConfig } from "@/config/env";
import { logger } from "@/lib/logger";

export interface PullRequestEvent {
  action: string;
  repository: {
    id: number;
    name: string;
    owner: { login: string };
    default_branch: string;
  };
  installation: { id: number };
  pull_request: {
    number: number;
    title: string;
    head: { sha: string };
    draft?: boolean;
  };
  sender?: { id: number };
}

export interface InstallationEvent {
  action: string;
  installation: {
    id: number;
    account: { login: string; type: string };
  };
  sender?: { id: number };
}

export interface InstallationRepositoriesEvent {
  action: string;
  installation: { id: number };
  repositories_added?: Array<{
    id: number;
    name: string;
    full_name: string;
    default_branch: string;
    owner: { login: string };
  }>;
  repositories_removed?: Array<{ id: number }>;
  sender?: { id: number };
}

export interface IssueEvent {
  action: string;
  issue: {
    number: number;
    title: string;
    body?: string | null;
    state: string;
    pull_request?: unknown;
  };
  repository: {
    id: number;
    name: string;
    owner: { login: string };
    default_branch: string;
  };
  installation: { id: number };
  sender?: { id: number };
}

export interface IssueCommentEvent {
  action: string;
  issue: {
    number: number;
    title: string;
    body?: string | null;
    state: string;
    pull_request?: unknown;
  };
  comment: { id: number; body?: string | null };
  repository: {
    id: number;
    name: string;
    owner: { login: string };
    default_branch: string;
  };
  installation: { id: number };
  sender?: { id: number };
}

export interface WebhookResult {
  processed: boolean;
  reviewId?: string;
  issueId?: string;
  reason?: string;
}

export interface InstallationSummary {
  id: string;
  githubId: number;
  accountLogin: string;
  accountType: string;
  repositories: Array<{
    githubId: number;
    fullName: string;
    defaultBranch: string;
    connected: boolean;
  }>;
}

const reviewsQueue = createReviewsQueue(createRedis(redisConfig));
const issuesQueue = createIssuesQueue(createRedis(redisConfig));

function toConfiguration(settings: {
  role: ReviewConfiguration["role"];
  customPrompt: string | null;
  autonomyLevel: ReviewConfiguration["autonomy"];
  security: boolean;
  correctness: boolean;
  performance: boolean;
  style: boolean;
  maxTokens: number;
}): ReviewConfiguration {
  return {
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
  };
}

class GitHubService {
  async handlePullRequest(
    payload: PullRequestEvent,
    deliveryId?: string,
  ): Promise<WebhookResult> {
    // Only actions that produce a reviewable commit. A draft pull request is
    // skipped until it is marked ready, which is what `ready_for_review`
    // signals.
    const isReviewable = (REVIEWABLE_PR_ACTIONS as readonly string[]).includes(
      payload.action,
    );

    if (!isReviewable) {
      return { processed: false, reason: `ignored action ${payload.action}` };
    }

    if (
      payload.pull_request.draft === true &&
      payload.action !== "ready_for_review"
    ) {
      return { processed: false, reason: "pull request is a draft" };
    }

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pullNumber = payload.pull_request.number;
    const installationId = payload.installation.id;
    const fullName = `${owner}/${repo}`;

    const repository = await this.upsertRepository({
      githubId: payload.repository.id,
      owner,
      name: repo,
      fullName,
      defaultBranch: payload.repository.default_branch,
      installationId,
      senderGithubId: payload.sender?.id,
    });

    const settings = await prisma.repositorySettings.upsert({
      where: { repositoryId: repository.id },
      create: { repositoryId: repository.id },
      update: {},
    });

    if (!settings.enabled) {
      return { processed: false, reason: "reviews disabled for repository" };
    }

    // GitHub delivers `pull_request` events more than once for the same commit
    // (retries, the "Redeliver" button, and concurrent `synchronize` calls).
    // The unique constraint on (repositoryId, pullNumber, headSha) is the real
    // guard; a failed insert is the signal that another delivery won the race.
    let review;

    try {
      review = await prisma.review.create({
        data: {
          repositoryId: repository.id,
          pullNumber,
          pullTitle: payload.pull_request.title,
          headSha: payload.pull_request.head.sha,
          status: REVIEW_STATUS.PENDING,
          model: settings.model,
        },
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== "P2002"
      ) {
        throw error;
      }

      const existing = await prisma.review.findUniqueOrThrow({
        where: {
          repositoryId_pullNumber_headSha: {
            repositoryId: repository.id,
            pullNumber,
            headSha: payload.pull_request.head.sha,
          },
        },
      });

      // A previously failed review is retried by resetting it to PENDING.
      // Anything still running or already completed is left alone.
      if (existing.status === REVIEW_STATUS.FAILED) {
        review = await prisma.review.update({
          where: { id: existing.id },
          data: {
            status: REVIEW_STATUS.PENDING,
            summary: null,
            partial: false,
            partialReason: null,
            chunksAnalyzed: 0,
            chunksFailed: 0,
          },
        });
      } else {
        return {
          processed: true,
          reviewId: existing.id,
          reason: "review already exists for this commit",
        };
      }
    }

    // Only identifiers cross the queue boundary. The worker re-fetches the pull
    // request and its files, so a large diff is never serialised into Redis.
    const request: ReviewRequest = {
      reviewId: review.id,
      repository: { owner, name: repo, installationId },
      pullRequest: {
        number: pullNumber,
        title: payload.pull_request.title,
        headSha: payload.pull_request.head.sha,
      },
      model: settings.model,
      configuration: toConfiguration(settings),
      maxFiles: settings.maxFiles,
      ...(deliveryId ? { deliveryId } : {}),
    };

    await reviewsQueue.enqueue(request);

    return { processed: true, reviewId: review.id };
  }

  async handleIssue(
    payload: IssueEvent,
    deliveryId?: string,
  ): Promise<WebhookResult> {
    if (payload.action !== "opened" && payload.action !== "reopened") {
      return { processed: false, reason: `ignored action ${payload.action}` };
    }

    // `issues` also fires for pull requests, which the review pipeline owns.
    if (payload.issue.pull_request) {
      return { processed: false, reason: "issue is a pull request" };
    }

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const installationId = payload.installation.id;

    const repository = await this.upsertRepository({
      githubId: payload.repository.id,
      owner,
      name: repo,
      fullName: `${owner}/${repo}`,
      defaultBranch: payload.repository.default_branch,
      installationId,
      senderGithubId: payload.sender?.id,
    });

    const settings = await prisma.repositorySettings.upsert({
      where: { repositoryId: repository.id },
      create: { repositoryId: repository.id },
      update: {},
    });

    if (!settings.enabled) {
      return { processed: false, reason: "automation disabled for repository" };
    }

    const issue = await prisma.issue.upsert({
      where: {
        repositoryId_number: {
          repositoryId: repository.id,
          number: payload.issue.number,
        },
      },
      create: {
        repositoryId: repository.id,
        number: payload.issue.number,
        title: payload.issue.title,
        body: payload.issue.body ?? null,
        state: payload.issue.state,
        status: ISSUE_STATUS.PENDING,
        model: settings.model,
      },
      // A reopened issue is re-analysed from scratch.
      update: {
        state: payload.issue.state,
        status: ISSUE_STATUS.PENDING,
        errorMessage: null,
      },
    });

    const request: AnalyzeIssueRequest = {
      issueId: issue.id,
      repository: { owner, name: repo, installationId },
      issue: { number: issue.number, title: issue.title },
      model: settings.model,
      configuration: toConfiguration(settings),
      maxFiles: settings.maxFiles,
      ...(deliveryId ? { deliveryId } : {}),
    };

    await issuesQueue.enqueueAnalysis(request);

    return { processed: true, issueId: issue.id };
  }

  /**
   * `issue_comment` carries operational triggers rather than review work:
   *
   * - `revorbit analyze` re-runs analysis on an existing issue.
   * - `revorbit fix` asks for a proposed fix, subject to autonomy.
   *
   * Anything else is ignored, so an ordinary comment never spends AI budget.
   */
  async handleIssueComment(payload: IssueCommentEvent): Promise<WebhookResult> {
    if (payload.action !== "created") {
      return { processed: false, reason: `ignored action ${payload.action}` };
    }

    if (payload.issue.pull_request) {
      return { processed: false, reason: "comment is on a pull request" };
    }

    const body = payload.comment.body?.trim() ?? "";

    const wantsAnalyze = /^revorbit\s+analyze\b/i.test(body);
    const wantsFix = /^revorbit\s+fix\b/i.test(body);

    if (!wantsAnalyze && !wantsFix) {
      return { processed: false, reason: "no revorbit command in comment" };
    }

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const installationId = payload.installation.id;

    const repository = await this.upsertRepository({
      githubId: payload.repository.id,
      owner,
      name: repo,
      fullName: `${owner}/${repo}`,
      defaultBranch: payload.repository.default_branch,
      installationId,
      senderGithubId: payload.sender?.id,
    });

    const settings = await prisma.repositorySettings.upsert({
      where: { repositoryId: repository.id },
      create: { repositoryId: repository.id },
      update: {},
    });

    if (!settings.enabled) {
      return { processed: false, reason: "automation disabled for repository" };
    }

    const issue = await prisma.issue.upsert({
      where: {
        repositoryId_number: {
          repositoryId: repository.id,
          number: payload.issue.number,
        },
      },
      create: {
        repositoryId: repository.id,
        number: payload.issue.number,
        title: payload.issue.title,
        body: payload.issue.body ?? null,
        state: payload.issue.state,
        status: ISSUE_STATUS.PENDING,
        model: settings.model,
      },
      update: {},
    });

    if (wantsAnalyze) {
      await issuesQueue.enqueueAnalysis({
        issueId: issue.id,
        repository: { owner, name: repo, installationId },
        issue: { number: issue.number, title: issue.title },
        model: settings.model,
        configuration: toConfiguration(settings),
        maxFiles: settings.maxFiles,
      });

      return { processed: true, issueId: issue.id };
    }

    await issuesQueue.enqueueFix({
      issueId: issue.id,
      repository: { owner, name: repo, installationId },
      issue: { number: issue.number, title: issue.title },
      analysis: {
        summary: "Requested via comment.",
        type: "other",
        confidence: 0,
        suspectedFiles: [],
        explanation: "",
        proposedApproach: "",
      },
      model: settings.model,
      configuration: toConfiguration(settings),
    });

    return { processed: true, issueId: issue.id };
  }

  async handleInstallation(payload: InstallationEvent): Promise<WebhookResult> {
    if (payload.action === "deleted") {
      /*
       * Changing the app's permissions or reinstalling creates a new
       * installation and deletes the old one. Without removing the row here,
       * repositories stay pointed at an installation that no longer exists and
       * every review fails with 404.
       */
      const installation = await prisma.installation.findUnique({
        where: { githubId: payload.installation.id },
        select: { id: true },
      });

      if (installation) {
        await prisma.installation.delete({
          where: { id: installation.id },
        });

        logger.info(
          { installationId: payload.installation.id },
          "github.installation.removed",
        );
      }

      return { processed: true };
    }

    if (payload.action === "suspend" || payload.action === "unsuspend") {
      logger.info(
        { installationId: payload.installation.id, action: payload.action },
        "github.installation.suspension_changed",
      );

      return { processed: true };
    }

    if (payload.action !== "created") {
      return { processed: false, reason: `ignored action ${payload.action}` };
    }

    await this.findOrCreateInstallation({
      githubId: payload.installation.id,
      accountLogin: payload.installation.account.login,
      accountType: payload.installation.account.type,
      senderGithubId: payload.sender?.id,
    });

    return { processed: true };
  }

  async handleInstallationRepositories(
    payload: InstallationRepositoriesEvent,
  ): Promise<WebhookResult> {
    if (payload.action === "added") {
      for (const repo of payload.repositories_added ?? []) {
        await this.upsertRepository({
          githubId: repo.id,
          owner: repo.owner.login,
          name: repo.name,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch,
          installationId: payload.installation.id,
          senderGithubId: payload.sender?.id,
        });
      }

      return { processed: true };
    }

    if (payload.action === "removed") {
      const githubIds = (payload.repositories_removed ?? []).map(
        (repo) => repo.id,
      );

      if (githubIds.length > 0) {
        const installationId = payload.installation.id;

        // Resolving the installation from the payload first means the delete is
        // scoped to repositories this installation actually owns. Matching on
        // `githubId` alone would let a malformed or forged event remove
        // repositories belonging to a different installation, cascading away
        // their settings and review history.
        const installation = await prisma.installation.findUnique({
          where: { githubId: installationId },
          select: { id: true },
        });

        if (!installation) {
          return { processed: false };
        }

        await prisma.repository.deleteMany({
          where: {
            githubId: { in: githubIds },
            installationId: installation.id,
          },
        });
      }

      return { processed: true };
    }

    return { processed: false };
  }

  async listInstallationsForUser(
    userId: string,
  ): Promise<InstallationSummary[]> {
    const installations = await prisma.installation.findMany({
      where: { userId },
      include: {
        repositories: {
          select: {
            githubId: true,
            fullName: true,
            defaultBranch: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const connectedByGithubId = new Set(
      installations.flatMap((installation) =>
        installation.repositories.map((repository) => repository.githubId),
      ),
    );

    return Promise.all(
      installations.map(async (installation) => {
        let repositories: InstallationSummary["repositories"];

        try {
          const available = await github.getInstallationRepositories(
            installation.githubId,
          );

          repositories = available.map((repository) => ({
            githubId: repository.id,
            fullName: repository.fullName,
            defaultBranch: repository.defaultBranch,
            connected: connectedByGithubId.has(repository.id),
          }));
        } catch (error) {
          // Falling back to the database keeps the dashboard usable during a
          // GitHub outage, but it must be logged: silently returning a partial
          // list makes repositories appear to disappear with no diagnostics.
          logger.warn(
            { error, installationId: installation.githubId },
            "github.installations.repos_unavailable",
          );

          repositories = installation.repositories.map((repository) => ({
            githubId: repository.githubId,
            fullName: repository.fullName,
            defaultBranch: repository.defaultBranch,
            connected: true,
          }));
        }

        return {
          id: installation.id,
          githubId: installation.githubId,
          accountLogin: installation.accountLogin,
          accountType: installation.accountType,
          repositories,
        };
      }),
    );
  }

  private async upsertRepository(input: {
    githubId: number;
    owner: string;
    name: string;
    fullName: string;
    defaultBranch: string;
    installationId: number;
    senderGithubId?: number;
  }) {
    const installation = await this.findOrCreateInstallation({
      githubId: input.installationId,
      // Only the repository owner is known here, not the account the app was
      // installed on, so the account fields are left untouched on update.
      // Overwriting them would relabel an organisation installation as a user
      // account on the first pull request it receives.
      accountLogin: input.owner,
      accountType: "User",
      authoritativeAccount: false,
      senderGithubId: input.senderGithubId,
    });

    return prisma.repository.upsert({
      where: { githubId: input.githubId },
      create: {
        githubId: input.githubId,
        owner: input.owner,
        name: input.name,
        fullName: input.fullName,
        defaultBranch: input.defaultBranch,
        installationId: installation.id,
      },
      update: {
        defaultBranch: input.defaultBranch,
        installationId: installation.id,
      },
    });
  }

  private async findOrCreateInstallation(input: {
    githubId: number;
    accountLogin: string;
    accountType: string;
    senderGithubId?: number;
    /**
     * True when the account fields came from the `installation` event and are
     * therefore the real account. False when only the repository owner is
     * known, in which case existing values are preserved.
     */
    authoritativeAccount?: boolean;
  }) {
    let userId: string | undefined;

    if (input.senderGithubId) {
      const user = await prisma.user.findUnique({
        where: { githubId: input.senderGithubId },
        select: { id: true },
      });

      userId = user?.id;
    }

    const authoritative = input.authoritativeAccount ?? true;

    return prisma.installation.upsert({
      where: { githubId: input.githubId },
      create: {
        githubId: input.githubId,
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        userId,
        installedByGithubId: input.senderGithubId,
      },
      update: {
        ...(authoritative
          ? {
              accountLogin: input.accountLogin,
              accountType: input.accountType,
            }
          : {}),
        ...(userId ? { userId } : {}),
        // Always refreshed so the claim-on-sign-in backfill has a current value
        // after a reinstall.
        ...(input.senderGithubId
          ? { installedByGithubId: input.senderGithubId }
          : {}),
      },
    });
  }
}

export const githubService = new GitHubService();
