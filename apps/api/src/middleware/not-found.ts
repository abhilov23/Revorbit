import type { Context } from "hono";

export function notFoundHandler(c: Context) {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    },
    404
  );
}