"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { UnitRecord, UnitSummary } from "@/lib/types";

// One shared list for the sidebar, the upload picker and the move-to-unit control.
let current: UnitSummary[] | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load() {
  inflight ??= fetch("/api/units", { cache: "no-store" })
    .then((r) => r.json())
    .then((j: { units: UnitSummary[] }) => {
      current = j.units;
      listeners.forEach((l) => l());
    })
    .catch(() => {
      /* keep the last list */
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Fired after anything in the library is renamed, moved or deleted. */
export const LIBRARY_EVENT = "recall:library";

let listening = false;
const subscribe = (l: () => void) => {
  listeners.add(l);
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener(LIBRARY_EVENT, () => load());
  }
  return () => listeners.delete(l);
};

/** Reloads every unit list on the page, e.g. after an upload, rename or delete. */
export const refreshUnits = () => load();

/** Creates a unit and refreshes the shared list. Throws with a readable message on failure. */
export async function createUnit(name: string, code: string): Promise<UnitRecord> {
  const res = await fetch("/api/units", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, code }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Could not create the unit.");
  await load();
  return json.unit as UnitRecord;
}

/** All units with their counts; null until the first load finishes. */
export function useUnits() {
  const units = useSyncExternalStore(subscribe, () => current, () => null);
  useEffect(() => {
    if (!current) load();
  }, []);
  const refresh = useCallback(() => load(), []);
  return { units, refresh };
}
