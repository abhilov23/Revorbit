"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Braces,
  Check,
  Code2,
  Eye,
  LockKeyhole,
  Save,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Zap,
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
import type { Persona, RepositorySummary } from "@/lib/api-types";
import { FOCUS_LABELS, ROLE_LABELS } from "@/lib/format";

type FocusKey = "security" | "correctness" | "performance" | "style";

const ROLES = [
  {
    id: "SECURITY_RESEARCHER",
    icon: ShieldCheck,
    tag: "Security-first",
  },
  {
    id: "REVIEWER",
    icon: SearchCheck,
    tag: "Balanced",
  },
  {
    id: "DEVELOPER",
    icon: Zap,
    tag: "Efficiency",
  },
  {
    id: "HELPER",
    icon: Braces,
    tag: "Your rules",
  },
] as const satisfies ReadonlyArray<{
  id: Persona;
  icon: typeof ShieldCheck;
  tag: string;
}>;

const FOCUS_OPTIONS = [
  {
    key: "security",
    title: "Security vulnerabilities",
    description: "Auth, injection, secrets, and unsafe access",
    icon: LockKeyhole,
  },
  {
    key: "correctness",
    title: "Correctness & bugs",
    description: "Logic errors, edge cases, and regressions",
    icon: Code2,
  },
  {
    key: "performance",
    title: "Performance",
    description: "Slow paths, repeated work, and query costs",
    icon: Zap,
  },
  {
    key: "style",
    title: "Maintainability",
    description: "Clarity and consistency beyond lint rules",
    icon: Eye,
  },
] as const satisfies ReadonlyArray<{
  key: FocusKey;
  title: string;
  description: string;
  icon: typeof Code2;
}>;

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

export default function AiBehaviorPage() {
  const [repositories, setRepositories] = useState<RepositorySummary[]>([]);
  const [repositoryId, setRepositoryId] = useState("");
  const [role, setRole] = useState<Persona>("SECURITY_RESEARCHER");
  const [customPrompt, setCustomPrompt] = useState("");
  const [focus, setFocus] = useState<Record<FocusKey, boolean>>({
    security: true,
    correctness: true,
    performance: true,
    style: true,
  });
  const [loading, setLoading] = useState(true);
  const [save, setSave] = useState<SaveState>({ status: "idle" });

  const load = useCallback(() => {
    api
      .get<RepositorySummary[]>("/repositories")
      .then((data) => {
        setRepositories(data);

        // Preselect the first repository so the page is immediately actionable.
        const preferred = data.find((item) => item.settings.enabled) ?? data[0];

        if (preferred) {
          setRepositoryId(preferred.id);
          setRole(preferred.settings.role);
          setCustomPrompt(preferred.settings.customPrompt ?? "");
          setFocus({
            security: preferred.settings.security,
            correctness: preferred.settings.correctness,
            performance: preferred.settings.performance,
            style: preferred.settings.style,
          });
        }
      })
      .catch((cause: unknown) => {
        setSave({
          status: "error",
          message: errorMessage(
            cause,
            "We couldn't load your repositories. Please try again.",
          ),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Switching repositories loads that repository's saved configuration. */
  const selectRepository = (id: string) => {
    setRepositoryId(id);
    setSave({ status: "idle" });

    const target = repositories.find((item) => item.id === id);
    if (!target) return;

    setRole(target.settings.role);
    setCustomPrompt(target.settings.customPrompt ?? "");
    setFocus({
      security: target.settings.security,
      correctness: target.settings.correctness,
      performance: target.settings.performance,
      style: target.settings.style,
    });
  };

  const submit = async () => {
    if (!repositoryId) return;

    setSave({ status: "saving" });

    try {
      await api.put(`/repositories/${repositoryId}/settings`, {
        role,
        customPrompt: customPrompt.trim() || null,
        ...focus,
      });

      setRepositories((current) =>
        current.map((item) =>
          item.id === repositoryId
            ? {
                ...item,
                settings: {
                  ...item.settings,
                  role,
                  customPrompt: customPrompt.trim() || null,
                  ...focus,
                },
              }
            : item,
        ),
      );

      setSave({ status: "saved" });
    } catch (cause: unknown) {
      setSave({
        status: "error",
        message: errorMessage(
          cause,
          "We couldn't save this behavior. Please try again.",
        ),
      });
    }
  };

  const toggleFocus = (key: FocusKey) => {
    setFocus((current) => ({ ...current, [key]: !current[key] }));
    setSave({ status: "idle" });
  };

  const selectedRepository = repositories.find(
    (item) => item.id === repositoryId,
  );
  const enabledFocus = (Object.keys(focus) as FocusKey[]).filter(
    (key) => focus[key],
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Workspace configuration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            AI behavior
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Choose the lens Revorbit uses for a repository, tune what it looks
            for, and add your own review instructions.
          </p>
        </div>
        <Button
          onClick={submit}
          disabled={!repositoryId || loading || save.status === "saving"}
        >
          <Save data-icon="inline-start" />
          {save.status === "saving" ? "Saving…" : "Save behavior"}
        </Button>
      </section>

      {save.status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {save.message}
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="h-80 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : repositories.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-14 text-center">
          <Sparkles className="mx-auto size-6 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">No repositories yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            Connect a GitHub repository first — review behavior is configured
            per repository and applies to its pull requests.
          </p>
          <Button
            className="mt-6"
            render={<Link href="/dashboard/repositories" />}
          >
            Connect a repository <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Apply behavior to</CardTitle>
                <CardDescription>
                  Each repository can have its own review profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="border-t pt-5">
                <label
                  htmlFor="behavior-repository"
                  className="mb-2 block text-sm font-medium"
                >
                  Repository
                </label>
                <select
                  id="behavior-repository"
                  value={repositoryId}
                  onChange={(event) => selectRepository(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-md"
                >
                  {repositories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName}
                    </option>
                  ))}
                </select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Choose a reviewer role
                </CardTitle>
                <CardDescription>
                  Start with a focused preset. You can fine-tune the review
                  below.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 border-t pt-5 sm:grid-cols-2">
                {ROLES.map((item) => {
                  const selected = role === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={selected}
                      onClick={() => {
                        setRole(item.id);
                        setSave({ status: "idle" });
                      }}
                      className={`rounded-xl border p-4 text-left transition-colors ${selected ? "border-foreground bg-muted/60 ring-1 ring-foreground/10" : "hover:bg-muted/40"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          className={`flex size-9 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                        >
                          <Icon className="size-4" />
                        </span>
                        <Badge variant={selected ? "default" : "secondary"}>
                          {selected ? "Selected" : item.tag}
                        </Badge>
                      </div>
                      <p className="mt-4 text-sm font-semibold">
                        {ROLE_LABELS[item.id]}
                      </p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Review focus</CardTitle>
                <CardDescription>
                  Disabled areas are removed from the prompt, so the reviewer
                  stops reporting on them.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 border-t py-5 sm:grid-cols-2">
                {FOCUS_OPTIONS.map((option) => {
                  const Icon = option.icon;

                  return (
                    <label
                      key={option.key}
                      className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 hover:bg-muted/30"
                    >
                      <input
                        type="checkbox"
                        checked={focus[option.key]}
                        onChange={() => toggleFocus(option.key)}
                        className="mt-0.5 size-4 accent-foreground"
                      />
                      <span>
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <Icon className="size-3.5 text-muted-foreground" />
                          {option.title}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custom instructions</CardTitle>
                <CardDescription>
                  Tell the reviewer what to prioritise, avoid, or explain.
                </CardDescription>
              </CardHeader>
              <CardContent className="border-t py-5">
                <label htmlFor="custom-prompt" className="sr-only">
                  Custom review instructions
                </label>
                <textarea
                  id="custom-prompt"
                  value={customPrompt}
                  onChange={(event) => {
                    setCustomPrompt(event.target.value);
                    setSave({ status: "idle" });
                  }}
                  rows={5}
                  maxLength={3000}
                  placeholder="For example: Focus on data privacy and backwards compatibility. Keep comments concise and include a minimal fix."
                  className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                  <span>Instructions are combined with the selected role.</span>
                  <span>{customPrompt.length}/3000</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6">
            <Card className="overflow-hidden">
              <div className="bg-primary px-5 py-4 text-primary-foreground">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="size-4" /> Review preview
                </div>
                <p className="mt-1 text-xs text-primary-foreground/70">
                  A glimpse of this configuration
                </p>
              </div>
              <CardContent className="space-y-4 p-5">
                <div>
                  <p className="text-xs text-muted-foreground">Repository</p>
                  <p className="mt-1 text-sm font-semibold">
                    {selectedRepository?.fullName ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reviewer</p>
                  <p className="mt-1 text-sm font-semibold">
                    {ROLE_LABELS[role]}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Focus areas</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {enabledFocus.map((key) => (
                      <Badge
                        variant="secondary"
                        key={key}
                        className="capitalize"
                      >
                        {FOCUS_LABELS[key]}
                      </Badge>
                    ))}
                    {enabledFocus.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No focus areas selected — reviews will return no
                        findings.
                      </span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg bg-muted/60 p-3">
                  <p className="text-xs font-medium">Instruction sample</p>
                  <p className="mt-1 line-clamp-4 text-xs leading-5 text-muted-foreground">
                    {customPrompt || "No custom instructions added."}
                  </p>
                </div>
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Check className="size-3.5 text-emerald-600" /> Review only;
                  changes are never applied automatically.
                </p>
              </CardContent>
            </Card>

            {save.status === "saved" && (
              <Card
                aria-live="polite"
                className="border-emerald-500/30 bg-emerald-500/5"
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <Check className="mt-0.5 size-4 text-emerald-600" />
                  <p className="text-sm leading-6">
                    Saved. This configuration applies to the next review on{" "}
                    {selectedRepository?.fullName}.
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="bg-muted/30">
              <CardContent className="p-4">
                <p className="text-sm font-medium">Per-repository controls</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Fine-tune model and review limits from repository settings.
                </p>
                <Button
                  className="mt-3 w-full"
                  size="sm"
                  variant="outline"
                  render={
                    <Link href={`/dashboard/repositories/${repositoryId}`} />
                  }
                >
                  Repository settings <ArrowRight data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
      )}
    </main>
  );
}
