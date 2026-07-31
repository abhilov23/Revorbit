import { Hono } from "hono";

import { env } from "@/config/env";

const healthRouter = new Hono();

healthRouter.get("/", (c) => {
  return c.json({
    success: true,
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
    },
  });
});

export default healthRouter;