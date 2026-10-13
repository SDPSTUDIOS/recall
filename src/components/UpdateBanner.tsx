"use client";

import { useEffect, useState } from "react";
import { ArrowUpCircle, LoaderCircle, X } from "lucide-react";
import type { UpdateStatus } from "@/lib/updates";
import { buttonClass } from "./ui";

const DISMISSED_KEY = "recall:update-dismissed";
const RESTART_TIMEOUT_MS = 5 * 60 * 1000;

function dismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

/** Waits for the restarted server to answer as the new version, then reloads. */
async function waitForVersion(version: string): Promise<boolean> {
  const deadline = Date.now() + RESTART_TIMEOUT_MS;
  // Give the old server a moment to stop, so we don't see it still answering.
  await new Promise((r) => setTimeout(r, 2000));
  while (Date.now() < deadline) {
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const body = (await res.json()) as { app?: string; version?: string };
      if (body.app === "recall" && body.version === version) return true;
    } catch {
      // Between servers: keep waiting.
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Shown on the home page when a newer release is out. */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [phase, setPhase] = useState<"idle" | "updating" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/app/update", { cache: "no-store" })
      .then((r) => r.json())
      .then((s: UpdateStatus) => {
        if (s.available && s.latest !== dismissedVersion()) setStatus(s);
      })
      .catch(() => {});
  }, []);

  if (!status) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, status.latest ?? "");
    } catch {
      // Private window: it just shows again next time.
    }
    setStatus(null);
  };

  const update = async () => {
    setPhase("updating");
    setError(null);
    try {
      const res = await fetch("/api/app/update", { method: "POST" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't start the update.");
      if (await waitForVersion(status.latest!)) {
        location.reload();
      } else {
        throw new Error("Recall didn't come back after updating. Open it again from its desktop shortcut.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("failed");
    }
  };

  return (
    <div className="animate-fade-up flex flex-wrap items-center gap-4 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-900 dark:bg-brand-900/25">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-300">
        <ArrowUpCircle className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <div className="font-medium text-brand-900 dark:text-brand-200">
          Recall {status.latest} is available
        </div>
        <p className="text-brand-800/80 dark:text-brand-300/80">
          {phase === "updating"
            ? "Updating. This page reloads by itself when it's done, usually in under a minute."
            : error
              ? error
              : status.canInstall
                ? `You have ${status.current}. Your PDFs, question sets and results are kept.`
                : `You have ${status.current}. Pull the latest code to update.`}
        </p>
      </div>
      {status.canInstall ? (
        <button
          type="button"
          onClick={update}
          disabled={phase === "updating"}
          className={buttonClass("primary")}
        >
          {phase === "updating" ? (
            <>
              <LoaderCircle className="size-4 animate-spin" /> Updating
            </>
          ) : phase === "failed" ? (
            "Try again"
          ) : (
            "Update now"
          )}
        </button>
      ) : (
        <a href={status.releaseUrl} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
          What&apos;s new
        </a>
      )}
      {phase !== "updating" && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss until the next version"
          className={buttonClass("ghost", "px-2")}
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
