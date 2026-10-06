"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  Bot,
  GitBranch,
  History,
  LayoutDashboard,
  Settings2,
  UserRound,
} from "lucide-react";

import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Repositories", href: "/dashboard/repositories", icon: GitBranch },
  { name: "AI behavior", href: "/dashboard/ai-behavior", icon: Bot },
  { name: "Review history", href: "/dashboard/reviews", icon: History },
  { name: "Settings", href: "/dashboard/settings", icon: Settings2 },
  { name: "Account", href: "/dashboard/profile", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentPage = navItems.find((item) => isActive(pathname, item.href));

  return (
    <div className="min-h-screen bg-muted/30 text-foreground lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-background lg:flex">
        <Link href="/dashboard" className="flex h-20 items-center gap-3 px-7">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Logo className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">Revorbit</span>
        </Link>

        <div className="px-4 pt-5">
          <p className="px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Workspace
          </p>
          <nav aria-label="Workspace navigation" className="space-y-1">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-5">
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="text-sm font-medium">Reviews, in your workflow</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Connect a repository and Revorbit will review pull requests as
              they change.
            </p>
            <Link
              href="/dashboard/repositories"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:underline"
            >
              Manage repositories <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="border-b bg-background">
          <div className="flex h-16 items-center justify-between px-5 sm:px-8">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 lg:hidden"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo className="size-4" />
                </span>
                <span className="font-semibold">Revorbit</span>
              </Link>
              <span className="hidden text-sm text-muted-foreground lg:inline">
                Workspace <span className="mx-2 text-border">/</span>
              </span>
              <span className="text-sm font-medium">{currentPage?.name ?? "Workspace"}</span>
            </div>
            <Link
              href="/dashboard/profile"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <UserRound className="size-4" />
              <span className="hidden sm:inline">Account</span>
            </Link>
          </div>
          <nav
            aria-label="Mobile workspace navigation"
            className="flex gap-1 overflow-x-auto border-t px-4 py-2 lg:hidden"
          >
            {navItems.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}
