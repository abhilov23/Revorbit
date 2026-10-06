"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { RepositorySettingsForm } from "./repository-settings-form";

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

export default function RepositorySettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [repository, setRepository] = useState<RepositorySettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get<RepositorySettings>(`/repositories/${params.id}`)
      .then((data) => {
        if (!cancelled) setRepository(data);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Repository not found");
          router.replace("/dashboard/repositories");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-muted-foreground">{error}</p>
      </main>
    );
  }

  if (!repository) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-muted-foreground">Loading repository...</p>
      </main>
    );
  }

  return <RepositorySettingsForm repository={repository} />;
}
