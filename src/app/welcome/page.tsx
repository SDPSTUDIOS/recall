import type { Metadata } from "next";
import { FileUp, HardDrive, ListChecks, MessageSquareText, Sparkles, UserX } from "lucide-react";
import { EligibilityCard } from "@/components/EligibilityCard";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "Welcome" };

const PROMISES = [
  {
    icon: UserX,
    title: "No account",
    text: "Nothing to sign up for. Recall uses the Claude Code you already have.",
  },
  {
    icon: HardDrive,
    title: "Stays on your computer",
    text: "PDFs, question sets and scores are stored locally. Lecture text goes to Claude only to write and mark questions.",
  },
  {
    icon: Sparkles,
    title: "No extra bill",
    text: "Runs on your Claude subscription, not an API key.",
  },
];

const STEPS = [
  { icon: FileUp, title: "Upload lectures", text: "Slides, notes or handouts as PDFs." },
  { icon: ListChecks, title: "Generate a set", text: "Multiple choice to long answer and code." },
  { icon: MessageSquareText, title: "Get marked", text: "Instant scores, written feedback, weak topics." },
];

/** First-run landing page. The proxy shows it until onboarding is completed once. */
export default function WelcomePage() {
  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      {/* Soft brand glow behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-brand-400/20 blur-3xl dark:bg-brand-600/15"
      />

      <header className="relative mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4">
        <Logo className="text-lg" />
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-zinc-200 bg-white/70 px-3 py-1 text-xs font-medium text-muted sm:inline dark:border-zinc-800 dark:bg-zinc-900/70">
            Open source
          </span>
          <ThemeToggle />
        </div>
      </header>

      <main
        id="main"
        className="relative mx-auto grid w-full max-w-6xl flex-1 items-start gap-10 px-4 pb-16 pt-8 sm:pt-14 lg:grid-cols-[1fr_26rem] lg:gap-14"
      >
        <section className="animate-fade-up space-y-8">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              <Sparkles className="size-3.5" aria-hidden /> Practice exams from your own lectures
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
              Remember more of <span className="text-brand-600 dark:text-brand-400">every lecture.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
              Recall turns your lecture PDFs into practice exams, then marks your answers with
              feedback, so you find the gaps before the real exam does.
            </p>
          </div>

          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li
                key={title}
                className="rounded-xl border border-zinc-200/80 bg-white/70 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60"
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Step {i + 1}</span>
                </div>
                <div className="mt-2.5 text-sm font-semibold">{title}</div>
                <p className="mt-0.5 text-sm text-muted">{text}</p>
              </li>
            ))}
          </ol>

          <ul className="space-y-4">
            {PROMISES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <p className="text-sm text-muted">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Setup" className="animate-fade-up lg:sticky lg:top-8">
          <EligibilityCard />
        </section>
      </main>
    </div>
  );
}
