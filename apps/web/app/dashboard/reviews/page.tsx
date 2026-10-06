"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, GitPullRequest, History, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

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

const filters = ["All reviews", "In progress", "Completed", "Failed"] as const;
type ReviewFilter = (typeof filters)[number];

function matchesFilter(review: ReviewSummary, filter: ReviewFilter) {
  if (filter === "All reviews") return true;
  if (filter === "Completed") return review.status === "COMPLETED";
  if (filter === "Failed") return review.status === "FAILED";
  return review.status === "PENDING" || review.status === "IN_PROGRESS";
}

function statusVariant(status: string) {
  if (status === "COMPLETED") return "default" as const;
  if (status === "FAILED") return "destructive" as const;
  return "secondary" as const;
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
  const [filter, setFilter] = useState<ReviewFilter>("All reviews");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.get<ReviewSummary[]>("/reviews")
      .then((data) => { if (!cancelled) setReviews(data); })
      .catch(() => { if (!cancelled) setError("We couldn’t load your review history."); });
    return () => { cancelled = true; };
  }, []);

  const visibleReviews = useMemo(() => {
    if (!reviews) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return reviews.filter((review) => {
      if (!matchesFilter(review, filter)) return false;
      if (!normalizedQuery) return true;
      return `${review.repository} ${review.pullNumber} ${review.pullTitle}`
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [filter, query, reviews]);

  if (error) {
    return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><Card><CardContent className="py-10 text-center"><p className="text-sm text-muted-foreground">{error}</p><Button className="mt-5" variant="outline" onClick={() => window.location.reload()}>Try again</Button></CardContent></Card></main>;
  }

  if (!reviews) {
    return <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8"><div className="h-44 animate-pulse rounded-2xl bg-muted" /></main>;
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Pull request activity</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Review history</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            Browse the latest reviews completed across your connected repositories.
          </p>
        </div>
        <div className="rounded-xl border bg-background px-4 py-3">
          <p className="text-xs text-muted-foreground">Recent reviews available</p>
          <p className="mt-0.5 text-lg font-semibold">{reviews.length}</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search reviews"
              placeholder="Search repository or pull request"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>
          <div role="group" aria-label="Filter reviews" className="flex gap-1 overflow-x-auto rounded-xl border bg-background p-1">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
                className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${filter === item ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {reviews.length === 0 ? (
          <Card><CardContent className="py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted"><History className="size-5 text-muted-foreground" /></span>
            <h2 className="mt-4 font-semibold">No reviews yet</h2>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
              Once an enabled repository receives a new or updated pull request, Revorbit will process it and the review will appear here.
            </p>
            <Button className="mt-5" variant="outline" render={<Link href="/dashboard/repositories" />}>Manage repositories <ArrowRight data-icon="inline-end" /></Button>
          </CardContent></Card>
        ) : visibleReviews.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <GitPullRequest className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 font-medium">No matching reviews</p>
            <p className="mt-1 text-sm text-muted-foreground">Try another search or choose a different status.</p>
            <Button className="mt-4" variant="ghost" onClick={() => { setQuery(""); setFilter("All reviews"); }}>Clear filters</Button>
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {visibleReviews.map((review) => (
                <Link
                  key={review.id}
                  href={`/dashboard/reviews/${review.id}`}
                  className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><GitPullRequest className="size-4 text-muted-foreground" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {review.repository} <span className="text-muted-foreground">#{review.pullNumber}</span>
                      </p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{review.pullTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{review.model} · {review.commentCount} {review.commentCount === 1 ? "finding" : "findings"}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-between gap-4 pl-12 sm:justify-end sm:pl-0">
                    <div className="text-left sm:text-right">
                      <Badge variant={statusVariant(review.status)}>{review.status.replaceAll("_", " ")}</Badge>
                      <p className="mt-1.5 text-xs text-muted-foreground">{formatDate(review.createdAt)}</p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
