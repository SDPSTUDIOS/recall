import { CheckCircle2, ChevronRight, CircleDashed, FileCode2, GraduationCap, TrendingUp } from "lucide-react";
import type { VivaBrief, VivaMessage, VivaResult } from "@/lib/types";
import { Reply } from "../Reply";
import { Badge, Card, Meter, cx, scoreTone } from "../ui";
import { RetakeButton } from "./RetakeButton";

const verdict = (score: number) =>
  score >= 70 ? "Strong understanding" : score >= 50 ? "Satisfactory understanding" : "Needs more work";

/** Score, overall feedback, per-topic marks and the transcript, once the viva has been assessed. */
export function VivaResults({
  vivaId,
  brief,
  result,
  messages,
}: {
  vivaId: string;
  brief: VivaBrief;
  result: VivaResult;
  messages: VivaMessage[];
}) {
  const reached = result.topics.filter((t) => t.reached).length;
  const byId = new Map(brief.topics.map((t, i) => [t.id, { ...t, n: i + 1 }]));

  return (
    <div className="space-y-6">
      <Card className="animate-fade-up grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:gap-12">
        <div>
          <div className="font-mono text-xs text-subtle">Viva result</div>
          <div className="font-display mt-2 text-7xl leading-none tabular-nums tracking-[-0.05em] sm:text-8xl">
            {result.score}
            <span className="text-4xl text-subtle sm:text-5xl">%</span>
          </div>
          <Meter value={result.score / 100} className="mt-5 w-full md:w-48" />
        </div>
        <div className="min-w-0 space-y-3 md:pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-display text-2xl leading-tight">{verdict(result.score)}</h2>
            <Badge>
              {reached} of {result.topics.length} topics covered
            </Badge>
          </div>
          <p className="text-[15px] leading-relaxed text-muted">{result.summary}</p>
          <div className="pt-1">
            <RetakeButton vivaId={vivaId} />
          </div>
        </div>
      </Card>

      {(result.strengths.length > 0 || result.improvements.length > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <PointList
            icon={<CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />}
            title="What went well"
            points={result.strengths}
          />
          <PointList
            icon={<TrendingUp className="size-4 text-amber-600 dark:text-amber-400" />}
            title="What to work on"
            points={result.improvements}
          />
        </div>
      )}

      <section className="space-y-3">
        <h2 className="border-b border-line pt-2 pb-3 text-sm font-semibold">Topics</h2>
        {result.topics.map((t) => {
          const topic = byId.get(t.topicId);
          if (!topic) return null;
          return (
            <Card key={t.topicId} className={cx("space-y-3 p-5 sm:p-6", !t.reached && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-subtle">Topic {String(topic.n).padStart(2, "0")}</div>
                  <h3 className="mt-1 text-[17px] font-semibold tracking-tight">{topic.title}</h3>
                </div>
                {t.reached ? (
                  <Badge tone={scoreTone(t.score / 10)} className="shrink-0">
                    {t.score} / 10
                  </Badge>
                ) : (
                  <Badge className="shrink-0">
                    <CircleDashed className="size-3" /> Not reached
                  </Badge>
                )}
              </div>
              <p className="border-l-2 border-foreground pl-3 text-[15px] leading-snug text-muted">“{topic.question}”</p>
              <p className="text-sm leading-relaxed">{t.feedback}</p>
              {t.reached && topic.lookFor.length > 0 && (
                <details className="group text-sm">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium select-none [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
                    What a strong answer covers
                  </summary>
                  <ul className="mt-2 ml-5 list-disc space-y-1 text-muted">
                    {topic.lookFor.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  {topic.excerpt && (
                    <pre className="mt-3 max-h-80 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-100">
                      {topic.excerpt}
                    </pre>
                  )}
                </details>
              )}
              {topic.files.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <FileCode2 className="size-3.5 text-subtle" aria-hidden />
                  {topic.files.map((f) => (
                    <code key={f} className="rounded border border-line px-1.5 py-0.5 font-mono text-xs">
                      {f}
                    </code>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </section>

      <Transcript messages={messages} />
    </div>
  );
}

function PointList({ icon, title, points }: { icon: React.ReactNode; title: string; points: string[] }) {
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        {icon} {title}
      </h2>
      {points.length ? (
        <ul className="mt-2 ml-5 list-disc space-y-1.5 text-sm text-muted">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">Nothing noted.</p>
      )}
    </Card>
  );
}

export function Transcript({ messages }: { messages: VivaMessage[] }) {
  return (
    <details className="surface group overflow-hidden rounded-xl">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-sunken [&::-webkit-details-marker]:hidden">
        <span className="grid size-8 place-items-center rounded-md border border-line text-subtle">
          <GraduationCap className="size-4" />
        </span>
        <span className="text-sm font-medium">Transcript</span>
        <span className="font-mono text-xs text-subtle">{messages.length} messages</span>
        <ChevronRight className="ml-auto size-4 text-subtle transition-transform duration-300 group-open:rotate-90" />
      </summary>
      <div className="space-y-5 border-t border-line px-5 py-5">
        {messages.map((m, i) => (
          <div key={i} className="text-sm leading-relaxed">
            <div className="mb-1 font-mono text-xs text-subtle">{m.role === "user" ? "You" : "Examiner"}</div>
            {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <Reply text={m.content} />}
          </div>
        ))}
      </div>
    </details>
  );
}
