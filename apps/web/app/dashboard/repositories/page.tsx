"use client";

import { useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
  const [installations, setInstallations] = useState<Installation[] | null>(
    null,
  );
  const [repositories, setRepositories] = useState<RepositorySummary[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
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
        setError(null);
      })
      .catch(() => {
        setError("Failed to load repositories");
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
      setError("Failed to connect repository");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (repositoryId: string) => {
    setBusy(true);
    setError(null);

    try {
      await api.del(`/repositories/${repositoryId}`);
      load();
    } catch {
      setError("Failed to disconnect repository");
    } finally {
      setBusy(false);
    }
  };

  if (error && !repositories && !installations) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!repositories || !installations) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading repositories...</p>
      </main>
    );
  }

  const hasInstallations = installations.length > 0;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repositories</h1>
          <p className="mt-1 text-muted-foreground">
            Connect GitHub repositories to receive AI reviews on pull requests.
          </p>
        </div>
        {app?.installUrl && (
          <Button render={<a href={app.installUrl} target="_blank" rel="noreferrer" />}>
            Install GitHub App
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {!hasInstallations && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="font-medium">The Revorbit GitHub App is not installed</p>
            <p className="mx-auto mt-1 max-w-md text-muted-foreground">
              Install the GitHub App on your account or organization to connect
              repositories. Once installed, your repositories will appear here.
            </p>
            {app?.installUrl && (
              <Button
                className="mt-6"
                render={<a href={app.installUrl} target="_blank" rel="noreferrer" />}
              >
                Install GitHub App
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {repositories.length > 0 && (
        <>
          <div>
            <h2 className="text-xl font-semibold">Connected repositories</h2>
            <p className="text-sm text-muted-foreground">
              Repositories currently receiving AI reviews.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repositories.map((repository) => (
              <Card key={repository.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{repository.fullName}</span>
                    <Badge
                      variant={
                        repository.settings.enabled ? "default" : "secondary"
                      }
                    >
                      {repository.settings.enabled ? "On" : "Off"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {repository.settings.model} · max {repository.settings.maxFiles}{" "}
                    files
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => disconnect(repository.id)}
                  >
                    Disconnect
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={`/dashboard/repositories/${repository.id}`} />}
                  >
                    Settings
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {hasInstallations && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Available repositories</h2>
            <p className="text-sm text-muted-foreground">
              Repositories the GitHub App can access. Connect the ones you want
              to review.
            </p>
          </div>

          {installations.map((installation) => (
            <Card key={installation.id}>
              <CardHeader>
                <CardTitle>{installation.accountLogin}</CardTitle>
                <CardDescription>
                  {installation.accountType === "Organization"
                    ? "Organization"
                    : "Personal account"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {installation.repositories.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    The GitHub App has access to no repositories for this
                    account.
                  </p>
                )}
                {installation.repositories.map((repository) => (
                  <div
                    key={repository.githubId}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{repository.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        default branch: {repository.defaultBranch}
                      </p>
                    </div>
                    {repository.connected ? (
                      <Badge variant="secondary">Connected</Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          connect(installation.id, repository.githubId)
                        }
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
