import { prisma } from "@revorbit/database";
import { github } from "@/lib/github";
import { createRedis, createReviewsQueue } from "@revorbit/queue";
import { REVIEW_STATUS, type ReviewRequest } from "@revorbit/shared";

import { redisConfig } from "@/config/env";

interface PullRequestEvent {
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
  };
  sender?: { id: number };
}

interface InstallationEvent {
  action: string;
  installation: {
    id: number;
    account: { login: string; type: string };
  };
  sender?: { id: number };
}

interface InstallationRepositoriesEvent {
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

export interface WebhookResult {
  processed: boolean;
  reviewId?: string;
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

class GitHubService {
  async handlePullRequest(payload: PullRequestEvent): Promise<WebhookResult> {
    if (payload.action !== "opened" && payload.action !== "synchronize") {
      return { processed: false };
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
      return { processed: false };
    }

    const pullRequest = await github.getPullRequest(
      installationId,
      owner,
      repo,
      pullNumber,
    );

    const files = await github.getPullRequestFiles(
      installationId,
      owner,
      repo,
      pullNumber,
    );

    const existing = await prisma.review.findFirst({
      where: {
        repositoryId: repository.id,
        pullNumber,
        headSha: pullRequest.headSha,
        status: {
          in: [
            REVIEW_STATUS.PENDING,
            REVIEW_STATUS.IN_PROGRESS,
            REVIEW_STATUS.COMPLETED,
          ],
        },
      },
      select: { id: true },
    });

    if (existing) {
      return { processed: true, reviewId: existing.id };
    }

    const review = await prisma.review.create({
      data: {
        repositoryId: repository.id,
        pullNumber,
        pullTitle: pullRequest.title,
        headSha: pullRequest.headSha,
        status: REVIEW_STATUS.PENDING,
        model: settings.model,
      },
    });

    const request: ReviewRequest = {
      reviewId: review.id,
      repository: {
        owner,
        name: repo,
        installationId,
      },
      pullRequest: {
        number: pullNumber,
        title: pullRequest.title,
        headSha: pullRequest.headSha,
      },
      files: files.slice(0, settings.maxFiles),
      model: settings.model,
    };

    await reviewsQueue.enqueue(request);

    return { processed: true, reviewId: review.id };
  }

  async handleInstallation(payload: InstallationEvent): Promise<WebhookResult> {
    if (payload.action !== "created") {
      return { processed: false };
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
        await prisma.repository.deleteMany({
          where: { githubId: { in: githubIds } },
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
        repositories: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const connectedByGithubId = new Map(
      installations.flatMap((installation) =>
        installation.repositories.map((repository) => [
          repository.githubId,
          repository,
        ]),
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
        } catch {
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

  private async findOrCreateInstallation(input: {
    githubId: number;
    accountLogin: string;
    accountType: string;
    senderGithubId?: number;
  }) {
    let userId: string | undefined;

    if (input.senderGithubId) {
      const user = await prisma.user.findUnique({
        where: { githubId: input.senderGithubId },
        select: { id: true },
      });

      userId = user?.id;
    }

    return prisma.installation.upsert({
      where: { githubId: input.githubId },
      create: {
        githubId: input.githubId,
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        userId,
      },
      update: {
        accountLogin: input.accountLogin,
        accountType: input.accountType,
        ...(userId ? { userId } : {}),
      },
    });
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
      accountLogin: input.owner,
      accountType: "User",
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
        owner: input.owner,
        name: input.name,
        defaultBranch: input.defaultBranch,
      },
    });
  }
}

export const githubService = new GitHubService();

const redis = createRedis(redisConfig);
const reviewsQueue = createReviewsQueue(redis);
