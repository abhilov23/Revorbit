import type { ZodSchema } from "zod";
import { createMiddleware } from "hono/factory";

import { ValidationError } from "@/errors";

export const validate = <T>(schema: ZodSchema<T>) =>
  createMiddleware(async (c, next) => {
    const body = await c.req.json();

    const result = schema.safeParse(body);

    if (!result.success) {
      throw new ValidationError("Validation failed", result.error.flatten());
    }

    c.set("validatedBody", result.data);

    await next();
  });
