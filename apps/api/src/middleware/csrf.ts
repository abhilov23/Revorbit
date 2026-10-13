import type { MiddlewareHandler } from "hono";

import { env } from "@/config/env";
import { ForbiddenError } from "@/errors";

/**
 * Methods that change state and therefore require an origin check.
 *
 * Cookie `SameSite=Lax` already blocks cross-site form posts in current
 * browsers, but it still allows top-level navigations and does not protect
 * against a compromised or attacker-controlled sibling subdomain. Validating
 * `Origin` closes that gap without requiring a token round-trip.
 */
const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Origins allowed to make credentialed requests.
 *
 * Parsed from configuration rather than compared as raw strings so a trailing
 * slash or a missing scheme fails closed at boot instead of silently
 * rejecting every legitimate request.
 */
const ALLOWED_ORIGINS = new Set(
  [env.CORS_ORIGIN, env.WEB_ORIGIN, env.GITHUB_OAUTH_REDIRECT_URI]
    .map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        // Invalid configuration is caught by env validation; skipping here
        // avoids masking that error with a CSRF error.
        return undefined;
      }
    })
    .filter((origin): origin is string => Boolean(origin)),
);

/**
 * Origin/Referer check for mutating requests.
 *
 * A browser always sends `Origin` on a cross-origin POST, PUT, PATCH or
 * DELETE, and on same-origin requests in every current browser. Requests with
 * neither header are rejected rather than trusted, which only affects non
 * browser clients such as `curl`.
 */
export const csrfProtection: MiddlewareHandler = async (c, next) => {
  if (!STATE_CHANGING.has(c.req.method)) {
    return next();
  }

  // The webhook is authenticated by an HMAC signature over the raw body, not by
  // a cookie, so it is not a CSRF vector and carries no browser Origin.
  if (
    c.req.path === "/api/v1/github/webhook" ||
    c.req.path.endsWith("/github/webhook")
  ) {
    return next();
  }

  const origin = c.req.header("origin");
  const referer = c.req.header("referer");

  const candidate = origin ?? safeOrigin(referer);

  if (!candidate) {
    throw new ForbiddenError(
      "Missing Origin header on a state-changing request",
    );
  }

  if (!ALLOWED_ORIGINS.has(candidate)) {
    throw new ForbiddenError("Origin is not allowed");
  }

  return next();
};

function safeOrigin(referer: string | undefined): string | undefined {
  if (!referer) {
    return undefined;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export { ALLOWED_ORIGINS };
