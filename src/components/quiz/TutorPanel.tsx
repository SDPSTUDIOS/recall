"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Lightbulb, MessageCircleQuestion, RotateCcw, SquarePen, Square, X } from "lucide-react";
import type { Answer, Question, TutorMessage } from "@/lib/types";
import { useConfirm } from "../Dialog";
import { Spinner, cx } from "../ui";
import { RichText } from "./RichText";

export interface Message extends TutorMessage {
  /** Failed or stopped, so it's left out of what's sent next and offers a retry. Not saved. */
  error?: boolean;
  stopped?: boolean;
}

/** Conversations by question id: the saved ones plus anything said since the page opened. */
export type ChatState = Record<string, Message[]>;

export interface TutorTarget {
  question: Question;
  number: number;
  answer?: Answer;
  /** The answer has been shown (practice check or submitted), so Claude may discuss it fully. */
  revealed: boolean;
  /** Examiner feedback on a graded answer. */
  feedback?: string;
}

const NO_MESSAGES: Message[] = [];

const WIDTH_KEY = "exam-helper:tutor-width";
const MIN_WIDTH = 320;
/** Space kept for the app sidebar (240px) and the quiz beside the panel. */
const maxWidth = () => Math.max(MIN_WIDTH, window.innerWidth - 240 - 400);
const clampWidth = (w: number) => Math.round(Math.min(maxWidth(), Math.max(MIN_WIDTH, w)));

/** The panel's width on split-screen layouts, shared with the page through --tutor-w. */
function setWidth(px: number | null) {
  const root = document.documentElement.style;
  if (px === null) root.removeProperty("--tutor-w");
  else root.setProperty("--tutor-w", `${clampWidth(px)}px`);
}

const HINT_STARTERS = [
  "Explain what this question is asking",
  "How do I approach this?",
  "Explain the key concept behind it",
  "Am I heading in the right direction?",
];
const FULL_STARTERS = [
  "Walk me through the answer",
  "Why is this the correct answer?",
  "Where did my answer go wrong?",
  "Give me a similar question to try",
];

/**
 * Side panel for talking a question through with Claude. Conversations are kept
 * per question for as long as the page is open, and stream in as Claude writes.
 */
export function TutorPanel({
  quizId,
  target,
  chats,
  setChats,
  onClose,
}: {
  quizId: string;
  chats: ChatState;
  setChats: React.Dispatch<React.SetStateAction<ChatState>>;
  target: TutorTarget | null;
  onClose: () => void;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const [streaming, setStreaming] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState("");
  const controllers = useRef(new Map<string, AbortController>());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const open = target !== null;
  const qid = target?.question.id ?? "";
  const messages = chats[qid] ?? NO_MESSAGES;
  const busy = !!streaming[qid];

  // Remember what opened the panel so focus can go back there, and leave room for it on wide screens.
  useEffect(() => {
    if (!open) return;
    returnFocus.current = document.activeElement as HTMLElement | null;
    document.documentElement.dataset.tutor = "open";
    try {
      const saved = Number(localStorage.getItem(WIDTH_KEY));
      if (saved) setWidth(saved);
    } catch {
      /* ignore */
    }
    return () => {
      delete document.documentElement.dataset.tutor;
      returnFocus.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus({ preventScroll: true });
  }, [open, qid]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Stop any replies still streaming when the page goes away.
  useEffect(() => {
    const map = controllers.current;
    return () => map.forEach((c) => c.abort());
  }, []);

  if (!target) return null;

  const update = (id: string, fn: (m: Message[]) => Message[]) =>
    setChats((prev) => ({ ...prev, [id]: fn(prev[id] ?? []) }));

  /** Sends a message after `base`, the conversation so far (the retry button passes it minus the failed turn). */
  async function send(text: string, base: Message[] = messages) {
    const content = text.trim();
    if (!content || !target || busy) return;
    const id = target.question.id;
    const history = [...base.filter((m) => !m.error), { role: "user" as const, content }];
    update(id, () => [...history, { role: "assistant", content: "" }]);
    setDraft("");
    setStreaming((s) => ({ ...s, [id]: true }));

    const controller = new AbortController();
    controllers.current.set(id, controller);
    const setReply = (fn: (m: Message) => Message) =>
      update(id, (m) => [...m.slice(0, -1), fn(m[m.length - 1] ?? { role: "assistant", content: "" })]);

    try {
      const res = await fetch(`/api/quizzes/${quizId}/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          questionId: id,
          messages: history.map(({ role, content }) => ({ role, content })),
          answer: target.answer,
          revealed: target.revealed,
          feedback: target.feedback,
        }),
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
          const msg = JSON.parse(line) as { text?: string; error?: string };
          if (msg.text) setReply((m) => ({ ...m, content: m.content + msg.text }));
          if (msg.error) throw new Error(msg.error);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        setReply((m) => (m.content ? m : { ...m, content: "Stopped before Claude replied.", error: true, stopped: true }));
      } else {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        setReply((m) => ({ role: "assistant", content: m.content ? `${m.content}\n\n${message}` : message, error: true }));
      }
    } finally {
      controllers.current.delete(id);
      setStreaming((s) => ({ ...s, [id]: false }));
    }
  }

  async function newChat() {
    if (!target || busy) return;
    const id = target.question.id;
    const ok = await confirm({
      title: "Start a new chat?",
      body: `Your conversation about question ${target.number} will be deleted.`,
      confirmLabel: "Delete and start over",
      variant: "danger",
    });
    if (!ok) return;
    const res = await fetch(`/api/quizzes/${quizId}/tutor?questionId=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(
      () => null,
    );
    if (!res?.ok) {
      update(id, (m) => [...m, { role: "assistant", content: "Couldn't delete this conversation. Try again.", error: true }]);
      return;
    }
    setChats((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    inputRef.current?.focus();
  }

  const starters = target.revealed ? FULL_STARTERS : HINT_STARTERS;
  const lastFailed = messages.at(-1)?.error;
  const lastQuestion = [...messages].reverse().find((m) => m.role === "user")?.content;

  return (
    <aside
      data-tutor-panel
      aria-label={`Ask Claude about question ${target.number}`}
      onKeyDown={(e) => {
        // A confirm dialog inside the panel handles its own Escape.
        if (e.key === "Escape" && !(e.target as HTMLElement).closest("dialog")) {
          e.stopPropagation();
          onClose();
        }
      }}
      className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-zinc-200 bg-white shadow-2xl sm:w-[26rem] lg:w-(--tutor-w) lg:shadow-none dark:border-zinc-800 dark:bg-zinc-950"
    >
      <ResizeHandle />
      {confirmDialog}
      <header className="flex items-start gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-300">
          <MessageCircleQuestion className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Ask Claude · Question {target.number}</h2>
          <p className="line-clamp-2 text-xs text-muted">
            <RichText text={target.question.question.replaceAll("[[BLANK]]", "____")} />
          </p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={newChat}
            disabled={busy}
            aria-label="New chat"
            title="New chat"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 pointer-coarse:size-10 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <SquarePen className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-zinc-100 hover:text-zinc-900 pointer-coarse:size-10 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <X className="size-4" />
        </button>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite" aria-busy={busy}>
        <div className="mx-auto w-full max-w-2xl space-y-4">
          {messages.length === 0 ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted">
                Stuck or unsure? Ask anything about this question
                {target.question.artifact ? ", including the code, equations, chart or table that comes with it" : ""}.
              </p>
              <div className="flex flex-col items-start gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-zinc-200 px-3 py-1.5 text-left text-sm transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800 pointer-coarse:py-2 dark:border-zinc-800 dark:hover:border-brand-800 dark:hover:bg-brand-950/60 dark:hover:text-brand-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2 text-sm break-words whitespace-pre-wrap text-white">
                  {m.content}
                </div>
              ) : (
                <div
                  key={i}
                  className={cx(
                    "text-sm leading-relaxed",
                    m.stopped && "text-subtle italic",
                    m.error && !m.stopped && "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
                  )}
                >
                  {m.content ? (
                    <Reply text={m.content} />
                  ) : (
                    <span className="inline-flex items-center gap-2 text-muted">
                      <Spinner className="size-3.5" /> Claude is thinking…
                    </span>
                  )}
                </div>
              ),
            )
          )}
          {lastFailed && lastQuestion && !busy && (
            <button
              type="button"
              onClick={() => send(lastQuestion, messages.slice(0, -2))}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              <RotateCcw className="size-3.5" aria-hidden /> Try again
            </button>
          )}
        </div>
      </div>

      {!target.revealed && (
        <p className="mx-auto flex w-full max-w-2xl justify-center gap-1.5 px-5 pb-2 text-center text-xs text-subtle">
          <Lightbulb className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>Hints only while you answer. Claude walks through the full answer once you check it or submit.</span>
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex items-end gap-2 rounded-xl border border-zinc-300 bg-white p-1.5 transition focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-900">
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={1}
              placeholder="Ask about this question…"
              aria-label="Message Claude"
              className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 outline-none field-sizing-content"
            />
            {busy ? (
              <button
                type="button"
                onClick={() => controllers.current.get(qid)?.abort()}
                aria-label="Stop"
                title="Stop"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-900 text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send"
                title="Send (Enter)"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
              >
                <ArrowUp className="size-4" />
              </button>
            )}
          </div>
          <p className="mt-1.5 px-1 text-xs text-subtle">Enter to send, Shift+Enter for a new line. Uses your Claude plan.</p>
        </div>
      </form>
    </aside>
  );
}

/** Drag (or use the arrow keys) to share the screen between the quiz and the panel. Split screen only. */
function ResizeHandle() {
  const [dragging, setDragging] = useState(false);
  const current = () => document.querySelector<HTMLElement>("[data-tutor-panel]")?.offsetWidth ?? MIN_WIDTH;
  const save = () => {
    try {
      localStorage.setItem(WIDTH_KEY, String(current()));
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the Ask Claude panel"
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        document.documentElement.dataset.tutorResizing = "";
        setDragging(true);
      }}
      onPointerMove={(e) => {
        if (dragging) setWidth(window.innerWidth - e.clientX);
      }}
      onPointerUp={() => {
        if (!dragging) return;
        delete document.documentElement.dataset.tutorResizing;
        setDragging(false);
        save();
      }}
      onDoubleClick={() => {
        setWidth(null);
        try {
          localStorage.removeItem(WIDTH_KEY);
        } catch {
          /* ignore */
        }
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 64 : 16;
        if (e.key === "ArrowLeft") setWidth(current() + step);
        else if (e.key === "ArrowRight") setWidth(current() - step);
        else return;
        e.preventDefault();
        save();
      }}
      className="group absolute inset-y-0 -left-1.5 z-10 hidden w-3 cursor-col-resize touch-none outline-none lg:block"
    >
      <span
        className={cx(
          "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-brand-400 group-focus-visible:bg-brand-500",
          dragging && "bg-brand-500",
        )}
      />
    </div>
  );
}

/** Claude's reply: paragraphs with maths rendered, and ``` fenced code as blocks. */
function Reply({ text }: { text: string }) {
  const parts = text.split(/```[^\n]*\n?/);
  return (
    <div className="space-y-2">
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre key={i} className="overflow-x-auto rounded-lg bg-zinc-900 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-100">
            {part.replace(/\n$/, "")}
          </pre>
        ) : part.trim() ? (
          <p key={i} className="whitespace-pre-wrap">
            <RichText text={part.trim()} />
          </p>
        ) : null,
      )}
    </div>
  );
}
