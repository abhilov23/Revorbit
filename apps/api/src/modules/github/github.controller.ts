import type { AppContext } from "@/types/context";
import { requireUserId } from "@/types/context";

import { github } from "@/lib/github";

import { createWebhook, GITHUB_EVENTS, GITHUB_HEADERS } from "@revorbit/github";

import { env } from "@/config/env";
import { success } from "@/utils/response";
import { UnauthorizedError, ValidationError } from "@/errors";
import { claimDelivery, releaseDelivery } from "@/lib/deliveries";
import { logger } from "@/lib/logger";
import { githubService } from "./github.service";
import type {
  InstallationEvent,
  InstallationRepositoriesEvent,
  IssueCommentEvent,
  IssueEvent,
  PullRequestEvent,
} from "./github.service";

const webhook = createWebhook(env.GITHUB_WEBHOOK_SECRET);

class GitHubController {
  async webhook(c: AppContext) {
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

    // Verified over the raw body, so the signature check must happen before the
    // payload is parsed or transformed in any way.
    const valid = await webhook.verifySignature(payload, signature);

    if (!valid) {
      throw new UnauthorizedError("Invalid webhook signature");
    }

    // A valid signature only proves the bytes match the configured secret; the
    // body can still be malformed JSON, which must be a 422 and not a 500.
    let body: unknown;
    try {
      body = JSON.parse(payload);
    } catch {
      throw new ValidationError("Webhook payload is not valid JSON");
    }

    // The delivery id is claimed before any work. GitHub redelivers events
    // (and offers a manual "Redeliver" button), so without this a single
    // logical event could be processed more than once.
    const action =
      typeof (body as { action?: unknown }).action === "string"
        ? (body as { action: string }).action
        : undefined;

    const claimed = await claimDelivery({
      id: delivery,
      event,
      action,
    });

    if (!claimed) {
      logger.info({ delivery, event }, "webhook.delivery_duplicate");

      return success(c, { ignored: true, reason: "duplicate delivery" });
    }

    try {
      return success(c, await this.dispatch(event, body, delivery));
    } catch (error) {
      // Release the claim so a redelivery can retry a transient failure.
      await releaseDelivery(delivery);
      throw error;
    }
  }

  private async dispatch(event: string, body: unknown, delivery: string) {
    if (event === GITHUB_EVENTS.PULL_REQUEST) {
      return githubService.handlePullRequest(
        body as PullRequestEvent,
        delivery,
      );
    }

    if (event === GITHUB_EVENTS.ISSUES) {
      return githubService.handleIssue(body as IssueEvent, delivery);
    }

    if (event === GITHUB_EVENTS.ISSUE_COMMENT) {
      return githubService.handleIssueComment(body as IssueCommentEvent);
    }

    if (event === GITHUB_EVENTS.INSTALLATION) {
      return githubService.handleInstallation(body as InstallationEvent);
    }

    if (event === GITHUB_EVENTS.INSTALLATION_REPOSITORIES) {
      return githubService.handleInstallationRepositories(
        body as InstallationRepositoriesEvent,
      );
    }

    return { ignored: true, event };
  }

  async getAuthenticatedApp(c: AppContext) {
    const { data } = await github.app.rest.apps.getAuthenticated();

    const installUrl = data?.slug
      ? `https://github.com/apps/${data.slug}/installations/new`
      : undefined;

    return success(c, {
      id: data?.id ?? null,
      slug: data?.slug ?? null,
      name: data?.name ?? null,
      htmlUrl: data?.html_url ?? null,
      installUrl,
    });
  }

  async listInstallations(c: AppContext) {
    const userId = requireUserId(c);

    const installations = await githubService.listInstallationsForUser(userId);

    return success(c, installations);
  }
}

export const githubController = new GitHubController();
