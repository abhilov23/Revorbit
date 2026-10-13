import { Prisma, prisma } from "@revorbit/database";
import { capabilitiesFor } from "@revorbit/shared";
import type {
  AgentCapability,
  AutonomyLevel,
  ReviewRole,
} from "@revorbit/shared";

import { github } from "@/lib/github";
import { env } from "@/config/env";
import { ForbiddenError, NotFoundError } from "@/errors";

export interface RepositorySummary {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  settings: {
    enabled: boolean;
    security: boolean;
    correctness: boolean;
    performance: boolean;
    style: boolean;
    role: ReviewRole;
    customPrompt: string | null;
    autonomyLevel: AutonomyLevel;
    /** Capabilities the current autonomy level grants, for UI display. */
    capabilities: readonly AgentCapability[];
    model: string;
    maxFiles: number;
    maxTokens: number;
  };
}

type RepositoryWithSettings = Prisma.RepositoryGetPayload<{
  include: { settings: true };
}>;

function toSummary(repository: RepositoryWithSettings): RepositorySummary {
  return {
    id: repository.id,
    fullName: repository.fullName,
    owner: repository.owner,
    name: repository.name,
    defaultBranch: repository.defaultBranch,
    settings: {
      enabled: repository.settings?.enabled ?? true,
      security: repository.settings?.security ?? true,
      correctness: repository.settings?.correctness ?? true,
      performance: repository.settings?.performance ?? true,
      style: repository.settings?.style ?? true,
      role: repository.settings?.role ?? "SECURITY_RESEARCHER",
      customPrompt: repository.settings?.customPrompt ?? null,
      autonomyLevel: repository.settings?.autonomyLevel ?? "SUGGEST",
      capabilities: capabilitiesFor(
        repository.settings?.autonomyLevel ?? "SUGGEST",
      ),
      model: repository.settings?.model ?? "gpt-4o-mini",
      maxFiles: repository.settings?.maxFiles ?? 20,
      maxTokens: repository.settings?.maxTokens ?? 4000,
    },
  };
}

/**
 * Narrows a repository to the installations owned by `userId`.
 *
 * Every read and write in this service goes through this filter. Repositories
 * are reachable through two independent foreign keys (`installationId` and the
 * reviews they hold), so scoping must be applied consistently or one route can
 * leak another tenant's data.
 */
function ownedBy(userId: string) {
  return { installation: { userId } };
}

class RepositoryService {
  async listRepositories(userId: string): Promise<RepositorySummary[]> {
    const repositories = await prisma.repository.findMany({
      where: ownedBy(userId),
      include: { settings: true },
      orderBy: { createdAt: "desc" },
    });

    return repositories.map(toSummary);
  }

  async getRepository(
    userId: string,
    repositoryId: string,
  ): Promise<RepositorySummary> {
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, ...ownedBy(userId) },
      include: { settings: true },
    });

    if (!repository) {
      // Same response for "does not exist" and "not yours" so repository ids
      // cannot be probed for existence.
      throw new NotFoundError("Repository not found");
    }

    return toSummary(repository);
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
        installationId: installation.id,
      },
    });

    // A newly connected repository inherits the account defaults. Seeding from
    // `UserSettings` rather than the schema defaults is what makes the
    // "default autonomy for new repositories" control mean anything.
    const defaults = await prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    await prisma.repositorySettings.upsert({
      where: { repositoryId: repository.id },
      create: {
        repositoryId: repository.id,
        // Falls back to the configured AI_MODEL so a new repository uses the
        // model the provider actually serves, rather than a hardcoded default.
        model: defaults.defaultModel ?? env.AI_MODEL ?? "gpt-4o-mini",
        maxFiles: defaults.defaultMaxFiles,
        autonomyLevel: defaults.defaultAutonomy,
      },
      update: {},
    });

    return this.getRepository(userId, repository.id);
  }

  async disconnectRepository(userId: string, repositoryId: string) {
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, ...ownedBy(userId) },
    });

    if (!repository) {
      throw new NotFoundError("Repository not found");
    }

    await prisma.repository.delete({
      where: { id: repositoryId },
    });
  }

  async updateSettings(
    userId: string,
    repositoryId: string,
    input: {
      enabled?: boolean;
      security?: boolean;
      correctness?: boolean;
      performance?: boolean;
      style?: boolean;
      role?: "REVIEWER" | "SECURITY_RESEARCHER" | "DEVELOPER" | "HELPER";
      customPrompt?: string | null;
      autonomyLevel?: AutonomyLevel;
      model?: string;
      maxFiles?: number;
      maxTokens?: number;
    },
  ): Promise<RepositorySummary> {
    // Ownership is checked before any write; without this, any authenticated
    // user could disable reviews or swap the model on another tenant's repo.
    await this.assertOwnership(userId, repositoryId);

    await prisma.repositorySettings.upsert({
      where: { repositoryId },
      create: { repositoryId, ...input },
      update: input,
    });

    return this.getRepository(userId, repositoryId);
  }

  private async assertOwnership(userId: string, repositoryId: string) {
    const repository = await prisma.repository.findFirst({
      where: { id: repositoryId, ...ownedBy(userId) },
      select: { id: true },
    });

    if (!repository) {
      throw new NotFoundError("Repository not found");
    }
  }
}

export const repositoryService = new RepositoryService();
