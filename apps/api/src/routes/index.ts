import { Hono } from "hono";
import type { AppEnv } from "@/types/context";
import authRouter from "@/modules/auth/auth.route";
import healthRouter from "@/modules/health/health.route";
import githubRouter from "@/modules/github/github.route";
import issuesRouter from "@/modules/issues/issue.route";
import repositoryRouter from "@/modules/repositories/repository.route";
import reviewRouter from "@/modules/reviews/review.route";
import settingsRouter from "@/modules/settings/settings.route";

const routes = new Hono<AppEnv>();

routes.route("/health", healthRouter);
routes.route("/github", githubRouter);
routes.route("/auth", authRouter);
routes.route("/repositories", repositoryRouter);
routes.route("/reviews", reviewRouter);
routes.route("/issues", issuesRouter);
routes.route("/settings", settingsRouter);
export default routes;
