"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bug,
  FileWarning,
  GitBranch,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import type { IssueSummary } from "@/lib/api-types";
import { AUTONOMY_LABELS, formatDate } from "@/lib/format";

const TYPE_FILTERS = [
  "All issues",
  "Bug",
  "Feature",
  "Security",
  "Documentation",
  "Performance",
] as const;

type TypeFilter = (typeof TYPE_FILTERS)[number];

const TYPE_BY_LABEL: Record<Exclude<TypeFilter, "All issues">, string> = {
  Bug: "bug",
  Feature: "feature",
  Security: "security",
  Documentation: "documentation",
  Performance: "performance",
};

function statusVariant(status: IssueSummary["status"]) {
  if (status === "COMPLETED") return "default" as const;
  if (status === "FAILED") return "destructive" as const;
  return "secondary" as const;
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<IssueSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TypeFilter>("All issues");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<IssueSummary[]>("/issues")
      .then((data) => {
        setIssues(data);
        setError(null);
      })
      .catch((cause: unknown) => {
        setError(errorMessage(cause, "We couldn't load your issues."));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (issue: IssueSummary, action: "analyze" | "fix") => {
    setBusy(`${action}-${issue.id}`);
    setError(null);

    try {
      await api.post(`/issues/${issue.id}/${action}`);
      load();
    } catch (cause: unknown) {
      setError(
        errorMessage(
          cause,
          action === "fix"
            ? "We couldn't propose a fix. Check the repository's autonomy level."
            : "We couldn't queue that issue.",
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  const visible = useMemo(() => {
    if (!issues) return [];

    const normalized = query.trim().toLowerCase();

    return issues.filter((issue) => {
      if (
        filter !== "All issues" &&
        issue.issueType !== TYPE_BY_LABEL[filter]
      ) {
        return false;
      }

      if (!normalized) return true;

      return `${issue.repository} ${issue.number} ${issue.title}`
        .toLowerCase()
        .includes(normalized);
    });
  }, [filter, issues, query]);

  if (error && !issues) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-10 text-center"
        >
          <h1 className="text-xl font-semibold tracking-tight">
            We couldn&apos;t load your issues
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!issues) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="h-44 animate-pulse rounded-2xl bg-muted" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Issue intelligence
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Issues
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Issues opened on connected repositories are triaged automatically.
            Comment{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              revorbit fix
            </code>{" "}
            on an issue to ask for a proposed fix.
          </p>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map((label) => (
            <Button
              key={label}
              size="sm"
              variant={filter === label ? "default" : "outline"}
              aria-pressed={filter === label}
              onClick={() => setFilter(label)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search
            data-icon="inline-start"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search issues"
            aria-label="Search issues"
            className="pl-9"
          />
        </div>
      </section>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bug className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-medium">
              {issues.length === 0
                ? "No issues have been triaged yet"
                : "No issues match this filter"}
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              {issues.length === 0
                ? "Revorbit analyses issues as they are opened on connected repositories."
                : "Try a different type or clear the search."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y p-0">
            {visible.map((issue) => (
              <div
                key={issue.id}
                className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={statusVariant(issue.status)}>
                      {issue.status.replaceAll("_", " ")}
                    </Badge>
                    {issue.issueType && (
                      <Badge variant="outline">{issue.issueType}</Badge>
                    )}
                    {issue.confidence !== null && (
                      <span className="text-xs text-muted-foreground">
                        confidence {Math.round(issue.confidence * 100)}%
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm font-semibold">
                    {issue.repository}{" "}
                    <span className="font-normal text-muted-foreground">
                      #{issue.number}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm">{issue.title}</p>

                  {issue.summary && (
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                      {issue.summary}
                    </p>
                  )}

                  {issue.suspectedFiles.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {issue.suspectedFiles.slice(0, 5).map((path) => (
                        <span
                          key={path}
                          className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                        >
                          <FileWarning className="size-3" />
                          {path}
                        </span>
                      ))}
                      {issue.suspectedFiles.length > 5 && (
                        <span className="text-xs text-muted-foreground">
                          +{issue.suspectedFiles.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  {issue.fixBranch && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <GitBranch className="size-3.5" />
                      {issue.fixBranch}
                      {issue.fixPullNumber && (
                        <span>· pull request #{issue.fixPullNumber}</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(issue.createdAt)}
                  </span>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => runAction(issue, "analyze")}
                    >
                      <RefreshCw data-icon="inline-start" />
                      {busy === `analyze-${issue.id}`
                        ? "Queuing…"
                        : "Re-analyze"}
                    </Button>

                    {/*
                      Autonomy is resolved server-side; this only reflects it.
                      The endpoint rejects the call regardless, so a stale
                      client cannot escalate itself.
                    */}
                    {issue.fixPullNumber ? (
                      <Button
                        size="sm"
                        variant="outline"
                        render={
                          <a
                            href={`https://github.com/${issue.repository}/pull/${issue.fixPullNumber}`}
                            target="_blank"
                            rel="noreferrer"
                          />
                        }
                      >
                        <GitBranch data-icon="inline-start" />
                        View PR
                        <ArrowUpRight data-icon="inline-end" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={
                          busy !== null ||
                          !issue.canGenerateFix ||
                          issue.status !== "COMPLETED"
                        }
                        onClick={() => runAction(issue, "fix")}
                        title={
                          !issue.canGenerateFix
                            ? `${issue.repository} is set to ${AUTONOMY_LABELS[issue.autonomyLevel]} autonomy. Raise it to Propose to generate fixes.`
                            : issue.status !== "COMPLETED"
                              ? "Analyse this issue first."
                              : "Generate a fix and open a draft pull request"
                        }
                      >
                        <Sparkles data-icon="inline-start" />
                        {busy === `fix-${issue.id}`
                          ? "Queuing…"
                          : "Propose fix"}
                      </Button>
                    )}
                  </div>

                  {!issue.canGenerateFix && !issue.fixPullNumber && (
                    <p className="text-right text-[11px] leading-4 text-muted-foreground">
                      Needs Propose autonomy
                    </p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {visible.length > 0 && (
        <section className="rounded-2xl border bg-muted/30 px-5 py-5">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">How fixes are proposed</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                A fix requires the repository&apos;s autonomy to be at least{" "}
                <span className="font-medium text-foreground">Propose</span>.
                Revorbit opens a branch and a{" "}
                <span className="font-medium text-foreground">
                  draft pull request
                </span>{" "}
                so a human reviews it before anything merges.
              </p>
              <Button
                className="mt-3"
                size="sm"
                variant="outline"
                render={<Link href="/dashboard/repositories" />}
              >
                Review autonomy settings
                <ArrowUpRight data-icon="inline-end" />
              </Button>
            </div>
          </div>
        </section>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <TriangleAlert className="size-3.5" />
        Proposed fixes are drafts. Revorbit never merges its own changes.
      </p>
    </main>
  );
}
