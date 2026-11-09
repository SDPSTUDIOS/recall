import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Github } from "@/components/BrandIcons";
import { EligibilityCard } from "@/components/EligibilityCard";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cx } from "@/components/ui";

export const metadata: Metadata = { title: "Welcome" };

const PROMISES = [
  {
    title: "No account",
    text: "Nothing to sign up for. Recall uses the Claude Code you already have.",
  },
  {
    title: "Stays on your computer",
    text: "PDFs, question sets and scores are stored locally. Lecture text goes to Claude only to write and mark questions.",
  },
  {
    title: "No extra bill",
    text: "Runs on your Claude subscription, not an API key.",
  },
];

const STEPS = [
  { title: "Upload lectures", text: "Slides, notes or handouts as PDFs." },
  { title: "Generate a set", text: "Multiple choice to long answer and code." },
  { title: "Get marked", text: "Instant scores, written feedback, weak topics." },
];

/** First-run landing page. The proxy shows it until onboarding is completed once. */
export default function WelcomePage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo className="text-[15px]" />
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/SDPSTUDIOS/recall"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-foreground sm:inline-flex"
            >
              <Github className="size-3.5" /> Open source
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-14 px-4 pb-20 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-[1fr_26rem] lg:gap-20"
      >
        <section className="space-y-14">
          <div className="animate-fade-up">
            <p className="font-mono text-xs text-subtle">Practice exams from your own lectures</p>
            <h1 className="font-display mt-5 text-5xl leading-[1] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Remember more of
              <br />
              <span className="text-subtle">every lecture.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-muted">
              Recall turns your lecture PDFs into practice exams, then marks your answers with feedback, so you find the
              gaps before the real exam does.
            </p>
          </div>

          <PreviewCard />

          <ol className="stagger grid gap-8 sm:grid-cols-3">
            {STEPS.map(({ title, text }, i) => (
              <li key={title} className="border-t border-foreground pt-4" style={{ "--i": i + 2 } as React.CSSProperties}>
                <span className="font-mono text-xs text-subtle">0{i + 1}</span>
                <div className="mt-2 text-sm font-semibold">{title}</div>
                <p className="mt-0.5 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ol>

          <ul className="grid gap-8 border-t border-line pt-8 sm:grid-cols-3">
            {PROMISES.map(({ title, text }) => (
              <li key={title}>
                <div className="text-sm font-semibold">{title}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Setup" className="animate-fade-up [animation-delay:120ms] lg:sticky lg:top-8">
          <EligibilityCard />
        </section>
      </main>
    </div>
  );
}

/** A small, static picture of a marked question. Decorative, so hidden from screen readers. */
function PreviewCard() {
  const options = ["First normal form", "Second normal form", "Third normal form", "Boyce–Codd normal form"];
  return (
    <div aria-hidden className="animate-fade-up max-w-xl rounded-xl border border-line p-5 [animation-delay:60ms]">
      <div className="mb-4 flex items-center gap-3 text-[13px] text-subtle">
        <span className="font-mono">
          <span className="font-medium text-foreground">04</span>/20
        </span>
        <span className="h-3 w-px bg-line-strong" />
        <span>1 mark</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-600/25 px-2 py-px text-xs font-medium text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-400">
          <Check className="size-3" strokeWidth={3} /> Correct · 1/1
        </span>
      </div>
      <p className="text-[15px] font-medium">Which normal form removes transitive dependencies on the key?</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {options.map((o, i) => (
          <div
            key={o}
            className={cx(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
              i === 2 ? "border-emerald-600/60 dark:border-emerald-400/50" : "border-line opacity-55",
            )}
          >
            <span
              className={cx(
                "grid size-5 place-items-center rounded-full border font-mono text-[10px]",
                i === 2 ? "border-emerald-600 bg-emerald-600 text-white" : "border-line-strong",
              )}
            >
              {"ABCD"[i]}
            </span>
            {o}
          </div>
        ))}
      </div>
    </div>
  );
}
