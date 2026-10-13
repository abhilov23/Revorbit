import type { ZodSchema } from "zod";
import { createMiddleware } from "hono/factory";

import { ValidationError } from "@/errors";

/**
 * Caps how much of a Zod issue tree is echoed to the client. The flattened tree
 * is unbounded and reflects the submitted payload back to the caller.
 */
function summariseIssues(error: { issues: unknown[] }): {
  fields: Record<string, string[]>;
  truncated: boolean;
} {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues as Array<{
    path?: unknown[];
    message?: string;
  }>) {
    const key = Array.isArray(issue.path) ? issue.path.join(".") : "_root";

    (fields[key] ??= []).push(issue.message ?? "Invalid value");

    if (Object.keys(fields).length > 25) {
      return { fields, truncated: true };
    }
  }

  return { fields, truncated: false };
}

export const validate = <T>(schema: ZodSchema<T>) =>
  createMiddleware(async (c, next) => {
    // `c.req.json()` throws a SyntaxError on an empty or malformed body, which
    // the error handler would surface as a 500 instead of a 422.
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ValidationError("Request body must be valid JSON");
    }

    const result = schema.safeParse(body);

    if (!result.success) {
      throw new ValidationError(
        "Validation failed",
        summariseIssues(result.error),
      );
    }

    c.set("validatedBody", result.data);

    await next();
  });
