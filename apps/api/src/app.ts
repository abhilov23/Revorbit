import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import routes from "@/routes";
import { env } from "@/config/env";
import type { Variables } from "@/types/context";
import { requestIdMiddleware } from "./middleware/request-id";
import { loggerMiddleware } from "./middleware/logger";
import { notFoundHandler } from "./middleware/not-found";
import { errorHandler } from "./middleware/error-handler";
import { apiRateLimit } from "./middleware/rate-limit";
import { bodyLimitMiddleware } from "./middleware/body-limit";
import { csrfProtection } from "./middleware/csrf";
import { idempotency } from "./middleware/idempotency";

const app = new Hono<{ Variables: Variables }>();

// Global middleware
app.use("*", requestIdMiddleware);
app.use("*", secureHeaders());
app.use("*", loggerMiddleware);
app.use("*", bodyLimitMiddleware);
// Runs before the rate limiter so a forged cross-site request is rejected
// without consuming a slot in the caller's budget.
app.use("*", csrfProtection);
app.use("*", idempotency);
app.use(
  "*",
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    // `Idempotency-Key` must be listed here or the browser rejects the
    // preflight and blocks every mutating request before it is sent.
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "Idempotency-Key",
    ],
    exposeHeaders: [
      "Idempotency-Replayed",
      "X-RateLimit-Remaining",
      "x-request-id",
    ],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use("/api/v1/*", apiRateLimit);

// Routes
app.route(env.API_PREFIX, routes);

//Not Found Handler
app.notFound(notFoundHandler);

// Error Handler
app.onError(errorHandler);

export default app;
