"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Code2,
  GitPullRequest,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api, errorMessage } from "@/lib/api";
import type { ReviewDetail } from "@/lib/api-types";
import {
  CATEGORY_LABELS,
  formatDateTime,
  severityVariant,
  statusVariant,
} from "@/lib/format";

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get<ReviewDetail>(`/reviews/${params.id}`)
      .then((data) => {
        if (!controller.signal.aborted) {
          setReview(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(errorMessage(cause, "We couldn't load this review."));

        // A 404 means the review does not exist for this user; anything else is
        // worth showing in place rather than bouncing to the list.
        const isMissing =
          cause instanceof Error && cause.message.includes("not found");

        if (isMissing) {
          router.replace("/dashboard/reviews");
        }
      });

    return () => controller.abort();
  }, [params.id, router]);

  if (!review && error) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-10 text-center"
        >
          <h1 className="text-xl font-semibold tracking-tight">
            We couldn&apos;t load this review
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {error}
          </p>
          <Button
            className="mt-5"
            variant="outline"
            render={<Link href="/dashboard/reviews" />}
          >
            Back to review history
          </Button>
        </div>
      </main>
    );
  }

  if (!review)
    return (
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </main>
    );

  const blocking = review.comments.filter(
    (c) => c.severity === "critical" || c.severity === "high",
  ).length;
  const moderate = review.comments.filter(
    (c) => c.severity === "medium" || c.severity === "low",
  ).length;

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/dashboard/reviews" />}
        >
          <ArrowLeft data-icon="inline-start" /> Review history
        </Button>
        <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <GitPullRequest className="size-4" />
              </span>
              <p className="text-sm font-medium text-muted-foreground">
                {review.repository} <span className="mx-1">/</span> Pull request
                #{review.pullNumber}
              </p>
              <Badge variant={statusVariant(review.status)}>
                {review.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              {review.pullTitle}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Reviewed {formatDateTime(review.createdAt)}{" "}
              <span className="mx-1.5">·</span> {review.model}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <div className="rounded-xl border bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Findings</p>
              <p className="mt-0.5 text-lg font-semibold">
                {review.comments.length}
              </p>
            </div>
            {blocking > 0 && (
              <div className="rounded-xl border bg-background px-4 py-3">
                <p className="text-xs text-muted-foreground">High / critical</p>
                <p className="mt-0.5 text-lg font-semibold text-destructive">
                  {blocking}
                </p>
              </div>
            )}
            {moderate > 0 && (
              <div className="rounded-xl border bg-background px-4 py-3">
                <p className="text-xs text-muted-foreground">Low / medium</p>
                <p className="mt-0.5 text-lg font-semibold">{moderate}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/*
        A partial review did not cover the whole pull request. Stating that is
        required; presenting it as a complete review would be misleading.
      */}
      {review.partial && (
        <div
          role="status"
          className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-4"
        >
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Partial review
          </p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {review.chunksFailed} of{" "}
            {review.chunksAnalyzed + review.chunksFailed} diff chunk(s) could
            not be analysed, so this review does not cover the entire pull
            request.
          </p>
          {review.partialReason && (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {review.partialReason}
            </p>
          )}
        </div>
      )}

      {review.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Review summary</CardTitle>
            <CardDescription>
              Revorbit’s overview of this pull request
            </CardDescription>
          </CardHeader>
          <CardContent className="border-t py-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
              {review.summary}
            </p>
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Findings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Inline issues identified during this review.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {review.comments.length} total
          </span>
        </div>

        {review.comments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                <Check className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">No inline findings</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                This review did not produce any code comments.
              </p>
            </CardContent>
          </Card>
        ) : (
          review.comments.map((comment) => (
            <Card key={comment.id}>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-base leading-6">
                    {comment.title}
                  </CardTitle>
                  <CardDescription className="mt-2 flex items-center gap-1.5 font-mono text-xs">
                    <Code2 className="size-3.5 shrink-0" />
                    <span className="truncate">{comment.filePath}</span>
                    <span className="shrink-0">:{comment.line}</span>
                  </CardDescription>
                </div>
                {!comment.inline && (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    No changed line to attach this to, so it was published in
                    the review body rather than inline here.
                  </p>
                )}
                <Badge
                  className="w-fit shrink-0"
                  variant={severityVariant(comment.severity)}
                >
                  {(comment.severity === "critical" ||
                    comment.severity === "high") && (
                    <TriangleAlert data-icon="inline-start" />
                  )}
                  {comment.severity} · {CATEGORY_LABELS[comment.category]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 border-t py-5">
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {comment.body}
                </p>
                {comment.problemCode && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Current code
                    </p>
                    <pre className="overflow-x-auto rounded-xl border bg-muted/50 p-4 text-xs leading-5">
                      <code>{comment.problemCode}</code>
                    </pre>
                  </div>
                )}
                {comment.fixedCode && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                      Suggested fix
                    </p>
                    <pre className="overflow-x-auto rounded-xl border border-emerald-600/20 bg-emerald-500/5 p-4 text-xs leading-5">
                      <code>{comment.fixedCode}</code>
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
