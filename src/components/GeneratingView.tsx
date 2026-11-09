"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WorkingView } from "./WorkingView";

/** Polls the quiz until generation finishes, then refreshes the page. */
export function GeneratingView({
  quizId,
  startedAt,
  model,
  visual,
  count,
}: {
  quizId: string;
  startedAt: number;
  model: string;
  visual: boolean;    
  count: number;
}) {
  const router = useRouter();
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    const t = setInterval(tick, 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/quizzes/${quizId}`, { cache: "no-store" });
        const json = await res.json();
        if (json.status !== "generating") router.refresh();
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => {
      clearInterval(t);
      clearInterval(poll);
    };
  }, [quizId, startedAt, router]);

  const step = elapsed === null || elapsed < 8000 ? 0 : 1;

  return (
    <WorkingView
      title="Claude is writing your questions"
      steps={[visual ? "Reading the pages" : "Reading the material", `Writing ${count} questions`, "Ready to practise"]}
      step={step}
      detail={elapsed !== null && elapsed >= 60_000 ? "Long or visual sets can take a few minutes" : undefined}
      model={model}
      elapsed={elapsed}
      note={
        <>
          Usually 30 seconds to a few minutes. You can leave this page; the set will be in your library when it&apos;s
          ready.
        </>
      }
      back={{ href: "/", label: "Back to library" }}
    />
  );
}
