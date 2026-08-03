import { Hono } from "hono";

import { requireAuth } from "@/middleware/auth";
import { reviewController } from "./review.controller";

const reviewRouter = new Hono();

reviewRouter.use("*", requireAuth);

reviewRouter.get("/", (c) => reviewController.list(c));

reviewRouter.get("/:reviewId", (c) => reviewController.get(c));

export default reviewRouter;
