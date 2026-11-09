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
    <div className="animate-fade-up flex flex-wrap items-center gap-4 rounded-xl border border-line-strong bg-sunken p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-amber-600/30 text-amber-700 dark:border-amber-400/30 dark:text-amber-400">
        <PlugZap className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-semibold">
          {status.installed ? "Sign in to Claude Code to start" : "Connect Claude to start"}
        </div>
        <p className="mt-0.5 text-muted">
          You can upload PDFs now. Generating and grading questions needs Claude Code signed in to your Claude account.
        </p>
      </div>
      <Link href="/setup" className={buttonClass("primary")}>
        Set up <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
