import { Hono } from "hono";
import healthRouter from "@/modules/health/health.route";
import githubRouter from "@/modules/github/github.route";

const routes = new Hono();

routes.route("/health", healthRouter);
routes.route("/github", githubRouter);
export default routes;
