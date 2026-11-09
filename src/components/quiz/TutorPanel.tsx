"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Lightbulb, MessageCircleQuestion, RotateCcw, SquarePen, Square, X } from "lucide-react";
import type { Answer, Question, TutorMessage } from "@/lib/types";
import { useConfirm } from "../Dialog";
import { ThoughtCloud } from "../Logo";
import { cx } from "../ui";
import { Reply } from "../Reply";
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
      className="animate-slide-in fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-line bg-background shadow-2xl sm:w-[26rem] lg:w-(--tutor-w) lg:shadow-none"
    >
      <ResizeHandle />
      {confirmDialog}
      <header className="flex min-h-14 items-start gap-3 border-b border-line px-4 py-3">
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-foreground text-background">
          <MessageCircleQuestion className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">
            Ask Claude <span className="font-mono text-xs font-medium text-subtle">· Q{target.number}</span>
          </h2>
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted">
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
            className="grid size-8 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-zinc-100 hover:text-foreground disabled:opacity-40 pointer-coarse:size-10 dark:hover:bg-zinc-900"
          >
            <SquarePen className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
          className="grid size-8 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-zinc-100 hover:text-foreground pointer-coarse:size-10 dark:hover:bg-zinc-900"
        >
          <X className="size-4" />
        </button>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-5" aria-live="polite" aria-busy={busy}>
        <div className="mx-auto w-full max-w-2xl space-y-5">
          {messages.length === 0 ? (
            <div className="space-y-4 pt-2">
              <p className="font-display text-xl leading-snug">Stuck or unsure?</p>
              <p className="-mt-2 text-sm text-muted">
                Ask anything about this question
                {target.question.artifact ? ", including the code, equations, chart or table that comes with it" : ""}.
              </p>
              <div className="flex flex-col items-start gap-2">
                {starters.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-1.5 text-left text-sm text-muted transition-colors duration-150 hover:border-foreground hover:text-foreground pointer-coarse:py-2.5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="animate-fade-up ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-100 px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap dark:bg-zinc-900">
                  {m.content}
                </div>
              ) : (
                <div
                  key={i}
                  className={cx(
                    "text-sm leading-relaxed",
                    m.stopped && "text-subtle italic",
                    m.error && !m.stopped && "rounded-md border border-red-600/25 px-3.5 py-2.5 text-red-700 dark:border-red-400/25 dark:text-red-400",
                  )}
                >
                  {m.content ? (
                    <Reply text={m.content} />
                  ) : (
                    <span className="inline-flex items-center gap-2.5 text-muted">
                      <TypingDots />
                      <span className="text-shimmer">Claude is thinking…</span>
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
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium underline-offset-4 transition-colors hover:underline"
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
        className="border-t border-line p-3"
      >
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex items-end gap-2 rounded-xl border border-line-strong bg-surface p-1.5 transition-[border-color,box-shadow] duration-150 focus-within:border-foreground focus-within:ring-3 focus-within:ring-foreground/10">
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
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-85"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim()}
                aria-label="Send"
                title="Send (Enter)"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-foreground text-background transition-[opacity,transform] hover:opacity-85 active:scale-95 disabled:opacity-25"
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
          "absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 transition-colors group-hover:bg-line-strong group-focus-visible:bg-foreground",
          dragging && "bg-foreground",
        )}
      />
    </div>
  );
}

/** The Recall thought cloud, its bubbles rising in turn, while a reply is on its way. */
export function TypingDots() {
  return <ThoughtCloud thinking className="size-5 shrink-0 text-foreground" />;
}
