import { serve } from "@hono/node-server";

import app from "@/app";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

const server = serve(
  {
    fetch: app.fetch,
    port: env.PORT,
    hostname: env.HOST,
  },
  (info) => {
    logger.info(
      { port: info.port, host: env.HOST, env: env.NODE_ENV },
      "API server listening",
    );
  },
);

/**
 * Without this, SIGTERM (sent by Docker and most orchestrators on deploy and
 * restart) drops in-flight requests and leaves Redis connections open.
 */
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  logger.info({ signal }, "Shutting down API");

  await new Promise<void>((resolve) => server.close(() => resolve()));

  process.exit(0);
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
