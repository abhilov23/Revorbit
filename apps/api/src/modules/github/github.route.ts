import { Hono } from "hono";

import { githubController } from "./github.controller";

const githubRouter = new Hono();

githubRouter.post("/webhook", (c) => githubController.webhook(c));

githubRouter.get("/app", (c) => githubController.getAuthenticatedApp(c));

export default githubRouter;
