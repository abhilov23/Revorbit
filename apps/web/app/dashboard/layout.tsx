import Link from "next/link";
import { LayoutDashboard, GitBranch, History, User } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Repositories", href: "/dashboard/repositories", icon: GitBranch },
  { name: "Reviews", href: "/dashboard/reviews", icon: History },
  { name: "Profile", href: "/dashboard/profile", icon: User },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-white dark:bg-black">
      <aside className="hidden w-56 shrink-0 border-r border-gray-200 px-4 py-8 dark:border-gray-800 lg:block">
        <Link href="/dashboard" className="mb-8 block px-2 text-xl font-bold">
          Revorbit
        </Link>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <item.icon className="size-4" />
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex-1">
        <nav className="flex items-center gap-1 border-b border-gray-200 px-4 py-3 dark:border-gray-800 lg:hidden">
          <Link href="/dashboard" className="mr-auto text-lg font-bold">
            Revorbit
          </Link>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <item.icon className="size-5" />
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
