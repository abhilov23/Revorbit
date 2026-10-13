import type { AppContext } from "@/types/context";

import { env } from "@/config/env";
import { setSessionCookie } from "@/lib/cookies";
import { oauthStateStore } from "@/lib/oauth-state";
import { logger } from "@/lib/logger";
import { githubOAuthService } from "./github-oauth.service";

class GithubOAuthController {
  async authorize(c: AppContext) {
    const state = await oauthStateStore.issue();
    const url = githubOAuthService.getAuthorizeUrl(state);

    return c.json({
      success: true,
      data: { url, state },
    });
  }

  async callback(c: AppContext) {
    const code = c.req.query("code");
    const state = c.req.query("state");

    const fail = () => c.redirect(`${env.WEB_ORIGIN}/login?error=oauth_failed`);

    if (!code || !state) {
      return fail();
    }

    // Without this check the flow is vulnerable to login CSRF: an attacker
    // completes their own OAuth flow and replays the resulting `code` against a
    // victim's browser, binding the victim to the attacker's GitHub account.
    const valid = await oauthStateStore.consume(state);
    if (!valid) {
      logger.warn("oauth.state.mismatch");
      return fail();
    }

    try {
      const result = await githubOAuthService.authenticate(code);

      setSessionCookie(c, result.sessionId);

      return c.redirect(env.WEB_ORIGIN + "/dashboard");
    } catch (error) {
      logger.error({ error }, "oauth.callback.failed");
      return fail();
    }
  }
}

export const githubOAuthController = new GithubOAuthController();
