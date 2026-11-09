import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { formatDuration } from "@/lib/format";
import { ThoughtCloud } from "./Logo";
import { buttonClass, cx } from "./ui";

/**
 * The screen shown while Claude works in the background: the Recall thought
 * cloud with its bubbles rising in turn, a timeline of stages and a running
 * clock. Shared by set generation and viva preparation.
 */
export function WorkingView({
  title,
  steps,
  step,
  detail,
  model,
  elapsed,
  note,
  back,
}: {
  title: string;
  steps: string[];
  /** Index of the stage in progress. */
  step: number;
  /** Extra line under the current stage. */
  detail?: string;
  model: string;
  elapsed: number | null;
  note: ReactNode;
  back: { href: string; label: string };
}) {
  return (
    <div className="animate-fade-up mx-auto max-w-md py-6 sm:py-12">
      <div className="w-fit origin-bottom-left animate-[breathe_3.2s_ease-in-out_infinite]" aria-hidden>
        <ThoughtCloud thinking className="size-16 text-foreground" />
      </div>

      <div aria-live="polite" className="mt-6">
        <h2 className="font-display text-3xl">{title}</h2>
        <p className="text-shimmer mt-2 text-sm font-medium">
          {steps[step]}
          {detail ? `. ${detail}` : ""}…
        </p>
      </div>

      <ol className="mt-8 space-y-0.5" aria-label="Progress">
        {steps.map((s, i) => {
          const done = i < step;
          const now = i === step;
          return (
            <li key={s} className="relative flex items-center gap-3 py-1.5 pl-0.5 text-sm">
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className={cx(
                    "absolute top-[1.375rem] left-[0.6875rem] h-full w-px transition-colors duration-500",
                    done ? "bg-foreground" : "bg-line-strong",
                  )}
                />
              )}
              <span
                aria-hidden
                className={cx(
                  "relative grid size-[1.125rem] shrink-0 place-items-center rounded-full transition-colors duration-500",
                  done && "bg-foreground text-background",
                  now && "border-[1.5px] border-foreground bg-background",
                  !done && !now && "border border-line-strong bg-background",
                )}
              >
                {done && <Check className="size-2.5" strokeWidth={3.5} />}
                {now && <span className="size-1.5 animate-pulse rounded-full bg-foreground" />}
              </span>
              <span className={cx(done || now ? "text-foreground" : "text-subtle", now && "font-medium")}>
                {s}
                <span className="sr-only">{done ? " (done)" : now ? " (in progress)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-8">
        <div className="h-px overflow-hidden bg-line-strong">
          <div className="h-full w-1/3 animate-[indeterminate_1.6s_cubic-bezier(0.65,0,0.35,1)_infinite] bg-foreground" />
        </div>
        <div className="mt-2.5 flex justify-between font-mono text-xs tabular-nums text-subtle">
          <span>{model}</span>
          <span>{elapsed !== null ? formatDuration(Math.max(0, elapsed)) : ""}</span>
        </div>
      </div>

      <p className="mt-8 text-[13px] leading-relaxed text-muted">{note}</p>
      <Link href={back.href} className={buttonClass("secondary", "mt-5")}>
        {back.label}
      </Link>
    </div>
  );
}
