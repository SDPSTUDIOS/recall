"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Flag, GraduationCap, MessageSquareText, RotateCcw, Square } from "lucide-react";
import type { VivaMessage } from "@/lib/types";
import { useConfirm } from "../Dialog";
import { ThoughtCloud } from "../Logo";
import { Reply } from "../Reply";
import { TypingDots } from "../quiz/TutorPanel";
import { Button, Card, ErrorText, cx } from "../ui";

interface Message extends VivaMessage {
  /** Failed or stopped before any reply, so it offers a retry. Not saved. */
  error?: boolean;
  stopped?: boolean;
}

/**
 * The viva itself: Claude asks, the student answers, one turn at a time. The
 * transcript lives on the server, so a reload carries on where it left off.
 */
export function VivaRoom({
  vivaId,
  repoName,
  topicCount,
  initialMessages,
  initialTopic,
  initialEnded,
}: {
  vivaId: string;
  repoName: string;
  topicCount: number;
  initialMessages: VivaMessage[];
  initialTopic: number;
  initialEnded: boolean;
}) {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [topic, setTopic] = useState(initialTopic);
  const [ended, setEnded] = useState(initialEnded);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const started = messages.length > 0;
  const answered = messages.some((m) => m.role === "user");
  const last = messages.at(-1);
  // A saved answer with no reply after it: the reply failed or the page was reloaded mid-reply.
  const awaitingReply = !busy && last?.role === "user";
  const lastFailed = !busy && (last?.error || awaitingReply);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Stop a reply still streaming when the page goes away.
  useEffect(() => () => controller.current?.abort(), []);

  useEffect(() => {
    if (started && !busy && !ended) inputRef.current?.focus({ preventScroll: true });
  }, [started, busy, ended]);

  /** Sends an answer, or nothing to start the viva or retry the last reply. */
  async function turn(answer?: string) {
    const content = answer?.trim() ?? "";
    if (busy || ended) return;
    const base = messages.filter((m) => !m.error);
    const history: Message[] = content
      ? [...(base.at(-1)?.role === "user" ? base.slice(0, -1) : base), { role: "user", content, topic }]
      : base;
    setMessages([...history, { role: "assistant", content: "", topic }]);
    setDraft("");
    setBusy(true);

    const ctrl = new AbortController();
    controller.current = ctrl;
    const setReply = (fn: (m: Message) => Message) =>
      setMessages((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

    let closed = false;
    try {
      const res = await fetch(`/api/vivas/${vivaId}/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify(content ? { message: content } : {}),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error ?? "Couldn't reach Claude. Check Recall is still running.");
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as { text?: string; topic?: number; ended?: boolean; error?: string };
          if (msg.topic) {
            const n = msg.topic;
            setTopic(n);
            setReply((m) => ({ ...m, topic: n }));
          }
          if (msg.ended) closed = true;
          if (msg.text) setReply((m) => ({ ...m, content: m.content + msg.text }));
          if (msg.error) throw new Error(msg.error);
        }
      }
      // The opening message starts topic 1 even if the examiner forgot to say so.
      setTopic((t) => (t === 0 ? 1 : t));
    } catch (err) {
      if (ctrl.signal.aborted) {
        setReply((m) => (m.content ? m : { ...m, content: "Stopped before the examiner replied.", error: true, stopped: true }));
      } else {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setReply((m) => (m.content ? { ...m, content: `${m.content}\n\n${message}` } : { ...m, content: message, error: true }));
      }
    } finally {
      controller.current = null;
      setBusy(false);
    }

    if (closed) {
      setEnded(true);
      finish();
    }
  }

  async function finish() {
    setAssessing(true);
    setAssessError(null);
    try {
      const res = await fetch(`/api/vivas/${vivaId}/finish`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Couldn't assess the viva. Try again.");
      router.refresh();
    } catch (err) {
      setAssessError(err instanceof Error ? err.message : String(err));
      setAssessing(false);
    }
  }

  async function endEarly() {
    const remaining = topicCount - Math.max(topic, 1);
    const ok = await confirm({
      title: "End the viva now?",
      body:
        remaining > 0
          ? `You've reached topic ${Math.max(topic, 1)} of ${topicCount}. The ${remaining} topic${remaining === 1 ? "" : "s"} you haven't reached won't count towards your score.`
          : "Claude will assess your answers so far.",
      confirmLabel: "End and get feedback",
    });
    if (!ok) return;
    setEnded(true);
    finish();
  }

  if (assessing) {
    return (
      <Card className="flex flex-col items-center gap-6 px-6 py-20 text-center">
        <ThoughtCloud thinking className="size-14 text-foreground" />
        <div aria-live="polite">
          <div className="font-display text-xl">Claude is assessing your viva</div>
          <p className="mt-1 text-sm text-muted">Marking each topic against the code. This takes up to a minute or two.</p>
        </div>
      </Card>
    );
  }

  if (!started) {
    return (
      <Card className="animate-fade-up space-y-8 p-6 sm:p-10">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-foreground text-background">
            <GraduationCap className="size-5" />
          </span>
          <div>
            <h2 className="font-display text-3xl leading-tight">Your viva is ready</h2>
            <p className="mt-1 text-sm text-muted">
              Claude has read {repoName} and planned {topicCount} topics to ask you about.
            </p>
          </div>
        </div>
        <ul className="grid gap-6 text-sm text-muted sm:grid-cols-3">
          <li className="flex flex-col gap-3 border-t border-foreground pt-4 leading-relaxed">
            <span className="font-mono text-xs text-subtle">01</span>
            The examiner asks one question at a time, with follow-ups depending on your answer.
          </li>
          <li className="flex flex-col gap-3 border-t border-foreground pt-4 leading-relaxed">
            <span className="font-mono text-xs text-subtle">02</span>
            Answer in your own words, as you would out loud. Explain how your code works and why you built it that way.
          </li>
          <li className="flex flex-col gap-3 border-t border-foreground pt-4 leading-relaxed">
            <span className="font-mono text-xs text-subtle">03</span>
            The examiner won&apos;t tell you if you&apos;re right. Once the viva ends you get a score and feedback for each topic.
          </li>
        </ul>
        <Button onClick={() => turn()} className="px-5">
          <MessageSquareText className="size-4" /> Begin viva
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex h-[calc(100dvh-14rem)] min-h-[30rem] flex-col overflow-hidden">
      {confirmDialog}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-muted">
            {ended ? "Viva finished" : `Topic ${Math.max(topic, 1)} of ${topicCount}`}
          </div>
          <div
            className="mt-2 flex max-w-sm gap-1"
            role="progressbar"
            aria-label="Viva progress"
            aria-valuemin={0}
            aria-valuemax={topicCount}
            aria-valuenow={ended ? topicCount : Math.max(topic - 1, 0)}
          >
            {Array.from({ length: topicCount }, (_, i) => (
              <span
                key={i}
                className={cx(
                  "h-1 flex-1 rounded-full transition-colors duration-500",
                  ended || i + 1 < topic
                    ? "bg-foreground"
                    : i + 1 === topic
                      ? "animate-pulse bg-zinc-400 dark:bg-zinc-600"
                      : "bg-zinc-200 dark:bg-zinc-800",
                )}
              />
            ))}
          </div>
        </div>
        {!ended && (
          <Button variant="secondary" className="py-1.5" onClick={endEarly} disabled={busy || !answered}>
            <Flag className="size-4" /> End viva
          </Button>
        )}
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6" aria-live="polite" aria-busy={busy}>
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {messages.map((m, i) =>
            m.role === "user" ? (
              <div
                key={i}
                className="animate-fade-up ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-100 px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap dark:bg-zinc-900"
              >
                {m.content}
              </div>
            ) : (
              <div key={i} className="animate-fade-up flex gap-3">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border border-line text-foreground">
                  <GraduationCap className="size-3.5" aria-hidden />
                </span>
                <div
                  className={cx(
                    "min-w-0 flex-1 text-sm leading-relaxed",
                    m.stopped && "text-subtle italic",
                    m.error &&
                      !m.stopped &&
                      "rounded-md border border-red-600/25 px-3.5 py-2.5 text-red-700 dark:border-red-400/25 dark:text-red-400",
                  )}
                >
                  <span className="sr-only">Examiner: </span>
                  {m.content ? (
                    <Reply text={m.content} />
                  ) : (
                    <span className="inline-flex items-center gap-2.5 pt-1.5 text-muted">
                      <TypingDots />
                      <span className="text-shimmer">The examiner is writing…</span>
                    </span>
                  )}
                </div>
              </div>
            ),
          )}
          {lastFailed && !ended && (
            <button
              type="button"
              onClick={() => turn()}
              className="ml-11 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium underline-offset-4 transition-colors hover:underline"
            >
              <RotateCcw className="size-3.5" aria-hidden /> {awaitingReply ? "Get the examiner's reply" : "Try again"}
            </button>
          )}
        </div>
      </div>

      {ended ? (
        <div className="space-y-3 border-t border-line p-4 text-center">
          {assessError && <ErrorText>{assessError}</ErrorText>}
          <Button onClick={finish}>
            <Flag className="size-4" /> Get my feedback
          </Button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            turn(draft);
          }}
          className="border-t border-line p-3"
        >
          <div className="mx-auto w-full max-w-3xl">
            <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-foreground focus-within:ring-3 focus-within:ring-foreground/10">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    turn(draft);
                  }
                }}
                rows={1}
                placeholder="Your answer…"
                aria-label="Your answer"
                className="field-sizing-content max-h-48 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => controller.current?.abort()}
                  aria-label="Stop"
                  title="Stop"
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-85"
                >
                  <Square className="size-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!draft.trim()}
                  aria-label="Send answer"
                  title="Send (Enter)"
                  className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground text-background transition-[opacity,transform] hover:opacity-85 active:scale-95 disabled:opacity-25"
                >
                  <ArrowUp className="size-4" />
                </button>
              )}
            </div>
            <p className="mt-1.5 px-1 text-xs text-subtle">
              Enter to send, Shift+Enter for a new line. Your progress is saved, so you can come back later.
            </p>
          </div>
        </form>
      )}
    </Card>
  );
}
