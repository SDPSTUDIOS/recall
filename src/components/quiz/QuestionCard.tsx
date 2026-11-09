"use client";

import { Check, CheckCircle2, CircleDashed, Flag, Lightbulb, MessageCircleQuestion, Sparkles, X, XCircle } from "lucide-react";
import {
  BLANK_TOKEN,
  TYPE_LABEL,
  isWritten,
  type Answer,
  type Artifact,
  type Question,
  type QuestionResult,
} from "@/lib/types";
import { Badge, Card, cx, inputClass } from "../ui";
import { Chart } from "./Chart";
import { RichText, Tex, hasMath } from "./RichText";

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
export const LETTERS = "ABCDEFGHIJ";

export function StatusBadge({ result }: { result: QuestionResult }) {
  const map = {
    correct: { tone: "green", icon: <CheckCircle2 className="size-3" />, text: "Correct" },
    partial: { tone: "amber", icon: <CircleDashed className="size-3" />, text: "Partly correct" },
    incorrect: { tone: "red", icon: <XCircle className="size-3" />, text: "Incorrect" },
    unanswered: { tone: "zinc", icon: <CircleDashed className="size-3" />, text: "Not answered" },
    ungraded: { tone: "amber", icon: <CircleDashed className="size-3" />, text: "Not graded" },
  } as const;
  const s = map[result.status];
  return (
    <Badge tone={s.tone}>
      {s.icon} {s.text} · {fmt(result.score)}/{fmt(result.maxScore)}
    </Badge>
  );
}

export function QuestionCard({
  number,
  total,
  question: q,
  answer,
  onChange,
  disabled,
  result,
  reveal,
  flagged,
  onToggleFlag,
  showType = false,
  footer,
  onAskClaude,
  askingClaude,
  hasChat,
}: {
  number: number;
  total?: number;
  question: Question;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
  disabled: boolean;
  result?: QuestionResult;
  reveal: boolean;
  flagged?: boolean;
  onToggleFlag?: () => void;
  /** Show the question type (when questions aren't grouped under type headings). */
  showType?: boolean;
  footer?: React.ReactNode;
  /** Opens the Ask Claude panel for this question. */
  onAskClaude?: () => void;
  /** The Ask Claude panel is open on this question. */
  askingClaude?: boolean;
  /** There's a saved conversation about this question. */
  hasChat?: boolean;
}) {
  return (
    <Card
      id={`q-${q.id}`}
      className={cx(
        "relative scroll-mt-36 p-5 transition-colors duration-300 sm:p-7 lg:scroll-mt-24",
        result?.status === "correct" && "border-emerald-600/40 dark:border-emerald-400/30",
        (result?.status === "incorrect" || result?.status === "unanswered") && reveal && "border-red-600/35 dark:border-red-400/30",
        result?.status === "partial" && "border-amber-600/40 dark:border-amber-400/30",
      )}
    >
      <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-subtle">
        <span className="font-mono tabular-nums">
          <span className="font-medium text-foreground">{String(number).padStart(2, "0")}</span>
          {total ? <span>/{String(total).padStart(2, "0")}</span> : null}
          <span className="sr-only">
            Question {number}
            {total ? ` of ${total}` : ""}
          </span>
        </span>
        <span aria-hidden className="h-3 w-px bg-line-strong" />
        <span>
          {q.marks} {q.marks === 1 ? "mark" : "marks"}
        </span>
        {showType && <span>{TYPE_LABEL[q.type]}</span>}
        <span className="capitalize">{q.difficulty}</span>
        {q.topic && <Badge className="max-w-56 truncate">{q.topic}</Badge>}
        <span className="flex-1" />
        {result && <StatusBadge result={result} />}
        {onAskClaude && (
          <button
            type="button"
            onClick={onAskClaude}
            aria-pressed={askingClaude}
            title={hasChat ? "Continue your conversation with Claude" : "Talk this question through with Claude"}
            className={cx(
"inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors pointer-coarse:min-h-10",
              askingClaude
                ? "border-foreground bg-foreground text-background"
                : "border-line-strong text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-900",
            )}
          >
            <MessageCircleQuestion className="size-3.5" aria-hidden />
            Ask Claude
            {hasChat && (
              <>
                <span className={cx("size-1.5 rounded-full", askingClaude ? "bg-background" : "bg-foreground")} aria-hidden />
                <span className="sr-only">(conversation saved)</span>
              </>
            )}
          </button>
        )}
        {onToggleFlag && !result && (
          <button
            type="button"
            onClick={onToggleFlag}
            aria-pressed={flagged}
            title="Mark for review (M)"
            className={cx(
"inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors pointer-coarse:min-h-10",
              flagged
                ? "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:border-amber-400/30 dark:text-amber-300"
                : "border-line text-subtle hover:border-line-strong hover:text-foreground",
            )}
          >
            <Flag className={cx("size-3", flagged && "fill-current")} />
            {flagged ? "Marked" : "Mark for review"}
          </button>
        )}
      </div>

      {q.type === "fill_blank" ? (
        <FillBlank q={q} answer={answer} onChange={onChange} disabled={disabled} result={result} reveal={reveal} />
      ) : (
        <p className="whitespace-pre-wrap text-[17px] font-medium leading-relaxed tracking-[-0.011em] sm:text-lg">
          <RichText text={q.question} />
        </p>
      )}

      {q.artifact && <ArtifactBlock artifact={q.artifact} />}

      {(q.type === "mcq" || q.type === "single") && (
        <Choices q={q} answer={answer} onChange={onChange} disabled={disabled} reveal={reveal} />
      )}

      {isWritten(q.type) && (
        <div className="mt-5">
          <textarea
            className={cx(inputClass, "min-h-48 resize-y p-4 text-[15px] leading-relaxed disabled:opacity-80")}
            placeholder={
              q.artifact?.kind === "math" || q.artifact?.kind === "chart"
                ? "Write your answer and show your working. Type maths as you would on a calculator, e.g. x^2 + 3x = 0 or sqrt(2)/2…"
                : (q.artifact?.kind ?? "code") === "code" && q.type === "artifact"
                  ? "Write your answer. You can refer to line numbers…"
                  : "Write your answer…"
            }
            aria-label={`Answer to question ${number}`}
            value={answer?.kind === "text" ? answer.text : ""}
            onChange={(e) => onChange({ kind: "text", text: e.target.value })}
            disabled={disabled}
          />
          {answer?.kind === "text" && hasMath(answer.text) && (
            <div className="mt-2 rounded-lg border border-dashed border-line-strong px-4 py-3 text-[15px] leading-relaxed">
              <div className="mb-1 font-mono text-xs text-subtle">Preview</div>
              <p className="whitespace-pre-wrap">
                <RichText text={answer.text} />
              </p>
            </div>
          )}
          {!disabled && (
            <div className="mt-1.5 text-right font-mono text-[11px] tabular-nums text-subtle">
              {wordCount(answer?.kind === "text" ? answer.text : "")} words
            </div>
          )}
        </div>
      )}

      {reveal && <Review q={q} result={result} />}

      {footer && <div className="mt-6">{footer}</div>}
    </Card>
  );
}

const wordCount = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function Choices({
  q,
  answer,
  onChange,
  disabled,
  reveal,
}: {
  q: Question;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
  disabled: boolean;
  reveal: boolean;
}) {
  const selected = answer?.kind === "choice" ? answer.selected : [];
  const multi = q.type === "mcq";

  return (
    <div className="mt-5 space-y-2" role={multi ? "group" : "radiogroup"}>
      {multi && (
        <p className="pb-1 text-[13px] text-subtle">Select all that apply</p>
      )}
      {q.options.map((opt, i) => {
        const isSelected = selected.includes(i);
        const isCorrect = q.correctOptions.includes(i);
        return (
          <label
            key={i}
            className={cx(
              "group/opt flex cursor-pointer items-start gap-3.5 rounded-lg border px-3.5 py-3 text-[15px] transition-[background-color,border-color,transform,opacity] duration-150 ease-(--ease-out-quart) has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-foreground has-[input:enabled]:active:scale-[0.995]",
              !reveal && isSelected && "border-foreground bg-sunken",
              !reveal && !isSelected && "border-line hover:border-line-strong hover:bg-sunken",
              // A correct option the student didn't pick gets a dashed outline, so it reads as missed.
              reveal && isCorrect && isSelected && "border-emerald-600/60 bg-emerald-500/[0.06] dark:border-emerald-400/50",
              reveal && isCorrect && !isSelected && "border-dashed border-emerald-600/60 dark:border-emerald-400/50",
              reveal && !isCorrect && isSelected && "border-red-600/50 bg-red-500/[0.05] dark:border-red-400/45",
              reveal && !isCorrect && !isSelected && "border-line opacity-55",
              disabled && "cursor-default",
            )}
          >
            <input
              type={multi ? "checkbox" : "radio"}
              name={q.id}
              className="sr-only"
              checked={isSelected}
              disabled={disabled}
              onChange={() =>
                onChange({
                  kind: "choice",
                  selected: multi
                    ? isSelected
                      ? selected.filter((s) => s !== i)
                      : [...selected, i].sort((a, b) => a - b)
                    : [i],
                })
              }
            />
            <span
              aria-hidden
              className={cx(
                "grid size-6 shrink-0 place-items-center border font-mono text-xs font-medium transition-[background-color,color,border-color] duration-150",
                multi ? "rounded-md" : "rounded-full",
                isSelected
                  ? "border-foreground bg-foreground text-background"
                  : "border-line-strong text-subtle group-hover/opt:border-zinc-400 group-hover/opt:text-foreground dark:group-hover/opt:border-zinc-600",
                reveal && isCorrect && isSelected && "border-emerald-600! bg-emerald-600! text-white!",
                reveal && isCorrect && !isSelected && "border-emerald-600! bg-transparent! text-emerald-700! dark:border-emerald-400! dark:text-emerald-400!",
                reveal && !isCorrect && isSelected && "border-red-600! bg-red-600! text-white!",
              )}
            >
              {LETTERS[i]}
            </span>
            <span className="flex-1 whitespace-pre-wrap pt-px leading-relaxed">
              <RichText text={opt} />
            </span>
            {reveal && isCorrect && !isSelected && (
              <span className="mt-0.5 shrink-0 rounded-full border border-dashed border-emerald-600/50 px-2 py-px text-xs font-medium text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-400">
                Missed
              </span>
            )}
            {reveal && isCorrect && <Check className="mt-1 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />}
            {reveal && !isCorrect && isSelected && <X className="mt-1 size-4 shrink-0 text-red-600 dark:text-red-400" strokeWidth={3} />}
          </label>
        );
      })}
    </div>
  );
}

function FillBlank({
  q,
  answer,
  onChange,
  disabled,
  result,
  reveal,
}: {
  q: Question;
  answer: Answer | undefined;
  onChange: (a: Answer) => void;
  disabled: boolean;
  result?: QuestionResult;
  reveal: boolean;
}) {
  const parts = q.question.split(BLANK_TOKEN);
  const values = answer?.kind === "blanks" ? answer.values : [];

  return (
    <p className="text-[17px] font-medium leading-[2.1] sm:text-lg">
      {parts.map((part, i) => (
        <span key={i}>
          <span className="whitespace-pre-wrap">
            <RichText text={part} />
          </span>
          {i < parts.length - 1 && (
            <span className="inline-flex flex-col align-baseline">
              <input
                aria-label={`Blank ${i + 1}`}
                className={cx(
                  "mx-1 w-40 rounded-t-sm border-b-2 bg-sunken px-2 py-0.5 font-mono text-sm font-normal outline-none transition-[background-color,border-color] duration-150 focus:border-foreground",
                  !reveal && "border-line-strong",
                  reveal && result?.blankCorrect?.[i] && "border-emerald-500 bg-emerald-500/10",
                  reveal && result?.blankCorrect && !result.blankCorrect[i] && "border-red-500 bg-red-500/10",
                )}
                value={values[i] ?? ""}
                disabled={disabled}
                onChange={(e) => {
                  const next = q.blanks.map((_, j) => values[j] ?? "");
                  next[i] = e.target.value;
                  onChange({ kind: "blanks", values: next });
                }}
              />
              {reveal && !result?.blankCorrect?.[i] && (
                <span className="mx-1 font-mono text-xs font-normal leading-normal text-emerald-700 dark:text-emerald-400">
                  {q.blanks[i]?.answers.join(" / ")}
                </span>
              )}
            </span>
          )}
        </span>
      ))}
    </p>
  );
}

function ArtifactBlock({ artifact }: { artifact: Artifact }) {
  const kind = artifact.kind ?? "code";
  if (kind === "code") return <CodeBlock artifact={artifact} />;

  const caption = artifact.title || { math: "Equations", chart: "Graph", table: "Data", text: "Case" }[kind];
  return (
    <figure className="mt-5 overflow-hidden rounded-lg border border-line-strong">
      <figcaption className="border-b border-line bg-sunken px-4 py-2 font-mono text-xs text-muted">
        <RichText text={caption} />
      </figcaption>
      {kind === "math" && (
        <div className="space-y-1 px-5 py-4 text-[17px]">
          {artifact.content.split("\n").map((line, i) => (
            <Tex key={i} tex={line} display />
          ))}
        </div>
      )}
      {kind === "chart" && artifact.chart && (
        <div className="p-3">
          <Chart chart={artifact.chart} title={artifact.title} />
        </div>
      )}
      {kind === "table" && artifact.table && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-sunken">
              <tr>
                {artifact.table.columns.map((c, i) => (
                  <th key={i} className="px-4 py-2.5 text-left font-semibold">
                    <RichText text={c} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {artifact.table.rows.map((row, i) => (
                <tr key={i} className="border-t border-line transition-colors hover:bg-sunken">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-2.5 align-top tabular-nums">
                      <RichText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {kind === "text" && (
        <p className="whitespace-pre-wrap border-l-2 border-foreground px-5 py-4 text-[15px] leading-relaxed">
          <RichText text={artifact.content} />
        </p>
      )}
    </figure>
  );
}

function CodeBlock({ artifact }: { artifact: Artifact }) {
  const lines = artifact.content.split("\n");
  return (
    <figure className="mt-5 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100">
      <figcaption className="flex min-h-10 items-center gap-3 border-b border-zinc-800 px-4 py-2 font-mono text-xs text-zinc-400">
        {artifact.title && <span className="truncate text-zinc-300">{artifact.title}</span>}
        {artifact.language && (
          <span className="ml-auto text-[11px] lowercase text-zinc-500">
            {artifact.language}
          </span>
        )}
      </figcaption>
      <pre className="overflow-x-auto py-4 font-mono text-[13px] leading-[1.7]">
        <code className="table min-w-full">
          {lines.map((line, i) => (
            <span key={i} className="table-row">
              <span className="table-cell select-none pl-4 pr-5 text-right tabular-nums text-zinc-500">{i + 1}</span>
              <span className="table-cell whitespace-pre pr-4">{line || " "}</span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}

function Review({ q, result }: { q: Question; result?: QuestionResult }) {
  return (
    <div className="animate-fade-up mt-6 space-y-4 border-t border-line pt-5 text-sm">
      {result?.feedback && (
        <div>
          <div className="mb-1.5 flex items-center gap-2 font-semibold"><Sparkles className="size-4" aria-hidden /> Claude&apos;s feedback</div>
          <p className="whitespace-pre-wrap text-muted">
            <RichText text={result.feedback} />
          </p>
        </div>
      )}
      {isWritten(q.type) && (result?.coveredPoints?.length || result?.missedPoints?.length) ? (
        <ul className="space-y-1">
          {result.coveredPoints?.map((p, i) => (
            <li key={`c${i}`} className="flex gap-2 text-emerald-700 dark:text-emerald-400">
              <Check className="mt-0.5 size-4 shrink-0" /> <span><RichText text={p} /></span>
            </li>
          ))}
          {result.missedPoints?.map((p, i) => (
            <li key={`m${i}`} className="flex gap-2 text-red-700 dark:text-red-400">
              <X className="mt-0.5 size-4 shrink-0" /> <span><RichText text={p} /></span>
            </li>
          ))}
        </ul>
      ) : null}
      {isWritten(q.type) && (
        <details open={!result}>
          <summary className="cursor-pointer font-semibold">Model answer and marking points</summary>
          <p className="mt-2 whitespace-pre-wrap text-muted">
            <RichText text={q.modelAnswer} />
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {q.keyPoints.map((p, i) => (
              <li key={i}>
                <RichText text={p} />
              </li>
            ))}
          </ul>
        </details>
      )}
      {q.explanation && (
        <div>
          <div className="mb-1.5 flex items-center gap-2 font-semibold"><Lightbulb className="size-4" aria-hidden /> Explanation</div>
          <p className="whitespace-pre-wrap text-muted">
            <RichText text={q.explanation} />
          </p>
        </div>
      )}
      {q.source && <div className="border-t border-line pt-3 font-mono text-[11px] text-subtle">Source · {q.source}</div>}
    </div>
  );
}
