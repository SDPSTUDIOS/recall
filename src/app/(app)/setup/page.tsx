import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { CopyCommand, SetupChecklist } from "@/components/SetupChecklist";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Setup & help" };

export default function SetupPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-12">
      <PageHeader
        eyebrow="Setup & help"
        title={
          <h1 className="font-display text-4xl leading-[1.05] sm:text-5xl">
            Connect <span className="text-subtle">Claude</span>
          </h1>
        }
        description="Recall runs on your own computer and uses your Claude subscription through Claude Code. Setup takes about two minutes."
      />

      <SetupChecklist />

      <section className="space-y-3">
        <h2 className="flex items-center gap-3">
          <span className="text-sm font-semibold">Questions</span>
          <span aria-hidden className="h-px flex-1 bg-line" />
        </h2>
        <div className="surface divide-y divide-line overflow-hidden rounded-xl">
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
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[15px] font-medium transition-colors hover:bg-sunken [&::-webkit-details-marker]:hidden">
        {q}
        <span className="grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset ring-line transition-[transform,background-color] duration-300 group-open:rotate-45 group-open:bg-foreground group-open:text-background">
          <Plus className="size-3.5 text-subtle" aria-hidden />
        </span>
      </summary>
      <div className="animate-fade-up px-5 pb-5 text-sm leading-relaxed text-muted">{children}</div>
    </details>
  );
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-800 ring-1 ring-inset ring-line dark:text-zinc-200">{children}</code>
  );
}
