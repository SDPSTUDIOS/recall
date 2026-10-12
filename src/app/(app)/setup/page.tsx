import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { CopyCommand, SetupChecklist } from "@/components/SetupChecklist";

export const metadata: Metadata = { title: "Setup & help" };

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Connect Claude</h1>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Recall runs on your own computer and uses your Claude subscription through Claude
          Code. Setup takes about two minutes.
        </p>
      </div>

      <SetupChecklist />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Questions</h2>
        <div className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          <Faq q="Does it cost anything?">
            No extra cost. Requests use your Claude Pro or Max plan and count toward its usage
            limits, like using Claude Code yourself. Haiku and Text mode use the least.
          </Faq>
          <Faq q="Where are my files stored?">
            Everything stays on this computer: PDFs in <Code>data/uploads</Code> and your library,
            question sets and attempts in <Code>data/exam-helper.db</Code>. The lecture text is sent
            to Claude only to write and grade questions.
          </Faq>
          <Faq q="Which model should I pick?">
            Sonnet is a good default. Opus is best for hard or technical material, and Haiku is the
            fastest and lightest on your limits. You can also type any full model ID.
          </Faq>
          <Faq q="Text or Visual mode?">
            Text is fast and works for most slides and notes. Use Visual when the PDF is scanned or
            the important content is in diagrams, charts or screenshots of code.
          </Faq>
          <Faq q="Claude Code is installed but not found">
            The app runs <Code>claude</Code> from the PATH it was started with. Restart{" "}
            <Code>npm run dev</Code> from a new terminal, or point to the executable in{" "}
            <Code>.env.local</Code>:
            <span className="mt-2 block">
              <CopyCommand command="CLAUDE_BIN=/full/path/to/claude" />
            </span>
          </Faq>
        </div>
      </section>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group px-4 py-3.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        {q}
        <Plus className="size-4 shrink-0 text-subtle transition-transform duration-200 group-open:rotate-45" aria-hidden />
      </summary>
      <div className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{children}</div>
    </details>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-zinc-800">{children}</code>
  );
}
