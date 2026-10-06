"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Github, Globe2, Mail, Save, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function WorkspaceSettingsPage() {
  const [settings, setSettings] = useState({ pullRequestReviews: true, inlineComments: true, weeklyDigest: false, mentionOnCritical: true });
  const [model, setModel] = useState("balanced");
  const [maxFiles, setMaxFiles] = useState("30");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("revorbit-workspace-settings-preview");
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<typeof settings> & { model?: string; maxFiles?: string };
      setSettings((current) => ({
        ...current,
        ...Object.fromEntries(Object.entries(parsed).filter(([key, value]) => key in current && typeof value === "boolean")),
      }));
      if (parsed.model) setModel(parsed.model);
      if (parsed.maxFiles) setMaxFiles(parsed.maxFiles);
    } catch {
      return;
    }
  }, []);

  const toggle = (key: keyof typeof settings) => {
    setSettings((current) => ({ ...current, [key]: !current[key] }));
    setSaved(false);
  };

  const save = () => {
    window.localStorage.setItem("revorbit-workspace-settings-preview", JSON.stringify({ ...settings, model, maxFiles }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const preferences = [
    ["pullRequestReviews", "Automatic pull request reviews", "Start a review when a pull request is opened or updated."],
    ["inlineComments", "Post findings as inline comments", "Place actionable feedback next to the changed code."],
    ["mentionOnCritical", "Notify on critical findings", "Mention the pull request author when a critical issue is found."],
    ["weeklyDigest", "Weekly workspace digest", "Receive a summary of review activity every Monday."],
  ] as const;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><div className="flex items-center gap-2"><p className="text-sm font-medium text-muted-foreground">Workspace configuration</p><Badge variant="outline">Preview</Badge></div><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Workspace settings</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Manage review defaults, notifications, and integrations for your team.</p></div>
        <Button onClick={save}><Save data-icon="inline-start" />{saved ? "Saved locally" : "Save settings"}</Button>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="size-4 text-muted-foreground" /> Review defaults</CardTitle><CardDescription>Starting preferences for repositories connected to this workspace.</CardDescription></CardHeader>
        <CardContent className="divide-y border-t py-0">
          {preferences.slice(0, 2).map(([key, title, description]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-5 py-4"><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span><input type="checkbox" checked={settings[key]} onChange={() => toggle(key)} className="size-4 shrink-0 accent-foreground" /></label>)}
          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">Default review model<select value={model} onChange={(event) => setModel(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="balanced">Balanced · Claude 3.7 Sonnet</option><option value="fast">Fast · GPT-4.1 mini</option><option value="deep">Deep analysis · GPT-4.1</option></select></label>
            <label className="space-y-2 text-sm font-medium">Default maximum changed files<select value={maxFiles} onChange={(event) => setMaxFiles(event.target.value)} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="15">15 files</option><option value="30">30 files</option><option value="50">50 files</option></select></label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="size-4 text-muted-foreground" /> Notifications</CardTitle><CardDescription>Choose which events should reach your team.</CardDescription></CardHeader>
        <CardContent className="divide-y border-t py-0">{preferences.slice(2).map(([key, title, description]) => <label key={key} className="flex cursor-pointer items-center justify-between gap-5 py-4"><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span><input type="checkbox" checked={settings[key]} onChange={() => toggle(key)} className="size-4 shrink-0 accent-foreground" /></label>)}</CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Github className="size-4 text-muted-foreground" /> Integrations</CardTitle><CardDescription>Services connected to the Revorbit workspace.</CardDescription></CardHeader>
        <CardContent className="divide-y border-t py-0">
          <div className="flex items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-muted"><Github className="size-4" /></span><div><p className="text-sm font-medium">GitHub App</p><p className="mt-0.5 text-xs text-muted-foreground">Connect repositories and receive pull request events</p></div></div><Badge variant="secondary">Not connected</Badge></div>
          <div className="flex items-center justify-between gap-4 py-4"><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-muted"><Mail className="size-4" /></span><div><p className="text-sm font-medium">Email notifications</p><p className="mt-0.5 text-xs text-muted-foreground">Send review alerts and activity summaries</p></div></div><Badge variant="outline">Coming soon</Badge></div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30"><CardContent className="flex items-start gap-3 p-4"><Globe2 className="mt-0.5 size-4 text-muted-foreground" /><div><p className="text-sm font-medium">Sample workspace preferences</p><p className="mt-1 text-xs leading-5 text-muted-foreground">These controls demonstrate the future workspace settings. Saving stores your choices in this browser only.</p></div><Check className="ml-auto mt-0.5 size-4 text-muted-foreground" /></CardContent></Card>
      <div className="flex justify-end"><Button onClick={save}><ShieldCheck data-icon="inline-start" />{saved ? "Saved locally" : "Save settings"}</Button></div>
    </main>
  );
}
