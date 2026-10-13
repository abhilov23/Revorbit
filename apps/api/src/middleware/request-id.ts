import { createId } from "@paralleldrive/cuid2";
import { createMiddleware } from "hono/factory";

import { HEADER_REQUEST_ID } from "@/constants/headers";

/**
 * Client-supplied ids are accepted so a request can be traced across services,
 * but only in a constrained shape. An arbitrary header value is reflected into
 * the response and every log line, so unbounded input is a log-forging vector.
 */
const SAFE_REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

export const requestIdMiddleware = createMiddleware(async (c, next) => {
  const provided = c.req.header(HEADER_REQUEST_ID);
  const requestId =
    provided && SAFE_REQUEST_ID.test(provided) ? provided : createId();

  c.set("requestId", requestId);

  c.header(HEADER_REQUEST_ID, requestId);

  await next();
});
