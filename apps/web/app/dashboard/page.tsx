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
  Sparkles,
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
import { demoRepositories, demoReviews } from "@/lib/demo-workspace";

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
  const [sample, setSample] = useState(false);

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
        if (!cancelled) {
          setSample(true);
          setData({
            user: { id: "sample-user", name: "Alex Morgan", email: "alex@example.com", login: "alexmorgan", avatarUrl: null },
            repositories: demoRepositories,
            reviews: demoReviews,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return (
      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8 sm:px-8 sm:py-10">
        <div className="h-40 animate-pulse rounded-3xl bg-muted" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
        </div>
        <div className="h-72 animate-pulse rounded-3xl bg-muted" />
      </main>
    );
  }

  const enabledRepositories = data.repositories.filter(
    (repository) => repository.settings.enabled,
  ).length;
  const greeting = data.user.name?.split(" ")[0] ?? data.user.login ?? "there";
  const hasRepositories = data.repositories.length > 0;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-7 sm:px-8 sm:py-10">
      <section className="relative overflow-hidden rounded-3xl border bg-background p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {sample ? "Sample workspace · preview data" : "Workspace overview"}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Good to see you, {greeting}.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              Your pull request reviews, connected repositories, and workspace activity—all in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="shrink-0" render={<Link href="/dashboard/ai-behavior" />}>Configure AI behavior</Button>
            <Button className="shrink-0" render={<Link href="/dashboard/repositories" />}>
              <Plus data-icon="inline-start" />
              Connect repository
            </Button>
          </div>
        </div>
      </section>

      <section aria-label="Workspace summary" className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-4 p-5 sm:p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300">
              <GitBranch className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Connected repositories</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{data.repositories.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-4 p-5 sm:p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              <Check className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Automatic reviews on</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{enabledRepositories}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-center gap-4 p-5 sm:p-6">
            <span className="flex size-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300">
              <History className="size-5" />
            </span>
            <div>
              <p className="text-sm text-muted-foreground">Recent reviews</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{data.reviews.length}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {!hasRepositories && (
        <section aria-labelledby="setup-title" className="overflow-hidden rounded-3xl border bg-background shadow-sm">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="max-w-2xl">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                <Sparkles className="size-5" />
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Get started
              </p>
              <h2 id="setup-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Your review workspace starts here
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
                Connect a GitHub repository and Revorbit will review pull requests as they open and change. Your review activity will show up here automatically.
              </p>
            </div>
            <Button className="shrink-0" size="lg" render={<Link href="/dashboard/repositories" />}>
              Set up repositories <ArrowRight data-icon="inline-end" />
            </Button>
          </div>
          <div className="grid border-t bg-muted/20 sm:grid-cols-3">
            <div className="border-b p-5 sm:border-b-0 sm:border-r sm:p-6">
              <span className="text-xs font-semibold text-muted-foreground">STEP 01</span>
              <p className="mt-2 text-sm font-medium">Install the GitHub App</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Give Revorbit access to the repositories you choose.</p>
            </div>
            <div className="border-b p-5 sm:border-b-0 sm:border-r sm:p-6">
              <span className="text-xs font-semibold text-muted-foreground">STEP 02</span>
              <p className="mt-2 text-sm font-medium">Choose your repositories</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Enable automatic reviews for the projects you want.</p>
            </div>
            <div className="p-5 sm:p-6">
              <span className="text-xs font-semibold text-muted-foreground">STEP 03</span>
              <p className="mt-2 text-sm font-medium">Review pull requests</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">Find completed reviews and feedback right here.</p>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
            <div>
              <CardTitle>Repositories</CardTitle>
              <CardDescription className="mt-1">
                {hasRepositories ? "Your connected projects" : "Projects connected to this workspace"}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" render={<Link href="/dashboard/repositories" />}>
              {hasRepositories ? "View all" : "Connect"} <ArrowRight data-icon="inline-end" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {hasRepositories ? (
              data.repositories.slice(0, 5).map((repository) => (
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
              ))
            ) : (
              <div className="rounded-xl border border-dashed px-5 py-8 text-center">
                <GitBranch className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">No repositories yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Connect a project to start building your review workspace.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
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
              <div className="rounded-xl border border-dashed px-5 py-8 text-center">
                <CircleDot className="mx-auto size-5 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Your review activity will appear here</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reviews show up when an enabled repository gets a pull request.
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
    </main>
  );
}
