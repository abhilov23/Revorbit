"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface ReviewSummary {
  id: string;
  pullNumber: number;
  pullTitle: string;
  repository: string;
  status: string;
  model: string;
  commentCount: number;
  createdAt: string;
}

function statusColor(status: string) {
  switch (status) {
    case "COMPLETED":
      return "default";
    case "FAILED":
      return "destructive";
    default:
      return "secondary";
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get<ReviewSummary[]>("/reviews")
      .then((data) => {
        if (!cancelled) setReviews(data);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load reviews");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!reviews) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading reviews...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Review History</h1>
        <p className="mt-1 text-muted-foreground">
          All AI reviews performed by Revorbit.
        </p>
      </div>

      {reviews.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No reviews yet. Reviews appear after the Revorbit GitHub App
              processes a pull request.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {reviews.map((review) => (
          <Link
            key={review.id}
            href={`/dashboard/reviews/${review.id}`}
            className="block rounded-xl border transition-colors hover:bg-muted/50"
          >
            <Card className="border-0 shadow-none ring-0">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {review.repository}#{review.pullNumber}
                  </span>
                  <Badge variant={statusColor(review.status)}>
                    {review.status}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm">{review.pullTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {review.model} · {review.commentCount} comments
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatDate(review.createdAt)}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
