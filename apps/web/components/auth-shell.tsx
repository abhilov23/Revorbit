import Link from "next/link";

import { Logo } from "@/components/logo";

/** Shared shell for the authentication screens. */
export function AuthShell({
  icon,
  title,
  description,
  descriptionRole,
  children,
  footer,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  /** `status` for non-error copy, `alert` for failures. */
  descriptionRole?: "status" | "alert";
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-28 text-foreground sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -top-40 left-1/2 size-[32rem] -translate-x-1/2 rounded-full bg-primary/[0.06] blur-3xl" />
        <div className="absolute -bottom-52 -right-32 size-[28rem] rounded-full bg-primary/[0.04] blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          aria-label="Revorbit home"
          className="mb-6 inline-flex w-full items-center justify-center gap-2.5"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Logo className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Revorbit</span>
        </Link>

        <div className="w-full rounded-2xl border border-border/70 bg-card/90 px-6 py-8 shadow-xl shadow-black/[0.04] backdrop-blur-xl dark:shadow-black/20">
          <div className="flex flex-col items-center text-center">
            <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted text-foreground ring-1 ring-border/70">
              {icon}
            </span>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p
              role={descriptionRole}
              aria-live={descriptionRole === "alert" ? "assertive" : "polite"}
              className="mt-2 max-w-xs text-balance text-sm leading-relaxed text-muted-foreground"
            >
              {description}
            </p>
          </div>

          <div className="mt-6">{children}</div>
        </div>

        {footer && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        )}
      </div>
    </main>
  );
}
