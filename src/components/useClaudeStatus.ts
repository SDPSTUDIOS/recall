"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { ClaudeStatus } from "@/lib/claude";

// One shared status for the header badge, the setup banner and the setup page.
let current: ClaudeStatus | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load(force: boolean) {
  if (inflight && !force) return inflight;
  inflight = fetch(`/api/claude/status${force ? "?refresh=1" : ""}`, { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => ({ installed: false, loggedIn: false, error: "Could not reach the app server." }))
    .then((s: ClaudeStatus) => {
      current = s;
      listeners.forEach((l) => l());
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Claude Code CLI status; null while the first check runs. */
export function useClaudeStatus() {
  const status = useSyncExternalStore(subscribe, () => current, () => null);
  useEffect(() => {
    if (!current) load(false);
  }, []);
  const refresh = useCallback(() => load(true), []);
  return { status, refresh };
}
