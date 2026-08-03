import type { Context } from "hono";

import { ValidationError } from "@/errors";
import { success, noContent } from "@/utils/response";
import { repositoryService } from "./repository.service";

class RepositoryController {
  async list(c: Context) {
    const repositories = await repositoryService.listRepositories();
    return success(c, repositories);
  }

  async connect(c: Context) {
    const userId = c.get("userId");
    const input = c.get("validatedBody");

    const repository = await repositoryService.connectRepository(userId, input);
    return success(c, repository);
  }

  async disconnect(c: Context) {
    const userId = c.get("userId");
    const repositoryId = c.req.param("repositoryId");

    if (!repositoryId) {
      throw new ValidationError("Missing repository id");
    }

    await repositoryService.disconnectRepository(userId, repositoryId);
    return noContent(c);
  }

  async get(c: Context) {
    const repositoryId = c.req.param("repositoryId");

    if (!repositoryId) {
      throw new ValidationError("Missing repository id");
    }

    const repository = await repositoryService.getRepository(repositoryId);
    return success(c, repository);
  }

  async updateSettings(c: Context) {
    const repositoryId = c.req.param("repositoryId");

    if (!repositoryId) {
      throw new ValidationError("Missing repository id");
    }

    const input = c.get("validatedBody");

    const repository = await repositoryService.updateSettings(
      repositoryId,
      input,
    );

    return success(c, repository);
  }
}

export const repositoryController = new RepositoryController();
