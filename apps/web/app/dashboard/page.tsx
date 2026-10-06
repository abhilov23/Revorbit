"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleDot,
  GitBranch,
  History,
  Plus,
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
import { api } from "@/lib/api";

interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  login: string | null;
  avatarUrl: string | null;
}

interface RepositorySummary {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  settings: {
    enabled: boolean;
    model: string;
  };
}

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

interface DashboardData {
  user: UserProfile;
  repositories: RepositorySummary[];
  reviews: ReviewSummary[];
}

function statusVariant(status: string) {
  if (status === "COMPLETED") return "default" as const;
  if (status === "FAILED") return "destructive" as const;
  return "secondary" as const;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get<{ user: UserProfile }>("/auth/me"),
      api.get<RepositorySummary[]>("/repositories"),
      api.get<ReviewSummary[]>("/reviews"),
    ])
      .then(([auth, repositories, reviews]) => {
        if (!cancelled) setData({ user: auth.user, repositories, reviews });
      })
      .catch(() => {
        if (!cancelled) setError("We couldn’t load your workspace.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <Card className="mx-auto max-w-xl">
          <CardContent className="py-10 text-center">
            <p className="font-medium">{error}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check your connection and try again.
            </p>
            <Button className="mt-5" variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      </main>
    );
  }

  const enabledRepositories = data.repositories.filter(
    (repository) => repository.settings.enabled,
  ).length;
  const greeting = data.user.name?.split(" ")[0] ?? data.user.login ?? "there";

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Your workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Good to see you, {greeting}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            Keep an eye on your connected repositories and the latest pull request reviews.
          </p>
        </div>
        <Button render={<Link href="/dashboard/repositories" />}>
          <Plus data-icon="inline-start" />
          Connect repository
        </Button>
      </section>

      <section aria-label="Workspace summary" className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground">
              <GitBranch className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Connected repositories</p>
              <p className="mt-0.5 text-2xl font-semibold">{data.repositories.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <Check className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Automatic reviews on</p>
              <p className="mt-0.5 text-2xl font-semibold">{enabledRepositories}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground">
              <History className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Recent reviews</p>
              <p className="mt-0.5 text-2xl font-semibold">{data.reviews.length}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {data.repositories.length === 0 ? (
        <Card className="overflow-hidden">
          <CardContent className="grid gap-8 p-6 sm:p-9 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <GitBranch className="size-5" />
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">Start with a GitHub repository</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Install the Revorbit GitHub App, choose a repository, and reviews will appear here when pull requests are opened or updated.
              </p>
            </div>
            <Button render={<Link href="/dashboard/repositories" />}>
              Set up repositories <ArrowRight data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Repositories</CardTitle>
                <CardDescription className="mt-1">
                  Repositories connected to Revorbit
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" render={<Link href="/dashboard/repositories" />}>
                View all <ArrowRight data-icon="inline-end" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.repositories.slice(0, 5).map((repository) => (
                <Link
                  key={repository.id}
                  href={`/dashboard/repositories/${repository.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <GitBranch className="size-4 text-muted-foreground" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{repository.fullName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{repository.settings.model}</p>
                    </div>
                  </div>
                  <Badge variant={repository.settings.enabled ? "default" : "secondary"}>
                    {repository.settings.enabled ? "Active" : "Paused"}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Latest reviews</CardTitle>
                <CardDescription className="mt-1">
                  Pull requests recently processed by Revorbit
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" render={<Link href="/dashboard/reviews" />}>
                View history <ArrowRight data-icon="inline-end" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.reviews.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <CircleDot className="mx-auto size-5 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">No reviews yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    A review will show up when an enabled repository gets a pull request.
                  </p>
                </div>
              ) : (
                data.reviews.slice(0, 5).map((review) => (
                  <Link
                    key={review.id}
                    href={`/dashboard/reviews/${review.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {review.repository} <span className="text-muted-foreground">#{review.pullNumber}</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{review.pullTitle}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge variant={statusVariant(review.status)}>{review.status.replaceAll("_", " ")}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}
