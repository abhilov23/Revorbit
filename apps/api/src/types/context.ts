import type { Context } from "hono";

/**
 * Values a handler can read off the context after middleware has run.
 *
 * This type only takes effect if it is threaded through every router. Sub-routers
 * declared as a bare `new Hono<AppEnv>()` default to `any` variables, which silently
 * erases `userId` and `validatedBody` at every route.
 */
export type Variables = {
  requestId: string;
  validatedBody: unknown;
  userId?: string;
};

export type AppEnv = { Variables: Variables };

/** Context bound to this app's variables, for handler signatures. */
export type AppContext = Context<AppEnv>;

/** Narrowing helper for `validatedBody`, which is `unknown` by design. */
export function validatedBody<T>(c: AppContext): T {
  return c.get("validatedBody") as T;
}

/**
 * Reads the authenticated user id.
 *
 * Throws rather than returning `undefined` so a route that forgot `requireAuth`
 * fails loudly rather than silently operating on `undefined`.
 */
export function requireUserId(c: AppContext): string {
  const userId = c.get("userId");

  if (!userId) {
    throw new Error("requireUserId called on an unauthenticated route");
  }

  return userId;
}
