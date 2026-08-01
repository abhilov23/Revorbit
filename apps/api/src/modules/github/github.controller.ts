// apps/api/src/modules/github/github.controller.ts

import type { Context } from "hono";

import { github } from "@/lib/github";

import { createWebhook, GITHUB_HEADERS } from "@mergeguard/github";

import { env } from "@/config/env";
import { success } from "@/utils/response";
import { UnauthorizedError, ValidationError } from "@/errors";

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

    if (event !== "pull_request") {
      return success(c, {
        ignored: true,
      });
    }

    if (webhookPayload.action !== "opened") {
      return success(c, {
        ignored: true,
      });
    }

    const owner = webhookPayload.repository.owner.login;

    const repo = webhookPayload.repository.name;

    const pullNumber = webhookPayload.pull_request.number;

    const installationId = webhookPayload.installation.id;

    const octokit = await github.getInstallationClient(installationId);

    console.log(octokit);

    console.log({
      owner,
      repo,
      pullNumber,
      installationId,
    });

    return success(c, {
      owner,
      repo,
      pullNumber,
      installationId,
    });
  }

  async getAuthenticatedApp(c: Context) {
    const { data } = await github.app.rest.apps.getAuthenticated();

    if (!data) {
      throw new Error("GitHub App authentication failed.");
    }

    return success(c, {
      id: data.id,
      slug: data.slug,
      name: data.name,
      htmlUrl: data.html_url,
    });
  }
}

export const githubController = new GitHubController();
