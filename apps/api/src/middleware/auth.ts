import { createMiddleware } from "hono/factory";

import { UnauthorizedError } from "@/errors";
import { readSessionCookie } from "@/lib/cookies";
import { sessionStore } from "@/lib/session";

export const requireAuth = createMiddleware(async (c, next) => {
  const sessionId = readSessionCookie(c);

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
