import { prisma } from "@revorbit/database";
import { capabilitiesFor } from "@revorbit/shared";

import { NotFoundError } from "@/errors";

/**
 * Reviews are scoped through their repository's installation owner.
 *
 * Reviews contain verbatim source diffs produced by the AI, so returning an
 * unfiltered list would disclose another tenant's proprietary code.
 */
function ownedBy(userId: string) {
  return { repository: { installation: { userId } } };
}

class ReviewService {
  async listReviews(userId: string, limit = 50) {
    const reviews = await prisma.review.findMany({
      where: ownedBy(userId),
      include: {
        repository: true,
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    return reviews.map((review) => ({
      id: review.id,
      pullNumber: review.pullNumber,
      pullTitle: review.pullTitle,
      repository: review.repository.fullName,
      status: review.status,
      summary: review.summary,
      model: review.model,
      commentCount: review._count.comments,
      // Surfaced so the dashboard can label a review that did not cover the
      // whole pull request instead of presenting it as complete.
      partial: review.partial,
      createdAt: review.createdAt,
    }));
  }

  async getReview(userId: string, reviewId: string) {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, ...ownedBy(userId) },
      include: {
        repository: true,
        comments: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundError("Review not found");
    }

    return {
      id: review.id,
      pullNumber: review.pullNumber,
      pullTitle: review.pullTitle,
      repository: review.repository.fullName,
      status: review.status,
      summary: review.summary,
      model: review.model,
      partial: review.partial,
      partialReason: review.partialReason,
      chunksAnalyzed: review.chunksAnalyzed,
      chunksFailed: review.chunksFailed,
      createdAt: review.createdAt,
      comments: review.comments.map((comment) => ({
        id: comment.id,
        filePath: comment.filePath,
        line: comment.line,
        category: comment.category,
        severity: comment.severity,
        title: comment.title,
        body: comment.body,
        problemCode: comment.problemCode,
        fixedCode: comment.fixedCode,
        // False when the finding was published in the review body rather than
        // as an inline comment, because it had no anchorable diff line.
        inline: comment.inline,
      })),
    };
  }

  /** Capability summary for the repository a review belongs to. */
  async autonomyForReview(reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      select: {
        repository: {
          select: {
            settings: { select: { autonomyLevel: true } },
          },
        },
      },
    });

    const level = review?.repository.settings?.autonomyLevel ?? "OBSERVE";

    return { autonomyLevel: level, capabilities: capabilitiesFor(level) };
  }
}

export const reviewService = new ReviewService();
