import { createMiddleware } from "hono/factory";

import { env } from "@/config/env";
import { ValidationError } from "@/errors";

/**
 * Rejects oversized bodies from the declared Content-Length before the body is
 * buffered, so a single request cannot force a large allocation. Chunked
 * requests without a Content-Length fall through to `validate()`, which still
 * bounds what is parsed.
 */
export const bodyLimitMiddleware = createMiddleware(async (c, next) => {
  const declared = c.req.header("content-length");

  if (declared) {
    const size = Number(declared);

    if (Number.isFinite(size) && size > env.MAX_BODY_BYTES) {
      throw new ValidationError("Request body is too large");
    }
  }

  await next();
});
