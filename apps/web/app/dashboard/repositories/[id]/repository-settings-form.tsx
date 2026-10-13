"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Code2,
  Eye,
  GitBranch,
  LockKeyhole,
  Save,
  SearchCheck,
  ShieldCheck,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api, errorMessage } from "@/lib/api";
import type {
  AutonomyLevel,
  Persona,
  RepositorySummary,
} from "@/lib/api-types";
import {
  AUTONOMY_DESCRIPTIONS,
  capabilitiesFor,
  AUTONOMY_LABELS,
  CAPABILITY_LABELS,
  FOCUS_LABELS,
  ROLE_LABELS,
} from "@/lib/format";

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
  key: "security" | "correctness" | "performance" | "style";
  title: string;
  description: string;
  icon: typeof Code2;
}>;

const ROLES = [
  {
    id: "REVIEWER",
    icon: SearchCheck,
    description:
      "Prioritise correctness, bugs, edge cases and maintainability.",
  },
  {
    id: "SECURITY_RESEARCHER",
    icon: ShieldCheck,
    description:
      "Prioritise vulnerabilities, unsafe data handling and auth boundaries.",
  },
  {
    id: "DEVELOPER",
    icon: Zap,
    description:
      "Prioritise practical fixes, refactoring and developer experience.",
  },
  {
    id: "HELPER",
    icon: Code2,
    description: "Report only clear problems, without critiquing style.",
  },
] as const satisfies ReadonlyArray<{
  id: Persona;
  icon: typeof Code2;
  description: string;
}>;

const AUTONOMY_LEVELS = [
  "OBSERVE",
  "SUGGEST",
  "PROPOSE",
  "AUTONOMOUS",
] as const satisfies ReadonlyArray<AutonomyLevel>;

type FocusKey = (typeof FOCUS_OPTIONS)[number]["key"];

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

export function RepositorySettingsForm({
  repository,
}: {
  repository: RepositorySummary;
}) {
  const { settings } = repository;

  const [enabled, setEnabled] = useState(settings.enabled);
  const [model, setModel] = useState(settings.model);
  const [maxFiles, setMaxFiles] = useState(String(settings.maxFiles));
  const [maxTokens, setMaxTokens] = useState(String(settings.maxTokens));
  const [role, setRole] = useState<Persona>(settings.role);
  const [autonomyLevel, setAutonomyLevel] = useState<AutonomyLevel>(
    settings.autonomyLevel,
  );
  const [customPrompt, setCustomPrompt] = useState(settings.customPrompt ?? "");
  const [focus, setFocus] = useState<Record<FocusKey, boolean>>({
    security: settings.security,
    correctness: settings.correctness,
    performance: settings.performance,
    style: settings.style,
  });
  const [save, setSave] = useState<SaveState>({ status: "idle" });

  const parsedMaxFiles = Number(maxFiles);
  const parsedMaxTokens = Number(maxTokens);
  const valid =
    model.trim().length > 0 &&
    Number.isInteger(parsedMaxFiles) &&
    parsedMaxFiles >= 1 &&
    parsedMaxFiles <= 100 &&
    Number.isInteger(parsedMaxTokens) &&
    parsedMaxTokens >= 100 &&
    parsedMaxTokens <= 128000;

  const submit = async () => {
    if (!valid) return;

    setSave({ status: "saving" });

    try {
      await api.put(`/repositories/${repository.id}/settings`, {
        enabled,
        model: model.trim(),
        maxFiles: parsedMaxFiles,
        maxTokens: parsedMaxTokens,
        role,
        autonomyLevel,
        customPrompt: customPrompt.trim() || null,
        ...focus,
      });

      setSave({ status: "saved" });
    } catch (cause: unknown) {
      setSave({
        status: "error",
        message: errorMessage(
          cause,
          "We couldn't save these settings. Please try again.",
        ),
      });
    }
  };

  const toggleFocus = (key: FocusKey) => {
    setFocus((current) => ({ ...current, [key]: !current[key] }));
    setSave({ status: "idle" });
  };

  return (
    <main className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/dashboard/repositories" />}
        >
          <ArrowLeft data-icon="inline-start" /> Repositories
        </Button>
        <div className="mt-5 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted">
            <GitBranch className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Repository settings
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {repository.fullName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Default branch: {repository.defaultBranch}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automatic reviews</CardTitle>
          <CardDescription>
            Choose whether Revorbit reviews new and updated pull requests in
            this repository.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-5 border-t py-5">
          <div>
            <Label htmlFor="enabled" className="text-sm font-medium">
              Enable pull request reviews
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Pause reviews without disconnecting the repository.
            </p>
          </div>
          {/*
            A Switch (on/off) rather than a Toggle (pressed/unpressed): the
            control represents a persistent state, not a momentary press.
          */}
          <Switch
            id="enabled"
            checked={enabled}
            onCheckedChange={(next) => {
              setEnabled(next);
              setSave({ status: "idle" });
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Autonomy</CardTitle>
          <CardDescription>
            How much authority Revorbit has over this repository. Every GitHub
            write is checked against this before it happens.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 border-t py-5 sm:grid-cols-2">
          {AUTONOMY_LEVELS.map((level) => {
            const selected = autonomyLevel === level;

            return (
              <button
                key={level}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setAutonomyLevel(level);
                  setSave({ status: "idle" });
                }}
                className={`rounded-xl border p-4 text-left transition-colors ${selected ? "border-foreground bg-muted/60 ring-1 ring-foreground/10" : "hover:bg-muted/40"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {AUTONOMY_LABELS[level]}
                  </p>
                  {selected && (
                    <Check className="size-4 text-muted-foreground" />
                  )}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {AUTONOMY_DESCRIPTIONS[level]}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Granted capabilities</CardTitle>
          <CardDescription>
            Determined by the autonomy level above. Operations outside this set
            are refused before they reach GitHub.
          </CardDescription>
        </CardHeader>
        <CardContent className="border-t py-5">
          <div className="flex flex-wrap gap-2">
            {AUTONOMY_LEVELS.map((level) =>
              capabilitiesFor(level).map((capability) => (
                <Badge
                  key={`${level}-${capability}`}
                  variant={level === autonomyLevel ? "default" : "outline"}
                  className={level === autonomyLevel ? "" : "opacity-40"}
                >
                  {CAPABILITY_LABELS[capability] ?? capability}
                </Badge>
              )),
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reviewer role</CardTitle>
          <CardDescription>
            Sets the lens the reviewer uses and which findings it leads with.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 border-t py-5 sm:grid-cols-2">
          {ROLES.map((item) => {
            const selected = role === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
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
                  {selected && (
                    <Check className="size-4 text-muted-foreground" />
                  )}
                </div>
                <p className="mt-4 text-sm font-semibold">
                  {ROLE_LABELS[item.id]}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.description}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review focus</CardTitle>
          <CardDescription>
            Disabled areas are excluded from the prompt entirely, so the
            reviewer stops reporting on them.
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
                    {FOCUS_LABELS[option.key]}
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
          <CardTitle>Custom instructions</CardTitle>
          <CardDescription>
            Added to the system prompt alongside the role. Use this to encode
            standards your team cares about.
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
          <p className="mt-2 text-xs text-muted-foreground">
            {customPrompt.length}/3000
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Model and limits</CardTitle>
          <CardDescription>
            Set the model used by the review worker and how much it may process.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 border-t py-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="model">AI model</Label>
            <Input
              id="model"
              value={model}
              maxLength={100}
              onChange={(event) => {
                setModel(event.target.value);
                setSave({ status: "idle" });
              }}
              placeholder="gpt-4o-mini"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="max-files">Maximum changed files</Label>
            <Input
              id="max-files"
              type="number"
              min={1}
              max={100}
              step={1}
              value={maxFiles}
              onChange={(event) => {
                setMaxFiles(event.target.value);
                setSave({ status: "idle" });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Choose between 1 and 100 files per review.
            </p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="max-tokens">Maximum response tokens</Label>
            <Input
              id="max-tokens"
              type="number"
              min={100}
              max={128000}
              step={100}
              value={maxTokens}
              onChange={(event) => {
                setMaxTokens(event.target.value);
                setSave({ status: "idle" });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Caps the AI response length. Reviews that need more are truncated.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm">
          {save.status === "saved" && (
            <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Check className="size-4" /> Settings saved.
            </p>
          )}
          {save.status === "error" && (
            <p role="alert" className="text-destructive">
              {save.message}
            </p>
          )}
          {!valid && save.status === "idle" && (
            <p className="text-destructive">
              Enter a model, a file limit from 1 to 100, and a token limit from
              100 to 128000.
            </p>
          )}
        </div>
        <Button onClick={submit} disabled={save.status === "saving" || !valid}>
          <Save data-icon="inline-start" />
          {save.status === "saving" ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </main>
  );
}
