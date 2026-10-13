"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Check,
  Github,
  Globe2,
  Mail,
  Save,
  ShieldCheck,
  SlidersHorizontal,
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
import { Switch } from "@/components/ui/switch";
import { api, errorMessage } from "@/lib/api";
import type {
  AutonomyLevel,
  Installation,
  UserSettings,
} from "@/lib/api-types";
import { AUTONOMY_DESCRIPTIONS, AUTONOMY_LABELS } from "@/lib/format";

const AUTONOMY_LEVELS: AutonomyLevel[] = [
  "OBSERVE",
  "SUGGEST",
  "PROPOSE",
  "AUTONOMOUS",
];

const DEFAULTS: UserSettings = {
  defaultModel: "gpt-4o-mini",
  defaultMaxFiles: 20,
  pullRequestReviews: true,
  inlineComments: true,
  mentionOnCritical: true,
  weeklyDigest: false,
  emailNotifications: false,
  defaultAutonomy: "SUGGEST",
};

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

export default function WorkspaceSettingsPage() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULTS);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading] = useState(true);
  const [save, setSave] = useState<SaveState>({ status: "idle" });

  const load = useCallback(() => {
    Promise.all([
      api.get<UserSettings>("/settings"),
      api.get<Installation[]>("/github/installations"),
    ])
      .then(([loaded, installs]) => {
        setSettings({ ...DEFAULTS, ...loaded });
        setInstallations(installs);
      })
      .catch((cause: unknown) => {
        setSave({
          status: "error",
          message: errorMessage(
            cause,
            "We couldn't load your settings. Please try again.",
          ),
        });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSave({ status: "idle" });
  };

  const submit = async () => {
    setSave({ status: "saving" });

    try {
      const updated = await api.put<UserSettings>("/settings", settings);
      setSettings({ ...DEFAULTS, ...updated });
      setSave({ status: "saved" });
    } catch (cause: unknown) {
      setSave({
        status: "error",
        message: errorMessage(
          cause,
          "We couldn't save your settings. Please try again.",
        ),
      });
    }
  };

  type BooleanSetting = {
    [K in keyof UserSettings]: UserSettings[K] extends boolean ? K : never;
  }[keyof UserSettings];

  const reviewDefaults: Array<{
    key: BooleanSetting;
    title: string;
    description: string;
  }> = [
    {
      key: "pullRequestReviews",
      title: "Automatic pull request reviews",
      description: "Start a review when a pull request is opened or updated.",
    },
    {
      key: "inlineComments",
      title: "Post findings as inline comments",
      description: "Place actionable feedback next to the changed code.",
    },
  ];

  const notifications: Array<{
    key: BooleanSetting;
    title: string;
    description: string;
  }> = [
    {
      key: "mentionOnCritical",
      title: "Notify on critical findings",
      description:
        "Mention the pull request author when a critical issue is found.",
    },
    {
      key: "weeklyDigest",
      title: "Weekly workspace digest",
      description: "Receive a summary of review activity every Monday.",
    },
    {
      key: "emailNotifications",
      title: "Email notifications",
      description: "Send review alerts and activity summaries by email.",
    },
  ];

  function PreferenceRow({
    title,
    description,
    checked,
    onChange,
    id,
  }: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    id: string;
  }) {
    return (
      <div className="flex items-center justify-between gap-5 py-4">
        <label htmlFor={id} className="cursor-pointer">
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {description}
          </span>
        </label>
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Workspace configuration
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Workspace settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Manage review defaults, notifications, and integrations for your
            account.
          </p>
        </div>
        <Button onClick={submit} disabled={loading || save.status === "saving"}>
          <Save data-icon="inline-start" />
          {save.status === "saving" ? "Saving…" : "Save settings"}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            Review defaults
          </CardTitle>
          <CardDescription>
            Starting preferences for repositories connected to this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y border-t py-0">
          {reviewDefaults.map(({ key, title, description }) => (
            <PreferenceRow
              key={key}
              id={`pref-${key}`}
              title={title}
              description={description}
              checked={settings[key]}
              onChange={(next) => update(key, next)}
            />
          ))}
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              Default maximum changed files
              <select
                value={String(settings.defaultMaxFiles)}
                onChange={(event) =>
                  update("defaultMaxFiles", Number(event.target.value))
                }
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="10">10 files</option>
                <option value="20">20 files</option>
                <option value="30">30 files</option>
                <option value="50">50 files</option>
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium sm:col-span-2">
              Default autonomy for new repositories
              <select
                value={settings.defaultAutonomy}
                onChange={(event) =>
                  update("defaultAutonomy", event.target.value as AutonomyLevel)
                }
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {AUTONOMY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {AUTONOMY_LABELS[level]} — {AUTONOMY_DESCRIPTIONS[level]}
                  </option>
                ))}
              </select>
              <span className="block text-xs font-normal leading-5 text-muted-foreground">
                Applies when you connect a repository. Existing repositories
                keep their own autonomy, which you can change at any time.
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="size-4 text-muted-foreground" />
            Notifications
          </CardTitle>
          <CardDescription>
            Choose which events should reach you.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y border-t py-0">
          {notifications.map(({ key, title, description }) => (
            <PreferenceRow
              key={key}
              id={`pref-${key}`}
              title={title}
              description={description}
              checked={settings[key]}
              onChange={(next) => update(key, next)}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="size-4 text-muted-foreground" />
            Integrations
          </CardTitle>
          <CardDescription>
            Services connected to your Revorbit account.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y border-t py-0">
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Github className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">GitHub App</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Connect repositories and receive pull request events
                </p>
              </div>
            </div>
            <Badge variant={installations.length > 0 ? "default" : "secondary"}>
              {installations.length > 0
                ? `${installations.length} installation${installations.length === 1 ? "" : "s"}`
                : "Not connected"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
                <Mail className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">Email delivery</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Send review alerts and activity summaries
                </p>
              </div>
            </div>
            <Badge variant="outline">Available</Badge>
          </div>
        </CardContent>
      </Card>

      {save.status === "saved" && (
        <div
          aria-live="polite"
          className="flex items-start gap-3 rounded-xl bg-muted/30 px-4 py-3"
        >
          <Check className="mt-0.5 size-4 text-muted-foreground" />
          <p className="text-sm leading-6">
            <span className="font-medium">Settings saved.</span>{" "}
            <span className="text-muted-foreground">
              New repositories inherit these defaults; existing repositories
              keep their own configuration.
            </span>
          </p>
        </div>
      )}

      <div className="flex items-start gap-3 rounded-xl bg-muted/30 px-4 py-3">
        <Globe2 className="mt-0.5 size-4 text-muted-foreground" />
        <p className="text-sm leading-6 text-muted-foreground">
          Workspace settings apply to your account. Per-repository overrides
          live in each repository&apos;s settings page.
        </p>
        <ShieldCheck className="ml-auto mt-0.5 size-4 text-muted-foreground" />
      </div>
    </main>
  );
}
