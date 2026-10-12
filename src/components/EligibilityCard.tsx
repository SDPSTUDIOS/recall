"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { checkEligibility, type CheckState } from "@/lib/eligibility";
import { CopyCommand } from "./SetupChecklist";
import { useClaudeStatus } from "./useClaudeStatus";
import { Button, Card, ErrorText, Spinner, cx } from "./ui";

const ICONS: Record<CheckState, React.ReactNode> = {
  pass: <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />,
  warn: <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" aria-hidden />,
  fail: <XCircle className="size-5 text-red-600 dark:text-red-400" aria-hidden />,
  pending: <span className="block size-5 rounded-full border-2 border-dashed border-zinc-300 dark:border-zinc-700" aria-hidden />,
};

const STATE_TEXT: Record<CheckState, string> = {
  pass: "Passed",
  warn: "Warning",
  fail: "Not yet",
  pending: "Waiting",
};

/** First-run check that Claude Code is ready, with fixes inline, then finishes onboarding. */
export function EligibilityCard() {
  const router = useRouter();
  const { status, refresh } = useClaudeStatus();
  const [checking, setChecking] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { checks, ready } = checkEligibility(status);
  const loading = !status || checking;

  const recheck = async () => {
    setChecking(true);
    await refresh();
    setChecking(false);
  };

  const finish = async () => {
    setFinishing(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", { method: "POST" });
      if (!res.ok) throw new Error();
      // Replace, so Back doesn't return to a page the proxy now redirects away from.
      router.replace("/");
    } catch {
      setError("Couldn't save that. Check the app is still running and try again.");
      setFinishing(false);
    }
  };

  const summary = loading
    ? "Checking this computer…"
    : ready
      ? checks.some((c) => c.state === "warn")
        ? "Ready, with one thing to note"
        : "You're all set"
      : "A couple of steps to go";

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-zinc-200 px-5 py-4 sm:px-6 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">Check your setup</h2>
          <button
            type="button"
            onClick={recheck}
            disabled={loading}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-muted transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 pointer-coarse:min-h-10 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <RefreshCw className={cx("size-3.5", checking && "animate-spin")} aria-hidden />
            Check again
          </button>
        </div>
        <p className="mt-0.5 text-sm text-muted" aria-live="polite">
          {summary}
        </p>
      </div>

      <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {checks.map((c) => (
          <li key={c.id} className="flex gap-3 px-5 py-4 sm:px-6">
            <span className="mt-px shrink-0">
              {loading && c.state === "pending" ? <Spinner className="size-5 text-subtle" /> : ICONS[c.state]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">
                {c.label}
                <span className="sr-only">: {STATE_TEXT[c.state]}</span>
              </div>
              <p className="mt-0.5 break-words text-sm text-muted">{c.detail}</p>

              {c.id === "installed" && c.state === "fail" && (
                <div className="mt-3 space-y-1.5">
                  <div className="text-xs font-medium text-muted">Windows (PowerShell)</div>
                  <CopyCommand command="irm https://claude.ai/install.ps1 | iex" />
                  <div className="pt-1 text-xs font-medium text-muted">macOS, Linux, WSL</div>
                  <CopyCommand command="curl -fsSL https://claude.ai/install.sh | bash" />
                  <p className="pt-1 text-xs text-muted">
                    Then restart Recall from a new terminal so it finds the new command.
                  </p>
                </div>
              )}
              {c.id === "signedIn" && c.state === "fail" && (
                <div className="mt-3 space-y-1.5">
                  <CopyCommand command="claude auth login" />
                  <p className="text-xs text-muted">
                    Use the account with your Claude Pro or Max plan, then check again.
                  </p>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="space-y-3 border-t border-zinc-200 bg-zinc-50 px-5 py-4 sm:px-6 dark:border-zinc-800 dark:bg-zinc-900/60">
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xs text-xs text-muted">
            {ready
              ? "This check runs once. You can revisit it any time from Setup & help."
              : "You can upload PDFs now and finish this later from Setup & help."}
          </p>
          <Button
            variant={ready || loading ? "primary" : "secondary"}
            onClick={finish}
            disabled={finishing || loading}
            className="ml-auto"
          >
            {finishing ? <Spinner /> : null}
            {ready || loading ? "Start using Recall" : "Continue anyway"}
            {!finishing && <ArrowRight className="size-4" aria-hidden />}
          </Button>
        </div>
      </div>
    </Card>
  );
}
