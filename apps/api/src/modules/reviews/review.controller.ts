import type { Context } from "hono";

import { ValidationError } from "@/errors";
import { success } from "@/utils/response";
import { reviewService } from "./review.service";

class ReviewController {
  async list(c: Context) {
    const reviews = await reviewService.listReviews();
    return success(c, reviews);
  }

  async get(c: Context) {
    const reviewId = c.req.param("reviewId");

    if (!reviewId) {
      throw new ValidationError("Missing review id");
    }

    const review = await reviewService.getReview(reviewId);
    return success(c, review);
  }
}

export const reviewController = new ReviewController();
