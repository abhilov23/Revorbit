import { prisma } from "@revorbit/database";

import { github } from "@/lib/github";
import { ForbiddenError, NotFoundError } from "@/errors";

export interface RepositorySummary {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  settings: {
    enabled: boolean;
    model: string;
    maxFiles: number;
    security: boolean;
    performance: boolean;
    bestPractices: boolean;
  };
}

class RepositoryService {
  async listRepositories(): Promise<RepositorySummary[]> {
    const repositories = await prisma.repository.findMany({
      include: {
        settings: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return repositories.map((repository) => ({
      id: repository.id,
      fullName: repository.fullName,
      owner: repository.owner,
      name: repository.name,
      defaultBranch: repository.defaultBranch,
      settings: {
        enabled: repository.settings?.enabled ?? true,
        model: repository.settings?.model ?? "gpt-4o-mini",
        maxFiles: repository.settings?.maxFiles ?? 20,
        security: repository.settings?.security ?? true,
        performance: repository.settings?.performance ?? true,
        bestPractices: repository.settings?.bestPractices ?? true,
      },
    }));
  }

  async getRepository(repositoryId: string): Promise<RepositorySummary> {
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        settings: true,
      },
    });

    if (!repository) {
      throw new NotFoundError("Repository not found");
    }

    return {
      id: repository.id,
      fullName: repository.fullName,
      owner: repository.owner,
      name: repository.name,
      defaultBranch: repository.defaultBranch,
      settings: {
        enabled: repository.settings?.enabled ?? true,
        model: repository.settings?.model ?? "gpt-4o-mini",
        maxFiles: repository.settings?.maxFiles ?? 20,
        security: repository.settings?.security ?? true,
        performance: repository.settings?.performance ?? true,
        bestPractices: repository.settings?.bestPractices ?? true,
      },
    };
  }

  async connectRepository(
    userId: string,
    input: { installationId: string; githubId: number },
  ): Promise<RepositorySummary> {
    const installation = await prisma.installation.findUnique({
      where: { id: input.installationId },
    });

    if (!installation) {
      throw new NotFoundError("GitHub installation not found");
    }

    if (installation.userId !== userId) {
      throw new ForbiddenError("You do not own this installation");
    }

    const available = await github.getInstallationRepositories(
      installation.githubId,
    );

    const match = available.find((repo) => repo.id === input.githubId);

    if (!match) {
      throw new NotFoundError(
        "Repository is not accessible through this installation",
      );
    }

    const repository = await prisma.repository.upsert({
      where: { githubId: match.id },
      create: {
        githubId: match.id,
        owner: match.owner,
        name: match.name,
        fullName: match.fullName,
        defaultBranch: match.defaultBranch,
        installationId: installation.id,
      },
      update: {
        defaultBranch: match.defaultBranch,
      },
    });

    await prisma.repositorySettings.upsert({
      where: { repositoryId: repository.id },
      create: { repositoryId: repository.id },
      update: {},
    });

    return this.getRepository(repository.id);
  }

  async disconnectRepository(userId: string, repositoryId: string) {
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
      include: {
        installation: true,
      },
    });

    if (!repository) {
      throw new NotFoundError("Repository not found");
    }

    if (repository.installation.userId !== userId) {
      throw new ForbiddenError("You do not own this repository");
    }

    await prisma.repository.delete({
      where: { id: repositoryId },
    });
  }

  async updateSettings(
    repositoryId: string,
    input: {
      enabled?: boolean;
      security?: boolean;
      performance?: boolean;
      bestPractices?: boolean;
      model?: string;
      maxFiles?: number;
    },
  ): Promise<RepositorySummary> {
    const repository = await prisma.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new NotFoundError("Repository not found");
    }

    await prisma.repositorySettings.upsert({
      where: { repositoryId },
      create: {
        repositoryId,
        ...input,
      },
      update: input,
    });

    return this.getRepository(repositoryId);
  }
}

export const repositoryService = new RepositoryService();
