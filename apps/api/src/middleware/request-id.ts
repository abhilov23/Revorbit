import { createId } from "@paralleldrive/cuid2";
import { createMiddleware } from "hono/factory";

import { HEADER_REQUEST_ID } from "@/constants/headers";

export const requestIdMiddleware = createMiddleware(async (c, next) => {
  const requestId = c.req.header(HEADER_REQUEST_ID) ?? createId();

  c.set("requestId", requestId);

  c.header(HEADER_REQUEST_ID, requestId);

  await next();
});
