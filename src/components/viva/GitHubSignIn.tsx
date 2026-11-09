"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, LockKeyhole } from "lucide-react";
import { Button, ErrorText, Spinner, buttonClass, cx, inputClass } from "../ui";

interface Device {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
}

/**
 * One-off GitHub sign-in for a private repository: either GitHub's device flow
 * ("enter this code on github.com") or a pasted access token. The token is handed
 * to `onToken` for a single download and not stored anywhere.
 */
export function GitHubSignIn({
  repoName,
  onToken,
  onCancel,
  busy = false,
  error,
}: {
  repoName: string;
  onToken: (token: string) => void;
  onCancel: () => void;
  /** The download is being tried with the token. */
  busy?: boolean;
  /** Why the last attempt with a token failed. */
  error?: string | null;
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"device" | "token">("device");
  const [device, setDevice] = useState<Device | null>(null);
  const [starting, setStarting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    fetch("/api/github/device", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive.current) return;
        setEnabled(Boolean(j?.enabled));
        if (!j?.enabled) setMode("token");
      })
      .catch(() => {
        if (alive.current) {
          setEnabled(false);
          setMode("token");
        }
      });
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function stopPolling() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }

  function poll(d: Device, interval: number) {
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/github/device/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode: d.deviceCode }),
        });
        const j = await res.json();
        if (!alive.current) return;
        if (!res.ok) throw new Error(j?.error ?? "GitHub sign-in failed.");
        if (j.status === "done") {
          setDevice(null);
          setStatus(null);
          onToken(j.token);
        } else if (j.status === "pending") {
          poll(d, j.interval ?? interval);
        } else {
          setDevice(null);
          setProblem(
            j.status === "expired" ? "The code expired before it was entered. Start again." : "Sign-in was cancelled on GitHub.",
          );
        }
      } catch (err) {
        if (!alive.current) return;
        setDevice(null);
        setProblem(err instanceof Error ? err.message : "GitHub sign-in failed.");
      }
    }, interval * 1000);
  }

  async function start() {
    stopPolling();
    setStarting(true);
    setProblem(null);
    try {
      const res = await fetch("/api/github/device", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Couldn't start GitHub sign-in.");
      setDevice(j);
      setStatus("Waiting for you to approve on GitHub…");
      poll(j, j.interval ?? 5);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setStarting(false);
    }
  }

  async function copyAndOpen(d: Device) {
    try {
      await navigator.clipboard.writeText(d.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the code is on screen to type instead */
    }
    window.open(d.verificationUri, "_blank", "noopener,noreferrer");
  }

  const shownError = problem ?? error ?? null;

  return (
    <div className="animate-fade-up space-y-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-5">
      <div className="flex gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-700 ring-1 ring-inset ring-amber-500/25 dark:text-amber-300">
          <LockKeyhole className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 text-sm">
          <div className="font-semibold">Sign in to GitHub to fetch {repoName}</div>
          <p className="mt-0.5 text-muted">
            GitHub didn&apos;t show this repository without signing in, so it&apos;s probably private. Your sign-in is
            used for this one download and isn&apos;t saved.
          </p>
        </div>
      </div>

      {enabled === null ? (
        <Spinner className="text-subtle" />
      ) : busy ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-3.5" /> Fetching {repoName}…
        </p>
      ) : mode === "device" ? (
        device ? (
          <div className="space-y-3">
            <p className="text-sm">
              Enter this code on GitHub and approve access for Recall:
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <code className="surface rounded-lg px-5 py-2.5 font-mono text-2xl font-semibold tracking-[0.25em]">
                {device.userCode}
              </code>
              <Button onClick={() => copyAndOpen(device)}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy code and open GitHub"}
                <ExternalLink className="size-3.5 opacity-70" aria-hidden />
              </Button>
            </div>
            {status && (
              <p className="flex items-center gap-2 text-sm text-muted" aria-live="polite">
                <Spinner className="size-3.5" /> {status}
              </p>
            )}
          </div>
        ) : (
          <Button onClick={start} disabled={starting}>
            {starting ? <Spinner /> : <GitHubMark />} Sign in with GitHub
          </Button>
        )
      ) : (
        // Not a <form>: this panel sits inside the viva form.
        <div className="space-y-2">
          <label className="block space-y-1.5">
            <span className="text-sm">GitHub access token</span>
            <div className="flex gap-2">
              <input
                type="password"
                className={cx(inputClass, "font-mono")}
                placeholder="github_pat_… or ghp_…"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (token.trim()) onToken(token.trim());
                  }
                }}
                autoComplete="off"
                spellCheck={false}
              />
              <Button onClick={() => onToken(token.trim())} disabled={!token.trim()}>
                <KeyRound className="size-4" /> Continue
              </Button>
            </div>
          </label>
          <p className="text-xs text-muted">
            <a
              href="https://github.com/settings/personal-access-tokens/new"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline-offset-4 underline"
            >
              Create a fine-grained token
            </a>{" "}
            with read-only <strong>Contents</strong> access to {repoName}, and a short expiry. Recall uses it once and
            forgets it.
          </p>
          {!enabled && (
            <p className="text-xs text-subtle">
              For a &ldquo;Sign in with GitHub&rdquo; button instead, set <code>GITHUB_CLIENT_ID</code> (see the README).
            </p>
          )}
        </div>
      )}

      {shownError && <ErrorText>{shownError}</ErrorText>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {enabled && !busy && (
          <button
            type="button"
            className="font-medium text-foreground underline-offset-4 hover:underline"
            onClick={() => {
              stopPolling();
              setDevice(null);
              setProblem(null);
              setMode(mode === "device" ? "token" : "device");
            }}
          >
            {mode === "device" ? "Use an access token instead" : "Sign in with GitHub instead"}
          </button>
        )}
        <button
          type="button"
          className={buttonClass("ghost", "ml-auto py-1")}
          onClick={() => {
            stopPolling();
            onCancel();
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
