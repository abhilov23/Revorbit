"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { KeyRound } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";

const MIN_LENGTH = 8;

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const valid =
    token.length > 0 &&
    password.length >= MIN_LENGTH &&
    password === confirmPassword;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;

    setSubmitting(true);
    setError(null);

    try {
      await api.post("/auth/reset-password", { token, password });
      router.push("/login?reset=1");
    } catch (cause: unknown) {
      setError(
        errorMessage(
          cause,
          "This reset link is invalid or has expired. Please request a new one.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell
        icon={<KeyRound className="size-5" />}
        title="Reset link missing"
        description="This page needs a reset token. Request a new link to continue."
        descriptionRole="alert"
        footer={
          <Link
            href="/forgot-password"
            className="font-medium text-foreground hover:underline"
          >
            Request a new link
          </Link>
        }
      >
        <Button
          className="w-full rounded-full"
          render={<Link href="/forgot-password" />}
        >
          Request a new link
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon={<KeyRound className="size-5" />}
      title="Choose a new password"
      description="Pick something at least 8 characters long that you haven't used here before."
      descriptionRole="alert"
      footer={
        <>
          Changed your mind?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
          {tooShort && (
            <p className="text-xs text-destructive">
              Use at least {MIN_LENGTH} characters.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={MIN_LENGTH}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="••••••••"
            required
          />
          {mismatch && (
            <p className="text-xs text-destructive">
              The two passwords don&apos;t match.
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full rounded-full"
          disabled={!valid || submitting}
        >
          {submitting ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
