"use client";

import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

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

interface AuthResponse {
  user: UserProfile;
}

interface DashboardData {
  user: UserProfile;
  repositories: RepositorySummary[];
  reviews: ReviewSummary[];
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get<AuthResponse>("/auth/me"),
      api.get<RepositorySummary[]>("/repositories"),
      api.get<ReviewSummary[]>("/reviews"),
    ])
      .then(([auth, repositories, reviews]) => {
        if (cancelled) return;
        setData({
          user: auth.user,
          repositories,
          reviews: reviews.slice(0, 5),
        });
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load dashboard");
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

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {data.user.name ?? data.user.login ?? "developer"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your repositories and review history.
          </p>
        </div>
        <Button render={<Link href="/dashboard/repositories" />}>
          Manage Repositories
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Installed Repositories</CardTitle>
            <CardDescription>
              {data.repositories.length} repository
              {data.repositories.length === 1 ? "" : "s"} connected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.repositories.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No repositories connected yet. Install the Revorbit GitHub App
                to get started.
              </p>
            )}
            {data.repositories.slice(0, 5).map((repository) => (
              <div
                key={repository.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{repository.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {repository.settings.model}
                  </p>
                </div>
                <Badge
                  variant={repository.settings.enabled ? "default" : "secondary"}
                >
                  {repository.settings.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Reviews</CardTitle>
            <CardDescription>Latest AI reviews on your PRs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.reviews.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No reviews yet. Reviews appear when the Revorbit GitHub App
                processes a pull request.
              </p>
            )}
            {data.reviews.map((review) => (
              <Link
                key={review.id}
                href={`/dashboard/reviews/${review.id}`}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div>
                  <p className="font-medium">
                    {review.repository}#{review.pullNumber}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {review.pullTitle}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {review.commentCount} comments
                  </span>
                  <Badge variant={statusColor(review.status)}>
                    {review.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
