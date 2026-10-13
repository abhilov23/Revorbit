import type { AppContext } from "@/types/context";

export function success<T>(c: AppContext, data: T) {
  return c.json({
    success: true,
    data,
  });
}

export function noContent(c: AppContext) {
  return c.body(null, 204);
}
