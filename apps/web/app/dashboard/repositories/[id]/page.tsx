"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { api, errorMessage } from "@/lib/api";
import type { RepositorySummary } from "@/lib/api-types";
import { RepositorySettingsForm } from "./repository-settings-form";

export default function RepositorySettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [repository, setRepository] = useState<RepositorySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get<RepositorySummary>(`/repositories/${params.id}`)
      .then((data) => {
        if (!controller.signal.aborted) {
          setRepository(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setError(
          cause instanceof Error && cause.message.includes("not found")
            ? "That repository is not connected to your workspace."
            : errorMessage(cause, "We couldn't load this repository."),
        );
      });

    return () => controller.abort();
  }, [params.id]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div
          role="alert"
          className="rounded-2xl border border-destructive/40 bg-destructive/5 px-6 py-10 text-center"
        >
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/dashboard/repositories")}
            className="mt-4 text-sm font-medium underline underline-offset-4"
          >
            Back to repositories
          </button>
        </div>
      </main>
    );
  }

  if (!repository) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </main>
    );
  }

  return <RepositorySettingsForm repository={repository} />;
}
