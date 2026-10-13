import Link from "next/link";
import { Suspense } from "react";
import { io } from "next/cache";
import { FileText, Layers, ListChecks, Sparkles, Target, Upload } from "lucide-react";
import { QuizList } from "@/components/QuizList";
import { SetupBanner } from "@/components/SetupBanner";
import { UpdateBanner } from "@/components/UpdateBanner";
import { UploadDropzone } from "@/components/UploadDropzone";
import { Badge, Card, PageLoading, SectionTitle, buttonClass } from "@/components/ui";
import { formatRelative, isLowText } from "@/lib/format";
import { attemptStats, listDocuments, listQuizzes } from "@/lib/repo";

export default function Home() {
  return (
    <div className="space-y-10">
      <SetupBanner />
      <UpdateBanner />
      <section className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Turn lectures into{" "}
            <span className="text-brand-600 dark:text-brand-400">practice exams</span>
          </h1>
          <p className="mt-2 max-w-2xl leading-relaxed text-zinc-600 dark:text-zinc-400">
            Upload your lecture PDFs and Claude writes multiple choice, fill in the blank, long
            answer and code questions from them, then grades your answers.
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

  if (documents.length === 0 && quizzes.length === 0) return <HowItWorks />;

  const attempted = Object.values(stats);
  const attemptCount = attempted.reduce((n, s) => n + s.count, 0);
  const avgBest = attempted.length
    ? Math.round((attempted.reduce((n, s) => n + s.best, 0) / attempted.length) * 100)
    : null;

  return (
    <>
      {quizzes.length > 0 && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<FileText className="size-4" />} tone="red" label="Materials" value={documents.length} />
          <Stat icon={<ListChecks className="size-4" />} tone="brand" label="Question sets" value={quizzes.length} />
          <Stat icon={<Sparkles className="size-4" />} tone="amber" label="Attempts" value={attemptCount} />
          <Stat
            icon={<Target className="size-4" />}
            tone="green"
            label="Average best score"
            value={avgBest === null ? "–" : `${avgBest}%`}
          />
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle
          action={
            documents.length > 1 && (
              <Link href="/generate" className={buttonClass("secondary", "py-1.5")}>
                <Layers className="size-4" /> Combine materials
              </Link>
            )
          }
        >
          Lecture materials
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((d) => (
            <Link key={d.id} href={`/documents/${d.id}`} className="group rounded-xl">
              <Card className="flex h-full gap-3 p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-brand-300 group-hover:shadow-md group-hover:shadow-brand-600/5 dark:group-hover:border-brand-800">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium" title={d.name}>
                    {d.name}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">
                    {d.pageCount} pages ·{" "}
                    {d.quizCount === 0 ? "no sets yet" : `${d.quizCount} ${d.quizCount === 1 ? "set" : "sets"}`}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-xs text-subtle">{formatRelative(d.createdAt)}</span>
                    {isLowText(d) && <Badge tone="amber">Scanned</Badge>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Question sets</SectionTitle>
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

const STAT_TONES = {
  red: "bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400",
  brand: "bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400",
  green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400",
};

function Stat({
  icon,
  tone,
  label,
  value,
}: {
  icon: React.ReactNode;
  tone: keyof typeof STAT_TONES;
  label: string;
  value: string | number;
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${STAT_TONES[tone]}`} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-bold leading-tight tabular-nums tracking-tight">{value}</div>
        <div className="truncate text-xs text-muted">{label}</div>
      </div>
    </Card>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: <Upload className="size-5" />,
      title: "Upload lectures",
      text: "Drop in slides, notes or handouts as PDFs. They stay on your computer.",
    },
    {
      icon: <Sparkles className="size-5" />,
      title: "Generate a set",
      text: "Pick the question types, difficulty and Claude model. Combine several lectures into one exam.",
    },
    {
      icon: <Target className="size-5" />,
      title: "Practise and get graded",
      text: "Take it as an exam or check answers as you go. Claude marks written answers with feedback.",
    },
  ];
  return (
    <section className="space-y-3">
      <SectionTitle>How it works</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Card key={s.title} className="relative overflow-hidden p-5">
            <span
              aria-hidden
              className="absolute -right-2 -top-4 text-7xl font-bold tabular-nums text-zinc-100 dark:text-zinc-800/60"
            >
              {i + 1}
            </span>
            <div className="relative flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
                {s.icon}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-subtle">Step {i + 1}</span>
            </div>
            <div className="relative mt-3 font-semibold">{s.title}</div>
            <p className="relative mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
