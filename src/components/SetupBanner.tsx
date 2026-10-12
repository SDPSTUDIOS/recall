"use client";

import Link from "next/link";
import { ArrowRight, PlugZap } from "lucide-react";
import { useClaudeStatus } from "./useClaudeStatus";
import { buttonClass } from "./ui";

/** Shown until Claude Code is installed and signed in. */
export function SetupBanner() {
  const { status } = useClaudeStatus();
  if (!status || status.loggedIn) return null;

  return (
    <div className="animate-fade-up flex flex-wrap items-center gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
        <PlugZap className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium text-amber-900 dark:text-amber-200">
          {status.installed ? "Sign in to Claude Code to start" : "Connect Claude to start"}
        </div>
        <p className="text-amber-800/80 dark:text-amber-300/80">
          You can upload PDFs now. Generating and grading questions needs Claude Code signed in to
          your Claude account.
        </p>
      </div>
      <Link href="/setup" className={buttonClass("primary")}>
        Set up <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
