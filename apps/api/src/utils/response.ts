import type { Context } from "hono";

export function success<T>(c: Context, data: T) {
  return c.json({
    success: true,
    data,
  });
}

export function created<T>(c: Context, data: T) {
  return c.json(
    {
      success: true,
      data,
    },
    201,
  );
}

export function accepted<T>(c: Context, data: T) {
  return c.json(
    {
      success: true,
      data,
    },
    202,
  );
}

export function noContent(c: Context) {
  return c.body(null, 204);
}
