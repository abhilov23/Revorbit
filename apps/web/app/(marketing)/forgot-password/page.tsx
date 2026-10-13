"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
    } catch (cause: unknown) {
      setError(
        errorMessage(
          cause,
          "We couldn't send the reset link. Please try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell
        icon={<CheckCircle2 className="size-5" />}
        title="Check your inbox"
        description="If an account exists for that address, a password reset link is on its way. The link is valid for one hour."
        footer={
          <>
            Remembered it?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground hover:underline"
            >
              Back to sign in
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/50 p-4 text-center">
            <p className="break-all text-sm font-medium">{email}</p>
          </div>
          <Button
            type="button"
            className="w-full rounded-full"
            variant="outline"
            onClick={() => setSubmitted(false)}
          >
            Use a different email
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      icon={<Mail className="size-5" />}
      title="Forgot your password?"
      description="Enter the email address associated with your account and we'll send you a reset link."
      descriptionRole="alert"
      footer={
        <>
          Remembered it?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground hover:underline"
          >
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
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
          {submitting ? "Sending…" : "Continue"}
        </Button>
      </form>
    </AuthShell>
  );
}
