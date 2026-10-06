"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Check, GitBranch, Save } from "lucide-react";

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
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api";

interface RepositorySettings {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  settings: {
    enabled: boolean;
    security: boolean;
    performance: boolean;
    bestPractices: boolean;
    model: string;
    maxFiles: number;
  };
}

export function RepositorySettingsForm({
  repository,
}: {
  repository: RepositorySettings;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    enabled: repository.settings.enabled,
    model: repository.settings.model,
    maxFiles: String(repository.settings.maxFiles),
  });
  const maxFiles = Number(form.maxFiles);
  const valid = form.model.trim().length > 0 && Number.isInteger(maxFiles) && maxFiles >= 1 && maxFiles <= 100;

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.put(`/repositories/${repository.id}/settings`, {
        enabled: form.enabled,
        model: form.model.trim(),
        maxFiles,
      });
      setMessage("Settings saved successfully.");
      router.refresh();
    } catch {
      setMessage("We couldn’t save these settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-7 px-5 py-8 sm:px-8 sm:py-10">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/dashboard/repositories" />}>
          <ArrowLeft data-icon="inline-start" /> Repositories
        </Button>
        <div className="mt-5 flex items-start gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-muted"><GitBranch className="size-5" /></span>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Repository settings</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{repository.fullName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Default branch: {repository.defaultBranch}</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Automatic reviews</CardTitle>
          <CardDescription>Choose whether Revorbit reviews new and updated pull requests in this repository.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-5 border-t py-5">
          <div>
            <Label htmlFor="enabled" className="text-sm font-medium">Enable pull request reviews</Label>
            <p className="mt-1 text-sm text-muted-foreground">Pause reviews without disconnecting the repository.</p>
          </div>
          <Toggle
            id="enabled"
            aria-label="Enable pull request reviews"
            pressed={form.enabled}
            onPressedChange={(enabled) => setForm((current) => ({ ...current, enabled }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review configuration</CardTitle>
          <CardDescription>Set the model used by the review worker and the maximum number of changed files it processes.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 border-t py-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="model">AI model</Label>
            <Input
              id="model"
              value={form.model}
              maxLength={100}
              onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
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
              value={form.maxFiles}
              onChange={(event) => setForm((current) => ({ ...current, maxFiles: event.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Choose between 1 and 100 files per review.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div aria-live="polite" className="text-sm">
          {message && <p className={message.startsWith("Settings saved") ? "flex items-center gap-2 text-emerald-700 dark:text-emerald-400" : "text-destructive"}>{message.startsWith("Settings saved") && <Check className="size-4" />}{message}</p>}
          {!valid && !message && <p className="text-destructive">Enter a model and a file limit from 1 to 100.</p>}
        </div>
        <Button onClick={save} disabled={saving || !valid}>
          <Save data-icon="inline-start" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </main>
  );
}
