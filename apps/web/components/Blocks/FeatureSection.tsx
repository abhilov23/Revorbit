"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  Github,
  MessageSquareCode,
  Settings2,
} from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";

const steps = [
  {
    number: "01",
    title: "Install the GitHub App",
    description:
      "Choose a personal account or organization, then grant access to the repositories you want Revorbit to review.",
    icon: Github,
    details: ["Select repositories in GitHub", "No CI workflow to add"],
  },
  {
    number: "02",
    title: "Choose how reviews run",
    description:
      "Connect a repository, enable automatic reviews, and set the model and changed-file limit for review jobs.",
    icon: Settings2,
    details: ["Repository-level controls", "Pause reviews at any time"],
  },
  {
    number: "03",
    title: "Get feedback on the PR",
    description:
      "When a pull request opens or updates, Revorbit processes it and posts findings with suggested fixes directly on GitHub.",
    icon: MessageSquareCode,
    details: ["Inline GitHub comments", "Review history in your dashboard"],
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="scroll-mt-24 py-16 sm:py-24">
      <motion.div
        className="mx-auto mb-12 max-w-2xl text-center sm:mb-16"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-sm font-semibold text-muted-foreground">From install to inline feedback</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-4xl">
          A review flow that fits GitHub
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-neutral-600 dark:text-neutral-400">
          Revorbit connects your repositories to an automated review worker and returns its findings to the pull request.
        </p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <motion.article
            key={step.number}
            className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-7"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.45, delay: index * 0.1 }}
          >
            <div className="flex items-center justify-between">
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted"><step.icon className="size-5" /></span>
              <span className="font-mono text-xs text-muted-foreground">{step.number}</span>
            </div>
            <h3 className="mt-6 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 min-h-20 text-sm leading-6 text-muted-foreground">{step.description}</p>
            <ul className="mt-5 space-y-2 border-t pt-5">
              {step.details.map((detail) => (
                <li key={detail} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="size-3.5 shrink-0 text-foreground" /> {detail}
                </li>
              ))}
            </ul>
          </motion.article>
        ))}
      </div>

      <div className="mt-8 flex flex-col items-center justify-between gap-5 rounded-2xl border bg-muted/30 p-6 sm:flex-row sm:p-8">
        <div>
          <h3 className="font-semibold">Ready to connect a repository?</h3>
          <p className="mt-1 text-sm text-muted-foreground">Create an account to install the app and configure your first review.</p>
        </div>
        <Button className="rounded-full px-5" render={<Link href="/signup" />}>
          Get started <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </section>
  );
}
