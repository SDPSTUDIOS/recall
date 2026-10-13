import Link from "next/link";
import type { ReactNode } from "react";
import { ClaudeStatusBadge } from "@/components/ClaudeStatusBadge";
import { LogoMark } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";

function HomeLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="Recall home"
      className={`flex min-h-9 shrink-0 items-center gap-2 rounded-lg font-bold tracking-tight ${className ?? ""}`}
    >
      <LogoMark className="size-8 drop-shadow-sm" />
      <span className="text-[17px]" aria-hidden>
        Recall
      </span>
    </Link>
  );
}

/**
 * Sidebar on large screens, a compact top bar below that. The welcome page has its own chrome.
 * Only one of the two navs is displayed at a time, so screen readers see a single "Main" nav.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-zinc-200/80 bg-white/75 backdrop-blur-md backdrop-saturate-150 lg:flex dark:border-zinc-800/80 dark:bg-zinc-950/75">
        <div className="flex h-16 items-center px-5">
          <HomeLink />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks variant="sidebar" />
        </div>
        <div className="space-y-3 border-t border-zinc-200/80 p-4 dark:border-zinc-800/80">
          <ClaudeStatusBadge className="w-full" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="app-shell flex min-h-full flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/75 backdrop-blur-md backdrop-saturate-150 lg:hidden dark:border-zinc-800/80 dark:bg-zinc-950/75">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
            <HomeLink className="[&>span]:hidden sm:[&>span]:inline" />
            <span className="mx-1 hidden h-5 w-px bg-zinc-200 sm:block dark:bg-zinc-800" />
            <NavLinks />
            <div className="ml-auto flex items-center gap-2">
              <ClaudeStatusBadge />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 lg:px-8 lg:py-10">
          {children}
        </main>
        <footer className="border-t border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted lg:px-8">
            <span>Recall · open source, runs locally on your Claude subscription</span>
            <Link
              href="/setup"
              className="font-medium underline-offset-4 hover:text-zinc-800 hover:underline lg:hidden dark:hover:text-zinc-200"
            >
              Setup & help
            </Link>
          </div>
        </footer>
      </div>
    </>
  );
}
