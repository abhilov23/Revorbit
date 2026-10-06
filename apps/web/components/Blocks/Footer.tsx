import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="mt-12 border-t border-gray-200 dark:border-gray-800">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
        <div className="max-w-sm">
          <Link href="/" className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">Revorbit</Link>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
            AI-assisted code reviews for GitHub pull requests, with findings delivered where your team already works.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Product</h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <li><Link href="#features" className="transition-colors hover:text-foreground">How it works</Link></li>
            <li><Link href="#faq" className="transition-colors hover:text-foreground">Questions</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Get started</h2>
          <ul className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <li><Link href="/signup" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">Create an account <ArrowUpRight className="size-3.5" /></Link></li>
            <li><Link href="/login" className="transition-colors hover:text-foreground">Sign in</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-200 px-6 py-5 dark:border-gray-800">
        <p className="mx-auto max-w-7xl text-xs text-gray-500 dark:text-gray-400">© {new Date().getFullYear()} Revorbit</p>
      </div>
    </footer>
  );
};
