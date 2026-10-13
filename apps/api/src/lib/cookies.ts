import { setCookie, deleteCookie, getCookie } from "hono/cookie";

import { env } from "@/config/env";
import type { AppContext } from "@/types/context";

export const SESSION_COOKIE = "revorbit_session";

/**
 * Whether the session cookie carries `Secure`.
 *
 * Derived from the configured web origin rather than `NODE_ENV`, because a
 * staging or preview deployment runs with `NODE_ENV=development` while still
 * being served over HTTPS — keying off the environment alone would send the
 * session cookie in the clear there.
 */
const SECURE_COOKIES = (() => {
  try {
    return new URL(env.WEB_ORIGIN).protocol === "https:";
  } catch {
    // Fail closed: an unparseable origin must not downgrade cookie security.
    return env.NODE_ENV === "production";
  }
})();

/** The session cookie contract, in one place so the controllers cannot drift. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: SECURE_COOKIES,
    sameSite: "lax" as const,
    path: "/",
    maxAge: env.SESSION_TTL_SECONDS,
  };
}

export function setSessionCookie(c: AppContext, sessionId: string): void {
  setCookie(c, SESSION_COOKIE, sessionId, sessionCookieOptions());
}

export function clearSessionCookie(c: AppContext): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export function readSessionCookie(c: AppContext): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}
