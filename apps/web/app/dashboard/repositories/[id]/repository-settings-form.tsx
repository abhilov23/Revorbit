"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/api";
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
    security: repository.settings.security,
    performance: repository.settings.performance,
    bestPractices: repository.settings.bestPractices,
    model: repository.settings.model,
    maxFiles: String(repository.settings.maxFiles),
  });

  const update = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);

    try {
      await api.put(`/repositories/${repository.id}/settings`, {
        enabled: form.enabled,
        security: form.security,
        performance: form.performance,
        bestPractices: form.bestPractices,
        model: form.model,
        maxFiles: Number(form.maxFiles),
      });
      setMessage("Settings saved");
      router.refresh();
    } catch {
      setMessage("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {repository.fullName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Configure how Revorbit reviews pull requests in this repository.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Review Settings</CardTitle>
          <CardDescription>
            Toggle which types of reviews the AI performs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="enabled">Enable AI Reviews</Label>
              <p className="text-sm text-muted-foreground">
                Automatically review every pull request.
              </p>
            </div>
            <Toggle
              id="enabled"
              pressed={form.enabled}
              onPressedChange={(pressed) => update("enabled", pressed)}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="security">Security Review</Label>
              <p className="text-sm text-muted-foreground">
                Detect security vulnerabilities and unsafe patterns.
              </p>
            </div>
            <Toggle
              id="security"
              pressed={form.security}
              onPressedChange={(pressed) => update("security", pressed)}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="performance">Performance Review</Label>
              <p className="text-sm text-muted-foreground">
                Find performance issues and inefficiencies.
              </p>
            </div>
            <Toggle
              id="performance"
              pressed={form.performance}
              onPressedChange={(pressed) => update("performance", pressed)}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="best-practices">Best Practices Review</Label>
              <p className="text-sm text-muted-foreground">
                Check code quality and maintainability.
              </p>
            </div>
            <Toggle
              id="best-practices"
              pressed={form.bestPractices}
              onPressedChange={(pressed) => update("bestPractices", pressed)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">AI Model</Label>
            <Input
              id="model"
              value={form.model}
              onChange={(event) => update("model", event.target.value)}
              placeholder="gpt-4o-mini"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-files">Maximum Files per Review</Label>
            <Input
              id="max-files"
              type="number"
              min={1}
              max={100}
              value={form.maxFiles}
              onChange={(event) => update("maxFiles", event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {message && (
        <p className="text-sm text-muted-foreground">{message}</p>
      )}

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
