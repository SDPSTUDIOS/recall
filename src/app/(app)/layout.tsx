import Link from "next/link";
import type { ReactNode } from "react";
import { ClaudeStatusBadge } from "@/components/ClaudeStatusBadge";
import { LogoMark } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Header, nav and footer for the app itself. The welcome page has its own chrome. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/75 backdrop-blur-md backdrop-saturate-150 dark:border-zinc-800/80 dark:bg-zinc-950/75">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Link href="/" aria-label="Recall home" className="flex min-h-9 shrink-0 items-center gap-2 rounded-lg font-bold tracking-tight">
            <LogoMark className="size-8 drop-shadow-sm" />
            <span className="hidden text-[17px] sm:inline" aria-hidden>
              Recall
            </span>
          </Link>
          <span className="mx-1 hidden h-5 w-px bg-zinc-200 sm:block dark:bg-zinc-800" />
          <NavLinks />
          <div className="ml-auto flex items-center gap-2">
            <ClaudeStatusBadge />
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted">
          <span>Recall · open source, runs locally on your Claude subscription</span>
          <span>
            <Link href="/setup" className="font-medium underline-offset-4 hover:text-zinc-800 hover:underline dark:hover:text-zinc-200">
              Setup & help
            </Link>
          </span>
        </div>
      </footer>
    </>
  );
}
