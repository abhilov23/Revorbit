import { logger } from "@/lib/logger";
import { createMiddleware } from "hono/factory";

export const loggerMiddleware = createMiddleware(async (c, next) => {
  const start = performance.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = c.get("requestId");

  await next();

  const duration = performance.now() - start;
  logger.info(
    {
      requestId,
      method,
      path,
      status: c.res.status,
      duration: `${duration.toFixed(2)}ms`,
    },
    "HTTP Request",
  );
});
