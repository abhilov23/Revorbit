"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Github, KeyRound } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Set by the API client when an expired session bounced the user here, so a
  // deep link returns them to where they were after signing in.
  const next = searchParams.get("next");

  const signInWithGitHub = async () => {
    setError(null);
    try {
      const { url } = await api.get<{ url: string }>("/auth/github");
      window.location.href = url;
    } catch (cause: unknown) {
      setError(errorMessage(cause, "GitHub sign-in is unavailable right now."));
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.post("/auth/login", { email, password });
      router.push(next ?? "/dashboard");
      router.refresh();
    } catch {
      // The API returns a deliberately identical message for unknown accounts
      // and wrong passwords, so this never confirms whether an email exists.
      setError("Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      icon={<KeyRound className="size-5" />}
      title="Welcome back"
      description="Sign in to your account to continue"
      descriptionRole="alert"
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground hover:underline"
          >
            Sign up
          </Link>
        </>
      }
    >
      <div className="space-y-4">
        <Button
          type="button"
          className="w-full rounded-full"
          variant="outline"
          onClick={signInWithGitHub}
        >
          <Github data-icon="inline-start" />
          Continue with GitHub
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="hello@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  // `useSearchParams` requires a Suspense boundary during prerendering.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
