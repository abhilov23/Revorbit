import { Hono } from "hono";

import { requireAuth } from "@/middleware/auth";
import { githubController } from "./github.controller";

const githubRouter = new Hono();

githubRouter.post("/webhook", (c) => githubController.webhook(c));

githubRouter.get("/app", (c) => githubController.getAuthenticatedApp(c));

githubRouter.get("/installations", requireAuth, (c) =>
  githubController.listInstallations(c),
);

export default githubRouter;
