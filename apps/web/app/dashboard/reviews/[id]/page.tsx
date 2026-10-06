"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Code2, GitPullRequest, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/lib/api";

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
  if (severity === "error") return "destructive" as const;
  if (severity === "warning") return "secondary" as const;
  return "outline" as const;
}

function statusVariant(status: string) {
  if (status === "COMPLETED") return "default" as const;
  if (status === "FAILED") return "destructive" as const;
  return "secondary" as const;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function ReviewDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<ReviewDetail>(`/reviews/${params.id}`)
      .then((data) => { if (!cancelled) setReview(data); })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          router.replace("/dashboard/reviews");
        }
      });
    return () => { cancelled = true; };
  }, [params.id, router]);

  if (error) return <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><p className="text-sm text-muted-foreground">Taking you back to review history…</p></main>;
  if (!review) return <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8"><div className="h-48 animate-pulse rounded-2xl bg-muted" /></main>;

  const errors = review.comments.filter((comment) => comment.severity === "error").length;
  const warnings = review.comments.filter((comment) => comment.severity === "warning").length;

  return (
    <main className="mx-auto max-w-5xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/dashboard/reviews" />}>
          <ArrowLeft data-icon="inline-start" /> Review history
        </Button>
        <div className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted"><GitPullRequest className="size-4" /></span>
              <p className="text-sm font-medium text-muted-foreground">{review.repository} <span className="mx-1">/</span> Pull request #{review.pullNumber}</p>
              <Badge variant={statusVariant(review.status)}>{review.status.replaceAll("_", " ")}</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{review.pullTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Reviewed {formatDate(review.createdAt)} <span className="mx-1.5">·</span> {review.model}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <div className="rounded-xl border bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Findings</p>
              <p className="mt-0.5 text-lg font-semibold">{review.comments.length}</p>
            </div>
            {errors > 0 && <div className="rounded-xl border bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Errors</p>
              <p className="mt-0.5 text-lg font-semibold text-destructive">{errors}</p>
            </div>}
            {warnings > 0 && <div className="rounded-xl border bg-background px-4 py-3">
              <p className="text-xs text-muted-foreground">Warnings</p>
              <p className="mt-0.5 text-lg font-semibold">{warnings}</p>
            </div>}
          </div>
        </div>
      </div>

      {review.summary && <Card>
        <CardHeader>
          <CardTitle className="text-base">Review summary</CardTitle>
          <CardDescription>Revorbit’s overview of this pull request</CardDescription>
        </CardHeader>
        <CardContent className="border-t py-5">
          <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{review.summary}</p>
        </CardContent>
      </Card>}

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Findings</h2>
            <p className="mt-1 text-sm text-muted-foreground">Inline issues identified during this review.</p>
          </div>
          <span className="text-sm text-muted-foreground">{review.comments.length} total</span>
        </div>

        {review.comments.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><Check className="size-5" /></span>
            <h3 className="mt-4 font-semibold">No inline findings</h3>
            <p className="mt-1 text-sm text-muted-foreground">This review did not produce any code comments.</p>
          </CardContent></Card>
        ) : (
          review.comments.map((comment) => (
            <Card key={comment.id}>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-base leading-6">{comment.title}</CardTitle>
                  <CardDescription className="mt-2 flex items-center gap-1.5 font-mono text-xs">
                    <Code2 className="size-3.5 shrink-0" />
                    <span className="truncate">{comment.filePath}</span><span className="shrink-0">:{comment.line}</span>
                  </CardDescription>
                </div>
                <Badge className="w-fit shrink-0" variant={severityVariant(comment.severity)}>
                  {comment.severity === "error" && <TriangleAlert data-icon="inline-start" />}
                  {comment.severity}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4 border-t py-5">
                <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{comment.body}</p>
                {comment.problemCode && <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current code</p>
                  <pre className="overflow-x-auto rounded-xl border bg-muted/50 p-4 text-xs leading-5"><code>{comment.problemCode}</code></pre>
                </div>}
                {comment.fixedCode && <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Suggested fix</p>
                  <pre className="overflow-x-auto rounded-xl border border-emerald-600/20 bg-emerald-500/5 p-4 text-xs leading-5"><code>{comment.fixedCode}</code></pre>
                </div>}
              </CardContent>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
