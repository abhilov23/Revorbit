import type { Context } from "hono";

import { github } from "@/lib/github";

import { createWebhook, GITHUB_HEADERS } from "@revorbit/github";

import { env } from "@/config/env";
import { success } from "@/utils/response";
import { UnauthorizedError, ValidationError } from "@/errors";
import { githubService } from "./github.service";

const webhook = createWebhook(env.GITHUB_WEBHOOK_SECRET);

class GitHubController {
  async webhook(c: Context) {
    const payload = await c.req.text();
    const event = c.req.header(GITHUB_HEADERS.EVENT) ?? "";
    const delivery = c.req.header(GITHUB_HEADERS.DELIVERY) ?? "";
    const signature = c.req.header(GITHUB_HEADERS.SIGNATURE) ?? "";

    if (!payload) {
      throw new ValidationError("Missing webhook payload");
    }

    if (!signature) {
      throw new ValidationError(`Missing ${GITHUB_HEADERS.SIGNATURE} header`);
    }

    if (!event) {
      throw new ValidationError(`Missing ${GITHUB_HEADERS.EVENT} header`);
    }

    if (!delivery) {
      throw new ValidationError(`Missing ${GITHUB_HEADERS.DELIVERY} header`);
    }

    const valid = await webhook.verifySignature(payload, signature);

    if (!valid) {
      throw new UnauthorizedError("Invalid webhook signature");
    }

    const webhookPayload = JSON.parse(payload);

    if (event === "pull_request") {
      const result = await githubService.handlePullRequest(webhookPayload);
      return success(c, result);
    }

    if (event === "installation") {
      const result = await githubService.handleInstallation(webhookPayload);
      return success(c, result);
    }

    if (event === "installation_repositories") {
      const result = await githubService.handleInstallationRepositories(
        webhookPayload,
      );
      return success(c, result);
    }

    return success(c, {
      ignored: true,
    });
  }

  async getAuthenticatedApp(c: Context) {
    const { data } = await github.app.rest.apps.getAuthenticated();

    const installUrl = data?.slug
      ? `https://github.com/apps/${data.slug}/installations/new`
      : undefined;

    return success(c, {
      id: data?.id,
      slug: data?.slug,
      name: data?.name,
      htmlUrl: data?.html_url,
      installUrl,
    });
  }

  async listInstallations(c: Context) {
    const userId = c.get("userId");

    const installations = await githubService.listInstallationsForUser(userId);

    return success(c, installations);
  }
}

export const githubController = new GitHubController();
