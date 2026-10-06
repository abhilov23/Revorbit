"use client";

import { useEffect, useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { demoRepositories } from "@/lib/demo-workspace";

const personas = [
  { id: "security", title: "Security researcher", description: "Prioritize vulnerabilities, unsafe data handling, and auth boundaries.", icon: ShieldCheck, tag: "Security-first" },
  { id: "analyzer", title: "Code analyzer", description: "Catch correctness bugs, edge cases, and maintainability issues.", icon: SearchCheck, tag: "Balanced" },
  { id: "performance", title: "Performance coach", description: "Look for avoidable work, slow queries, and scaling concerns.", icon: Zap, tag: "Efficiency" },
  { id: "custom", title: "Custom instructions", description: "Write a prompt that reflects your team’s review standards.", icon: Braces, tag: "Your rules" },
] as const;

const defaultPrompt = "Act as a thoughtful senior engineer. Prioritize actionable issues that could cause bugs or security regressions. Explain why each issue matters and suggest a minimal fix. Skip style-only feedback.";

export default function AiBehaviorPage() {
  const [persona, setPersona] = useState<string>("security");
  const [repository, setRepository] = useState("demo-acme-storefront");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [checks, setChecks] = useState({ security: true, correctness: true, performance: false, style: false });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("revorbit-ai-behavior-preview");
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        persona?: string;
        repository?: string;
        prompt?: string;
        checks?: Partial<typeof checks>;
      };
      if (personas.some((item) => item.id === parsed.persona)) setPersona(parsed.persona!);
      if (demoRepositories.some((item) => item.id === parsed.repository)) setRepository(parsed.repository!);
      if (typeof parsed.prompt === "string") setPrompt(parsed.prompt);
      const savedChecks = parsed.checks;
      if (savedChecks) {
        setChecks((current) => ({
          ...current,
          ...Object.fromEntries(Object.entries(savedChecks).filter(([, value]) => typeof value === "boolean")),
        }));
      }
    } catch {
      return;
    }
  }, []);

  const save = () => {
    window.localStorage.setItem("revorbit-ai-behavior-preview", JSON.stringify({ persona, repository, prompt, checks }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks((current) => ({ ...current, [key]: !current[key] }));
    setSaved(false);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2"><p className="text-sm font-medium text-muted-foreground">Workspace configuration</p><Badge variant="outline">Preview</Badge></div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">AI behavior</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Choose the lens Revorbit uses for a repository, tune what it looks for, and add your own review instructions.</p>
        </div>
        <Button onClick={save}><Save data-icon="inline-start" />{saved ? "Saved locally" : "Save behavior"}</Button>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Apply behavior to</CardTitle>
              <CardDescription>Each repository can have its own review profile.</CardDescription>
            </CardHeader>
            <CardContent className="border-t pt-5">
              <label htmlFor="behavior-repository" className="mb-2 block text-sm font-medium">Repository</label>
              <select id="behavior-repository" value={repository} onChange={(event) => { setRepository(event.target.value); setSaved(false); }} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-md">
                {demoRepositories.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">This example uses sample repositories. Connect GitHub to configure your own.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Choose a reviewer persona</CardTitle>
              <CardDescription>Start with a focused preset. You can fine-tune the review below.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 border-t pt-5 sm:grid-cols-2">
              {personas.map((item) => {
                const selected = persona === item.id;
                return <button type="button" key={item.id} aria-pressed={selected} onClick={() => { setPersona(item.id); setSaved(false); }} className={`rounded-xl border p-4 text-left transition-colors ${selected ? "border-foreground bg-muted/60 ring-1 ring-foreground/10" : "hover:bg-muted/40"}`}>
                  <div className="flex items-start justify-between gap-3"><span className={`flex size-9 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><item.icon className="size-4" /></span><Badge variant={selected ? "default" : "secondary"}>{selected ? "Selected" : item.tag}</Badge></div>
                  <p className="mt-4 text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
                </button>;
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review focus</CardTitle>
              <CardDescription>Select the kinds of findings that matter most to your team.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 border-t py-5 sm:grid-cols-2">
              {([
                ["security", "Security vulnerabilities", "Auth, injection, secrets, and unsafe access", LockKeyhole],
                ["correctness", "Correctness & bugs", "Logic errors, edge cases, and regressions", Code2],
                ["performance", "Performance", "Slow paths, repeated work, and query costs", Zap],
                ["style", "Maintainability", "Clarity and consistency beyond lint rules", Eye],
              ] as const).map(([key, title, description, Icon]) => (
                <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 hover:bg-muted/30">
                  <input type="checkbox" checked={checks[key]} onChange={() => toggleCheck(key)} className="mt-0.5 size-4 accent-foreground" />
                  <span><span className="flex items-center gap-2 text-sm font-medium"><Icon className="size-3.5 text-muted-foreground" />{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{description}</span></span>
                </label>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Custom instructions</CardTitle>
              <CardDescription>Tell the reviewer what to prioritize, avoid, or explain.</CardDescription>
            </CardHeader>
            <CardContent className="border-t py-5">
              <label htmlFor="custom-prompt" className="sr-only">Custom review instructions</label>
              <textarea id="custom-prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); setSaved(false); }} rows={5} maxLength={3000} placeholder="For example: Focus on data privacy and backwards compatibility. Keep comments concise and include a minimal fix." className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm leading-6 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" />
              <div className="mt-2 flex items-center justify-between gap-4 text-xs text-muted-foreground"><span>Instructions are combined with the selected persona.</span><span>{prompt.length}/3000</span></div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6">
          <Card className="overflow-hidden">
            <div className="bg-primary px-5 py-4 text-primary-foreground"><div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4" /> Review preview</div><p className="mt-1 text-xs text-primary-foreground/70">A glimpse of this configuration</p></div>
            <CardContent className="space-y-4 p-5">
              <div><p className="text-xs text-muted-foreground">Repository</p><p className="mt-1 text-sm font-semibold">{demoRepositories.find((item) => item.id === repository)?.fullName}</p></div>
              <div><p className="text-xs text-muted-foreground">Reviewer</p><p className="mt-1 text-sm font-semibold">{personas.find((item) => item.id === persona)?.title}</p></div>
              <div><p className="text-xs text-muted-foreground">Focus areas</p><div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(checks).filter(([, enabled]) => enabled).map(([key]) => <Badge variant="secondary" key={key} className="capitalize">{key}</Badge>)}{!Object.values(checks).some(Boolean) && <span className="text-xs text-muted-foreground">No focus areas selected</span>}</div></div>
              <div className="rounded-lg bg-muted/60 p-3"><p className="text-xs font-medium">Instruction sample</p><p className="mt-1 line-clamp-4 text-xs leading-5 text-muted-foreground">{prompt || "No custom instructions added."}</p></div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Check className="size-3.5 text-emerald-600" /> Review only; changes are never applied automatically.</p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30"><CardContent className="p-4"><p className="text-sm font-medium">Per-repository controls</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Fine-tune model and review limits from repository settings.</p><Button className="mt-3 w-full" size="sm" variant="outline" render={<Link href="/dashboard/repositories" />}>View repositories <ArrowRight data-icon="inline-end" /></Button></CardContent></Card>
        </aside>
      </div>
      <p className="rounded-xl border border-dashed px-4 py-3 text-xs leading-5 text-muted-foreground">Preview configuration only. Saving stores this example in this browser; it is not sent to a connected repository.</p>
    </main>
  );
}
