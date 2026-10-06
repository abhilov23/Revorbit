"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Mail, Sparkles } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-28 text-foreground sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute -bottom-52 -right-32 size-[28rem] rounded-full bg-primary/[0.04] blur-3xl" />
      </div>

      <Card className="relative w-full max-w-md border-border/70 bg-card/90 shadow-xl shadow-black/[0.04] backdrop-blur-xl dark:shadow-black/20">
        <CardHeader className="items-center text-center">
          <Link
            href="/"
            aria-label="Revorbit home"
            className="mb-5 inline-flex items-center gap-2.5"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Logo className="size-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Revorbit</span>
          </Link>

          <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground ring-1 ring-border/70">
            {submitted ? (
              <CheckCircle2 className="size-5" />
            ) : (
              <Mail className="size-5" />
            )}
          </span>
          <CardTitle className="text-xl">
            {submitted ? "Request preview" : "Forgot your password?"}
          </CardTitle>
          <CardDescription className="max-w-xs text-balance leading-relaxed">
            {submitted
              ? "Your reset request is ready. Email delivery isn’t connected yet, so no message was sent."
              : "Enter the email address associated with your account and we’ll help you get back in."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {submitted ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-muted/50 p-4 text-center">
                <p className="break-all text-sm font-medium">{email}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Connect an email provider to enable password reset links.
                </p>
              </div>
              <Button
                type="button"
                className="w-full rounded-full"
                onClick={() => setSubmitted(false)}
              >
                Try another email
              </Button>
            </div>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setSubmitted(true);
              }}
              className="space-y-5"
            >
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
              <div className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-foreground" />
                <p>
                  This request form is a preview. No account details are checked
                  and no email is sent.
                </p>
              </div>
              <Button type="submit" className="w-full rounded-full">
                Continue
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
