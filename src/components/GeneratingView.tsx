"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { Card, buttonClass } from "./ui";

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

  const stage =
    elapsed === null || elapsed < 8000
      ? visual
        ? "Reading the pages"
        : "Reading the material"
      : elapsed < 60_000
        ? `Writing ${count} questions`
        : "Still writing. Long or visual sets can take a few minutes";

  return (
    <Card className="flex flex-col items-center gap-5 px-6 py-14 text-center">
      <span className="relative grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand-400/20" />
        <Sparkles className="size-7" />
      </span>
      <div aria-live="polite">
        <div className="text-lg font-semibold">Claude is writing your questions</div>
        <p className="mt-1 text-sm text-muted">{stage}…</p>
      </div>
      <div className="w-full max-w-xs">
        <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full w-1/3 animate-[indeterminate_1.4s_ease-in-out_infinite] rounded-full bg-brand-500" />
        </div>
        <div className="mt-2 flex justify-between font-mono text-xs tabular-nums text-subtle">
          <span>{model}</span>
          <span>{elapsed !== null ? formatDuration(Math.max(0, elapsed)) : ""}</span>
        </div>
      </div>
      <p className="max-w-sm text-xs text-muted">
        Usually 30 seconds to a few minutes. You can leave this page; the set will be in your
        library when it&apos;s ready.
      </p>
      <Link href="/" className={buttonClass("secondary")}>
        Back to library
      </Link>
    </Card>
  );
}
