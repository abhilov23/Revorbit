import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";

import { UnauthorizedError } from "@/errors";
import { sessionStore } from "@/lib/session";

const SESSION_COOKIE = "revorbit_session";

export const requireAuth = createMiddleware(async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE);

  if (!sessionId) {
    throw new UnauthorizedError("Not authenticated");
  }

  const userId = await sessionStore.get(sessionId);

  if (!userId) {
    throw new UnauthorizedError("Session expired or invalid");
  }

  c.set("userId", userId);

  await next();
});
