import { prisma } from "@revorbit/database";

import { NotFoundError } from "@/errors";

class ReviewService {
  async listReviews(limit = 50) {
    const reviews = await prisma.review.findMany({
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
      createdAt: review.createdAt,
    }));
  }

  async getReview(reviewId: string) {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
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
      createdAt: review.createdAt,
      comments: review.comments.map((comment) => ({
        id: comment.id,
        filePath: comment.filePath,
        line: comment.line,
        severity: comment.severity,
        title: comment.title,
        body: comment.body,
        problemCode: comment.problemCode,
        fixedCode: comment.fixedCode,
      })),
    };
  }
}

export const reviewService = new ReviewService();
