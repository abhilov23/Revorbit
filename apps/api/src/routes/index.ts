import { Hono } from "hono";
import authRouter from "@/modules/auth/auth.route";
import healthRouter from "@/modules/health/health.route";
import githubRouter from "@/modules/github/github.route";
import repositoryRouter from "@/modules/repositories/repository.route";
import reviewRouter from "@/modules/reviews/review.route";

const routes = new Hono();

routes.route("/health", healthRouter);
routes.route("/github", githubRouter);
routes.route("/auth", authRouter);
routes.route("/repositories", repositoryRouter);
routes.route("/reviews", reviewRouter);
export default routes;
