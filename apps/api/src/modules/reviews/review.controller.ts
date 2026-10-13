import type { AppContext } from "@/types/context";
import { requireUserId } from "@/types/context";

import { ValidationError } from "@/errors";
import { success } from "@/utils/response";
import { reviewService } from "./review.service";

class ReviewController {
  async list(c: AppContext) {
    const reviews = await reviewService.listReviews(requireUserId(c));
    return success(c, reviews);
  }

  async get(c: AppContext) {
    const userId = requireUserId(c);
    const reviewId = c.req.param("reviewId");

    if (!reviewId) {
      throw new ValidationError("Missing review id");
    }

    const review = await reviewService.getReview(userId, reviewId);
    return success(c, review);
  }
}

export const reviewController = new ReviewController();
