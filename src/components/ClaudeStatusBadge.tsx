"use client";

import Link from "next/link";
import { useClaudeStatus } from "./useClaudeStatus";
import { cx } from "./ui";

export function ClaudeStatusBadge() {
  const { status } = useClaudeStatus();
  const ok = status?.loggedIn;

  const label = !status
    ? "Checking Claude…"
    : ok
      ? `Claude ${status.subscriptionType ? capitalize(status.subscriptionType) : "connected"}`
      : status.installed
        ? "Sign in to Claude"
        : "Set up Claude";

  const title = !status
    ? undefined
    : ok
      ? `Connected through Claude Code${status.email ? ` as ${status.email}` : ""}`
      : "Claude Code isn't ready yet. Click for setup steps.";

  return (
    <Link
      href="/setup"
      title={title}
      className={cx(
        "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        !status && "border-zinc-200 text-muted dark:border-zinc-800",
        status && ok && "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950",
        status && !ok && "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-950",
      )}
    >
      <span
        className={cx(
          "size-2 rounded-full",
          !status ? "animate-pulse bg-zinc-400" : ok ? "bg-emerald-500" : "animate-pulse bg-amber-500",
        )}
      />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{!status ? "…" : ok ? "Claude" : "Setup"}</span>
    </Link>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
