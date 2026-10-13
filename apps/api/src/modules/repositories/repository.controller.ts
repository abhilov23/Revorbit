import type { AppContext } from "@/types/context";
import { requireUserId, validatedBody } from "@/types/context";

import { ValidationError } from "@/errors";
import { success, noContent } from "@/utils/response";
import { repositoryService } from "./repository.service";
import type {
  ConnectRepositoryInput,
  UpdateRepositorySettingsInput,
} from "@revorbit/validators";

class RepositoryController {
  async list(c: AppContext) {
    const repositories = await repositoryService.listRepositories(
      requireUserId(c),
    );
    return success(c, repositories);
  }

  async connect(c: AppContext) {
    const userId = requireUserId(c);
    const input = validatedBody<ConnectRepositoryInput>(c);

    const repository = await repositoryService.connectRepository(userId, input);
    return success(c, repository);
  }

  async disconnect(c: AppContext) {
    const userId = requireUserId(c);
    const repositoryId = c.req.param("repositoryId");

    if (!repositoryId) {
      throw new ValidationError("Missing repository id");
    }

    await repositoryService.disconnectRepository(userId, repositoryId);
    return noContent(c);
  }

  async get(c: AppContext) {
    const userId = requireUserId(c);
    const repositoryId = c.req.param("repositoryId");

    if (!repositoryId) {
      throw new ValidationError("Missing repository id");
    }

    const repository = await repositoryService.getRepository(
      userId,
      repositoryId,
    );
    return success(c, repository);
  }

  async updateSettings(c: AppContext) {
    const userId = requireUserId(c);
    const repositoryId = c.req.param("repositoryId");

    if (!repositoryId) {
      throw new ValidationError("Missing repository id");
    }

    const input = validatedBody<UpdateRepositorySettingsInput>(c);

    const repository = await repositoryService.updateSettings(
      userId,
      repositoryId,
      input,
    );

    return success(c, repository);
  }
}

export const repositoryController = new RepositoryController();
