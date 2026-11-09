"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { VivaSource } from "@/lib/types";
import { WorkingView } from "../WorkingView";

/** Polls the viva until preparation finishes, then refreshes the page. */
export function VivaPreparing({
  vivaId,
  startedAt,
  model,
  repoName,
  source,
}: {
  vivaId: string;
  startedAt: number;
  model: string;
  repoName: string;
  source: VivaSource;
}) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const t = setInterval(tick, 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/vivas/${vivaId}`, { cache: "no-store" });
        const json = await res.json();
        if (json.status !== "preparing") router.refresh();
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      clearInterval(t);
      clearInterval(poll);
    };
  }, [vivaId, startedAt, router]);

  const step = elapsed === null || elapsed < 10_000 ? 0 : elapsed < 90_000 ? 1 : 2;

  return (
    <WorkingView
      title="Claude is preparing your viva"
      steps={[source === "zip" ? `Unpacking ${repoName}.zip` : `Downloading ${repoName}`, "Reading the code", "Planning the questions"]}
      step={step}
      detail={step === 2 ? "Large projects can take a few minutes" : undefined}
      model={model}
      elapsed={elapsed}
      note={
        <>
          Claude reads through the project and plans its questions, which usually takes one to a few minutes. You can
          leave this page; the viva will be waiting under Viva when it&apos;s ready.
        </>
      }
      back={{ href: "/vivas", label: "Back to vivas" }}
    />
  );
}
