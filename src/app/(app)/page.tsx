import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { ArrowRight, Layers } from "lucide-react";
import { QuizList } from "@/components/QuizList";
import { SetupBanner } from "@/components/SetupBanner";
import { UploadDropzone } from "@/components/UploadDropzone";
import { UnitGrid } from "@/components/units/UnitGrid";
import { Eyebrow, Meter, PageLoading, SectionTitle, buttonClass } from "@/components/ui";
import { attemptStats, listDocuments, listQuizzes, listUnits } from "@/lib/repo";
import type { QuizRecord } from "@/lib/types";

export default function Home() {
  return (
    <div className="space-y-14">
      <SetupBanner />
      <section className="space-y-8">
        <div className="animate-fade-up">
          <h1 className="font-display text-4xl leading-[1.05] sm:text-[3.25rem]">
            Turn lectures into
            <br />
            <span className="text-subtle">practice exams.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted">
            Upload your lecture PDFs. Claude writes multiple choice, fill in the blank, long answer and code questions
            from them, then grades your answers.
          </p>
        </div>
        <UploadDropzone />
      </section>

      <Suspense fallback={<PageLoading />}>
        <Library />
      </Suspense>
    </div>
  );
}

async function Library() {
  await io();
  const documents = listDocuments();
  const quizzes = listQuizzes();
  const stats = attemptStats();

  const units = listUnits();
  if (units.length === 0 && quizzes.length === 0) return <HowItWorks />;

  const attempted = Object.values(stats);
  const attemptCount = attempted.reduce((n, s) => n + s.count, 0);
  const avgBest = attempted.length ? attempted.reduce((n, s) => n + s.best, 0) / attempted.length : null;

  return (
    <>
      {quizzes.length > 0 && (
        <section
          aria-label="Overview"
          className="animate-fade-up grid overflow-hidden rounded-xl border border-line [animation-delay:120ms] sm:grid-cols-2 lg:grid-cols-4"
        >
          <UpNext quizzes={quizzes} stats={stats} />
          <div className="flex flex-col justify-between gap-6 border-t border-line p-5 lg:border-t-0 lg:border-l">
            <Eyebrow>Average best</Eyebrow>
            <div>
              <div className="font-display text-4xl tabular-nums">
                {avgBest === null ? "–" : `${Math.round(avgBest * 100)}%`}
              </div>
              {avgBest !== null && <Meter value={avgBest} className="mt-3" />}
              <div className="mt-2 text-[13px] text-subtle">
                {attempted.length === 0
                  ? "Take a set to see your score"
                  : `Across ${attempted.length} attempted ${attempted.length === 1 ? "set" : "sets"}`}
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-3 border-t border-line sm:grid-cols-1 sm:border-l lg:border-t-0">
            <Stat label="Units" value={units.length} />
            <Stat label="Materials" value={documents.length} />
            <Stat label="Attempts" value={attemptCount} />
          </dl>
        </section>
      )}

      <section className="space-y-4">
        <SectionTitle
          count={units.length}
          action={
            documents.length > 1 && (
              <Link href="/generate" className={buttonClass("ghost", "min-h-8 px-2.5 py-1")}>
                <Layers className="size-4" /> Combine materials
              </Link>
            )
          }
        >
          Units
        </SectionTitle>
        <UnitGrid units={units} />
      </section>

      <section className="space-y-4">
        <SectionTitle count={quizzes.length}>Question sets</SectionTitle>
        <QuizList
          quizzes={quizzes}
          stats={stats}
          showDocument
          emptyText="Open one of your materials above and generate your first set."
        />
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col justify-center gap-0.5 border-line px-5 py-3.5 not-first:border-l sm:not-first:border-t sm:not-first:border-l-0">
      <dt className="text-[13px] text-subtle">{label}</dt>
      <dd className="font-mono text-lg font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** What to do next: revise the weakest set, start a fresh one, or make one. */
function UpNext({ quizzes, stats }: { quizzes: QuizRecord[]; stats: Record<string, { best: number; count: number }> }) {
  const ready = quizzes.filter((q) => q.status === "ready");
  const weakest = ready
    .filter((q) => stats[q.id] && stats[q.id].best < 0.8)
    .sort((a, b) => stats[a.id].best - stats[b.id].best)[0];
  const fresh = ready.find((q) => !stats[q.id]);
  const generating = quizzes.find((q) => q.status === "generating");

  const pick: { eyebrow: string; title: string; text: string; cta: string; href: string } = weakest
    ? {
        eyebrow: "Up next · revise",
        title: weakest.title,
        text: `Your best is ${Math.round(stats[weakest.id].best * 100)}%. Another go will close the gaps.`,
        cta: "Practise again",
        href: `/quizzes/${weakest.id}`,
      }
    : fresh
      ? {
          eyebrow: "Up next · new",
          title: fresh.title,
          text: `${fresh.questions.length} questions you haven't tried yet.`,
          cta: "Start set",
          href: `/quizzes/${fresh.id}`,
        }
      : generating
        ? {
            eyebrow: "In progress",
            title: generating.title,
            text: "Claude is writing this set now.",
            cta: "View progress",
            href: `/quizzes/${generating.id}`,
          }
        : {
            eyebrow: "Up next",
            title: "Every set is above 80%",
            text: "Build a new set to keep stretching, or combine several lectures into one exam.",
            cta: "New set",
            href: "/generate",
          };

  return (
    <Link
      href={pick.href}
      className="group flex flex-col justify-between gap-8 bg-foreground p-5 text-background sm:col-span-2 sm:p-6"
    >
      <div>
        <div className="font-mono text-xs opacity-60">{pick.eyebrow}</div>
        <div className="font-display mt-3 line-clamp-2 text-2xl leading-tight">{pick.title}</div>
        <p className="mt-1.5 text-sm opacity-70">{pick.text}</p>
      </div>
      <span className="inline-flex items-center gap-1.5 text-sm font-medium">
        {pick.cta}
        <ArrowRight className="size-4 transition-transform duration-300 ease-(--ease-out-expo) group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Add a unit and its lectures",
      text: "Create a unit for each course, then drop in its slides, notes or handouts as PDFs. They stay on your computer.",
    },
    {
      title: "Generate a set",
      text: "Pick the question types, difficulty and Claude model. Combine several lectures into one exam.",
    },
    {
      title: "Practise and get graded",
      text: "Take it as an exam or check answers as you go. Claude marks written answers with feedback.",
    },
  ];
  return (
    <section className="space-y-4">
      <SectionTitle>How it works</SectionTitle>
      <ol className="stagger grid gap-8 pt-2 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} style={{ "--i": i } as React.CSSProperties}>
            <div className="font-mono text-xs text-subtle">0{i + 1}</div>
            <div className="mt-3 text-[15px] font-semibold">{s.title}</div>
            <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
