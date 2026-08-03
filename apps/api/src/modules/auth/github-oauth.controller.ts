import { createId } from "@paralleldrive/cuid2";
import { setCookie } from "hono/cookie";
import type { Context } from "hono";

import { env } from "@/config/env";
import { githubOAuthService } from "./github-oauth.service";

const SESSION_COOKIE = "revorbit_session";

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: env.SESSION_TTL_SECONDS,
  };
}

class GithubOAuthController {
  async authorize(c: Context) {
    const state = createId();
    const url = githubOAuthService.getAuthorizeUrl(state);

    return c.json({
      success: true,
      data: {
        url,
        state,
      },
    });
  }

  async callback(c: Context) {
    const code = c.req.query("code");
    const state = c.req.query("state");

    if (!code || !state) {
      return c.redirect(`${env.WEB_ORIGIN}/login?error=oauth_failed`);
    }

    try {
      const result = await githubOAuthService.authenticate(code);

      setCookie(c, SESSION_COOKIE, result.sessionId, sessionCookieOptions());

      return c.redirect(env.WEB_ORIGIN + "/dashboard");
    } catch {
      return c.redirect(`${env.WEB_ORIGIN}/login?error=oauth_failed`);
    }
  }
}

export const githubOAuthController = new GithubOAuthController();
