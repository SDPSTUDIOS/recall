import Link from "next/link";
import type { ReactNode } from "react";
import { Github } from "@/components/BrandIcons";
import { ClaudeStatusBadge } from "@/components/ClaudeStatusBadge";
import { CommandPalette, CommandTrigger } from "@/components/CommandPalette";
import { LogoMark } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarUnits } from "@/components/units/SidebarUnits";

function HomeLink({ wordmark = "always" }: { wordmark?: "always" | "sm" }) {
  return (
    <Link href="/" aria-label="Recall home" className="group flex min-h-9 shrink-0 items-center gap-2.5 rounded-md">
      <LogoMark className="size-7" />
      <span
        className={`text-[15px] font-semibold tracking-tight ${wordmark === "sm" ? "hidden sm:inline" : ""}`}
        aria-hidden
      >
        Recall
      </span>
    </Link>
  );
}

/**
 * A full-height side panel on large screens; a top bar with tabs below that.
 * Only one of the two navs is displayed at a time, so screen readers see a
 * single "Main" nav. The welcome page has its own chrome.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:text-background"
      >
        Skip to content
      </a>
      <CommandPalette />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-background lg:flex">
        <div className="flex h-14 items-center px-4">
          <HomeLink />
        </div>
        <div className="px-3 pt-1 pb-4">
          <CommandTrigger />
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <div className="px-2.5 pb-1.5 text-xs text-subtle">Workspace</div>
          <NavLinks variant="sidebar" />
          <SidebarUnits />
        </div>
        <div className="space-y-1 border-t border-line p-3">
          <ClaudeStatusBadge detailed className="-mx-0.5" />
          <div className="flex items-center justify-between gap-2 px-2.5 pt-1">
            <span className="text-xs text-subtle">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <div className="app-shell flex min-h-full flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-line bg-background/85 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-6 sm:px-6">
            <HomeLink wordmark="sm" />
            <NavLinks />
            <div className="ml-auto flex items-center gap-2">
              <CommandTrigger compact />
              <ClaudeStatusBadge />
            </div>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
          {children}
        </main>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5 text-[13px] text-subtle sm:px-6 lg:px-10">
            <span className="inline-flex items-center gap-2">
              <LogoMark className="size-4" />
              Open source. Runs on your computer with your Claude subscription.
            </span>
            <span className="flex items-center gap-5">
              <Link href="/setup" className="underline-offset-4 transition-colors hover:text-foreground hover:underline">
                Help
              </Link>
              <a
                href="https://github.com/SDPSTUDIOS/recall"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                <Github className="size-3.5" /> GitHub
              </a>
              {/* The side panel has its own theme switch. */}
              <span className="lg:hidden">
                <ThemeToggle />
              </span>
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
