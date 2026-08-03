"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ReviewDetail {
  id: string;
  pullNumber: number;
  pullTitle: string;
  repository: string;
  status: string;
  summary: string | null;
  model: string;
  createdAt: string;
  comments: Array<{
    id: string;
    filePath: string;
    line: number;
    severity: string;
    title: string;
    body: string;
    problemCode: string;
    fixedCode: string;
  }>;
}

function severityVariant(severity: string) {
  switch (severity) {
    case "error":
      return "destructive";
    case "warning":
      return "secondary";
    default:
      return "outline";
  }
}

export default function ReviewDetailPage() {
  const params = useParams<{ reviewId: string }>();
  const router = useRouter();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get<ReviewDetail>(`/reviews/${params.reviewId}`)
      .then((data) => {
        if (!cancelled) setReview(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Review not found");
          router.replace("/dashboard/reviews");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.reviewId, router]);

  if (error) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!review) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="text-muted-foreground">Loading review...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {review.repository}#{review.pullNumber}
          </h1>
          <Badge>{review.status}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">
          {review.pullTitle} · {review.model}
        </p>
      </div>

      {review.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap">{review.summary}</CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {review.comments.length === 0 && (
          <p className="text-muted-foreground">No comments in this review.</p>
        )}
        {review.comments.map((comment) => (
          <Card key={comment.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {comment.filePath}:{comment.line}
                </span>
                <Badge variant={severityVariant(comment.severity)}>
                  {comment.severity}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="font-medium">{comment.title}</p>
              <p className="text-sm text-muted-foreground">{comment.body}</p>
              {comment.problemCode && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-destructive">
                    Problem code
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                    {comment.problemCode}
                  </pre>
                </div>
              )}
              {comment.fixedCode && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-emerald-600">
                    Fixed code
                  </p>
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
                    {comment.fixedCode}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
