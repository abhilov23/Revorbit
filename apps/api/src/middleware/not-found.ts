import type { AppContext } from "@/types/context";

export function notFoundHandler(c: AppContext) {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    },
    404,
  );
}
