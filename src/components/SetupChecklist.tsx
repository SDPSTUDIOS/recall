"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Check, CheckCircle2, Copy, RefreshCw } from "lucide-react";
import { useClaudeStatus } from "./useClaudeStatus";
import { Button, Card, Spinner, buttonClass, cx } from "./ui";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-lg bg-zinc-950 py-1.5 pl-3 pr-1.5 font-mono text-[13px] text-zinc-100 dark:bg-black/50">
      <span className="select-none text-zinc-500">$</span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap">{command}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked */
          }
        }}
        className="grid size-7 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        aria-label={copied ? "Copied" : `Copy ${command}`}
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

function Step({
  n,
  done,
  active,
  title,
  children,
}: {
  n: number;
  done: boolean;
  active: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="group/step relative flex gap-4 pb-8 last:pb-0">
      <span
        className={cx(
          "z-10 grid size-8 shrink-0 place-items-center rounded-full border text-sm font-semibold",
          done
            ? "border-emerald-500 bg-emerald-500 text-white"
            : active
              ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
              : "border-zinc-300 bg-white text-muted dark:border-zinc-700 dark:bg-zinc-900",
        )}
      >
        {done ? <Check className="size-4" /> : n}
      </span>
      <span className="absolute left-4 top-8 -ml-px h-full w-0.5 bg-zinc-200 group-last/step:hidden dark:bg-zinc-800" aria-hidden />
      <div className={cx("min-w-0 flex-1 pt-1", !active && !done && "opacity-60")}>
        <div className="font-medium">{title}</div>
        <div className="mt-2 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
      </div>
    </li>
  );
}

export function SetupChecklist() {
  const { status, refresh } = useClaudeStatus();
  const [checking, setChecking] = useState(false);
  const installed = !!status?.installed;
  const loggedIn = !!status?.loggedIn;

  const check = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  return (
    <Card className="p-5 sm:p-6">
      {!status ? (
        <div className="flex items-center gap-3 text-sm text-muted">
          <Spinner /> Checking for Claude Code…
        </div>
      ) : loggedIn ? (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium text-emerald-800 dark:text-emerald-300">You&apos;re all set</div>
            <div className="text-emerald-700/80 dark:text-emerald-400/80">
              Connected through Claude Code
              {status.subscriptionType ? ` on your ${capitalize(status.subscriptionType)} plan` : ""}
              {status.email ? ` as ${status.email}` : ""}.
            </div>
          </div>
          <Link href="/" className={buttonClass("primary")}>
            Go to library
          </Link>
        </div>
      ) : null}

      <ol>
        <Step n={1} done={installed} active={!installed} title="Install Claude Code">
          <p>Recall talks to Claude through the Claude Code command-line tool. Install it with one of:</p>
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted">macOS, Linux, WSL</div>
            <CopyCommand command="curl -fsSL https://claude.ai/install.sh | bash" />
            <div className="pt-1 text-xs font-medium text-muted">Windows (PowerShell)</div>
            <CopyCommand command="irm https://claude.ai/install.ps1 | iex" />
            <div className="pt-1 text-xs font-medium text-muted">Or with npm (Node 18+)</div>
            <CopyCommand command="npm install -g @anthropic-ai/claude-code" />
          </div>
        </Step>
        <Step n={2} done={loggedIn} active={installed && !loggedIn} title="Sign in with your Claude account">
          <p>
            Run this in a terminal and log in with the account that has your Claude Pro or Max
            plan. Generating and grading then count toward that plan, with no API key or extra billing.
          </p>
          <CopyCommand command="claude auth login" />
        </Step>
        <Step n={3} done={loggedIn} active={installed && !loggedIn} title="Check the connection">
          <p>Come back here and check again. If you just installed Claude Code, restart the app first so it picks up the new PATH.</p>
          <Button variant="secondary" onClick={check} disabled={checking}>
            {checking ? <Spinner /> : <RefreshCw className="size-4" />} Check again
          </Button>
          {status && !loggedIn && status.error && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted">Details</summary>
              <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-zinc-100 p-2 font-mono text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {status.error}
              </pre>
            </details>
          )}
        </Step>
      </ol>
    </Card>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
