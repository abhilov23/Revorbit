"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  GitBranch,
  Github,
  Plus,
  Settings2,
  Unplug,
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
import { demoRepositories } from "@/lib/demo-workspace";

interface GithubApp {
  id: number;
  slug: string;
  name: string;
  htmlUrl: string;
  installUrl?: string;
}

interface AvailableRepository {
  githubId: number;
  fullName: string;
  defaultBranch: string;
  connected: boolean;
}

interface Installation {
  id: string;
  githubId: number;
  accountLogin: string;
  accountType: string;
  repositories: AvailableRepository[];
}

interface RepositorySummary {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  settings: {
    enabled: boolean;
    model: string;
    maxFiles: number;
  };
}

export default function RepositoriesPage() {
  const [app, setApp] = useState<GithubApp | null>(null);
  const [installations, setInstallations] = useState<Installation[] | null>(null);
  const [repositories, setRepositories] = useState<RepositorySummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.get<GithubApp>("/github/app"),
      api.get<Installation[]>("/github/installations"),
      api.get<RepositorySummary[]>("/repositories"),
    ])
      .then(([appData, installationsData, repositoriesData]) => {
        setApp(appData);
        setInstallations(installationsData);
        setRepositories(repositoriesData);
        setSample(false);
        setError(null);
      })
      .catch(() => {
        setApp(null);
        setInstallations([]);
        setRepositories(demoRepositories);
        setSample(true);
        setError(null);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async (installationId: string, githubId: number) => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/repositories/connect", { installationId, githubId });
      load();
    } catch {
      setError("We couldn’t connect that repository. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (repository: RepositorySummary) => {
    if (!window.confirm(`Disconnect ${repository.fullName} from Revorbit?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.del(`/repositories/${repository.id}`);
      load();
    } catch {
      setError(`We couldn’t disconnect ${repository.fullName}. Please try again.`);
    } finally {
      setBusy(false);
    }
  };

  if (!repositories || !installations) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        {error ? (
          <Card className="mx-auto max-w-xl">
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button className="mt-5" variant="outline" onClick={load}>Try again</Button>
            </CardContent>
          </Card>
        ) : <div className="h-44 animate-pulse rounded-2xl bg-muted" />}
      </main>
    );
  }

  const availableCount = installations.reduce(
    (count, installation) => count + installation.repositories.filter((repository) => !repository.connected).length,
    0,
  );
  const enabledCount = repositories.filter((repository) => repository.settings.enabled).length;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-8 sm:px-8 sm:py-10">
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Workspace settings</p>
          <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Repositories</h1>{sample && <Badge variant="outline">Sample data</Badge>}</div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {sample ? "Example repositories show how review controls will appear once GitHub is connected." : "Choose which GitHub repositories Revorbit can review when pull requests are opened or updated."}
          </p>
        </div>
        {app?.installUrl && (
          <Button variant="outline" render={<a href={app.installUrl} target="_blank" rel="noreferrer" />}>
            <Github data-icon="inline-start" />
            Manage GitHub access
            <ArrowUpRight data-icon="inline-end" />
          </Button>
        )}
      </section>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section aria-label="Repository summary" className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="flex size-11 items-center justify-center rounded-xl bg-muted"><GitBranch className="size-5" /></span><div><p className="text-sm text-muted-foreground">Connected</p><p className="mt-0.5 text-2xl font-semibold">{repositories.length}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><Check className="size-5" /></span><div><p className="text-sm text-muted-foreground">Automatic reviews on</p><p className="mt-0.5 text-2xl font-semibold">{enabledCount}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-4 p-5"><span className="flex size-11 items-center justify-center rounded-xl bg-muted"><Plus className="size-5" /></span><div><p className="text-sm text-muted-foreground">Available to connect</p><p className="mt-0.5 text-2xl font-semibold">{availableCount}</p></div></CardContent></Card>
      </section>

      {installations.length === 0 && (
        <Card className="overflow-hidden">
          <CardContent className="grid gap-8 p-6 sm:p-9 md:grid-cols-[1fr_auto] md:items-center">
            <div className="max-w-2xl">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-muted"><Github className="size-6" /></span>
              <h2 className="mt-5 text-xl font-semibold tracking-tight">Install the GitHub App to get started</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Grant Revorbit access to a personal account or organization. You can select exactly which repositories are available for automated reviews.
              </p>
            </div>
            {app?.installUrl && <Button render={<a href={app.installUrl} target="_blank" rel="noreferrer" />}>
              Install Revorbit <ArrowUpRight data-icon="inline-end" />
            </Button>}
          </CardContent>
        </Card>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Connected repositories</h2>
          <p className="mt-1 text-sm text-muted-foreground">Configure review behavior or pause a repository at any time.</p>
        </div>
        {repositories.length === 0 ? (
          <Card><CardContent className="py-10 text-center">
            <GitBranch className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 font-medium">No repositories connected yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Connect one from your GitHub installations below.</p>
          </CardContent></Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {repositories.map((repository) => (
                <div key={repository.id} className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><GitBranch className="size-4 text-muted-foreground" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{repository.fullName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{repository.defaultBranch} · {repository.settings.model} · up to {repository.settings.maxFiles} files</p>
                    </div>
                    <Badge variant={repository.settings.enabled ? "default" : "secondary"} className="shrink-0">
                      {repository.settings.enabled ? "Reviewing" : "Paused"}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 gap-2 pl-[52px] sm:pl-0">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => disconnect(repository)}>
                      <Unplug data-icon="inline-start" /> Disconnect
                    </Button>
                    <Button size="sm" variant="outline" render={<Link href={`/dashboard/repositories/${repository.id}`} />}>
                      <Settings2 data-icon="inline-start" /> Settings
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>

      {installations.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Available on GitHub</h2>
            <p className="mt-1 text-sm text-muted-foreground">Repositories the Revorbit App can access through your installations.</p>
          </div>
          <div className="space-y-4">
            {installations.map((installation) => {
              const unconnected = installation.repositories.filter((repository) => !repository.connected);
              return (
                <Card key={installation.id}>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                    <div>
                      <CardTitle className="text-base">{installation.accountLogin}</CardTitle>
                      <CardDescription className="mt-1">{installation.accountType === "Organization" ? "Organization" : "Personal account"} · {installation.repositories.length} repositories accessible</CardDescription>
                    </div>
                    <Badge variant="outline">{unconnected.length} available</Badge>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {installation.repositories.length === 0 ? (
                      <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">No repositories are available for this installation.</p>
                    ) : installation.repositories.map((repository) => (
                      <div key={repository.githubId} className="flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{repository.fullName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Default branch: {repository.defaultBranch}</p>
                        </div>
                        {repository.connected ? (
                          <Badge variant="secondary" className="w-fit">Connected</Badge>
                        ) : (
                          <Button size="sm" className="w-fit" disabled={busy} onClick={() => connect(installation.id, repository.githubId)}>
                            <Plus data-icon="inline-start" /> Connect
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
