"use client";

import Link from "next/link";
import {
  ArrowRight,
  Check,
  GitBranch,
  GitPullRequest,
  MessageSquareCode,
} from "lucide-react";
import { motion, type Variants } from "motion/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.08 },
  },
};

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

function ReviewExample() {
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-5 rounded-[2rem] bg-linear-to-br from-primary/10 via-transparent to-primary/5 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border bg-card text-left shadow-2xl shadow-black/10">
        <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><GitPullRequest className="size-4" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Improve session refresh</p>
              <p className="mt-0.5 text-xs text-muted-foreground">acme/web-app · pull request #184</p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 gap-1.5"><Check className="size-3.5" /> Review complete</Badge>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <GitBranch className="size-3.5 shrink-0" />
              <span className="truncate font-mono">src/auth/session.ts:42</span>
            </div>
            <Badge variant="secondary" className="shrink-0">Example finding</Badge>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-2.5">
              <MessageSquareCode className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Check expiry before refreshing</p>
                <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                  This path refreshes a session without first checking whether it has expired. Consider validating the expiry before continuing.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current</p>
              <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-5 text-muted-foreground"><code>if (session) &#123;{"\n"}  refresh(session);{"\n"}&#125;</code></pre>
            </div>
            <div className="rounded-xl border border-emerald-600/20 bg-emerald-500/5 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Suggested</p>
              <pre className="mt-2 overflow-x-auto font-mono text-[11px] leading-5"><code>if (session &amp;&amp; isValid(session)) &#123;{"\n"}  refresh(session);{"\n"}&#125;</code></pre>
            </div>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">Illustrative review preview</p>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <motion.section
      className="grid items-center gap-14 pb-16 pt-28 sm:pb-24 sm:pt-36 lg:grid-cols-[0.95fr_1.05fr] lg:gap-12 lg:pb-28"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="text-center lg:text-left">
        <motion.div variants={fadeUpVariants}>
          <Badge variant="outline" className="gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            AI code review for GitHub
          </Badge>
        </motion.div>
        <motion.h1
          className="mx-auto mt-6 max-w-2xl text-4xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-5xl lg:mx-0 lg:text-6xl"
          variants={fadeUpVariants}
        >
          Pull requests reviewed. Feedback where your team works.
        </motion.h1>
        <motion.p
          className="mx-auto mt-6 max-w-xl text-base leading-7 text-gray-600 dark:text-gray-400 sm:text-lg sm:leading-8 lg:mx-0"
          variants={fadeUpVariants}
        >
          Connect a GitHub repository and Revorbit will review pull requests as they open or change, then share inline findings and suggested fixes on GitHub.
        </motion.p>
        <motion.div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start" variants={fadeUpVariants}>
          <Button size="lg" className="rounded-full px-6" render={<Link href="/signup" />}>
            Get started <ArrowRight data-icon="inline-end" />
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-6" render={<Link href="#features" />}>
            See how it works
          </Button>
        </motion.div>
        <motion.div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground lg:justify-start" variants={fadeUpVariants}>
          <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> GitHub App integration</span>
          <span className="inline-flex items-center gap-1.5"><Check className="size-3.5" /> Repository-level controls</span>
        </motion.div>
      </div>
      <motion.div variants={fadeUpVariants}>
        <ReviewExample />
      </motion.div>
    </motion.section>
  );
}
