"use client";

import Link from "next/link";
import { useClaudeStatus } from "./useClaudeStatus";
import { cx } from "./ui";

export function ClaudeStatusBadge({ className, detailed = false }: { className?: string; detailed?: boolean }) {
  const { status } = useClaudeStatus();
  const ok = status?.loggedIn;

  const label = !status
    ? "Checking Claude…"
    : ok
      ? `Claude ${status.subscriptionType ? capitalize(status.subscriptionType) : "connected"}`
      : status.installed
        ? "Claude not signed in"
        : "Set up Claude";

  const sub = !status ? "Looking for Claude Code" : ok ? "Connected via Claude Code" : "Click to finish setup";

  const title = !status
    ? undefined
    : ok
      ? `Connected through Claude Code${status.email ? ` as ${status.email}` : ""}`
      : status.installed
        ? "Claude Code isn't signed in. Click to see how to sign in from a terminal."
        : "Claude Code isn't ready yet. Click for setup steps.";

  const dot = (
    <span className="relative grid size-2.5 shrink-0 place-items-center" aria-hidden>
      {status && (
        <span
          className={cx(
            "absolute inset-0 animate-ping rounded-full opacity-50 [animation-duration:2.4s]",
            ok ? "bg-emerald-500" : "bg-amber-500",
          )}
        />
      )}
      <span
        className={cx(
          "relative size-2 rounded-full",
          !status ? "animate-pulse bg-zinc-400" : ok ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
    </span>
  );

  if (detailed) {
    return (
      <Link
        href="/setup"
        title={title}
        className={cx(
          "group flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900",
          className,
        )}
      >
        {dot}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{label}</span>
          <span className="block truncate text-xs text-subtle">{sub}</span>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/setup"
      title={title}
      className={cx(
        "inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-line px-2.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-foreground pointer-coarse:h-10",
        className,
      )}
    >
      {dot}
      <span className="hidden xl:inline">{label}</span>
      <span className="xl:hidden">{!status ? "…" : ok ? "Claude" : "Setup"}</span>
    </Link>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
