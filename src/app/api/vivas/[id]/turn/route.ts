import { ClaudeError, streamClaude } from "@/lib/claude";
import { getViva, resetViva, saveVivaTranscript } from "@/lib/repo";
import type { VivaMessage } from "@/lib/types";
import { MarkerFilter, VIVA_SYSTEM_PROMPT, vivaTurnInput } from "@/lib/viva";

const MAX_ANSWER_CHARS = 20_000;
const MAX_MESSAGES = 400;

declare global {
  var __examHelperVivaTurns: Set<string> | undefined;
}
/** One examiner reply at a time per viva, so two tabs can't interleave the transcript. */
const busy = (globalThis.__examHelperVivaTurns ??= new Set<string>());

/**
 * The examiner's next message. Send {"message": "..."} with the student's answer,
 * or no message to start the viva or to retry a reply that failed. The transcript
 * is kept on the server; the reply streams back as newline-delimited JSON:
 * {"text"} pieces, {"topic": n} when a new topic opens, {"ended": true} when the
 * examiner closes the viva, then {"done": true} or {"error"}.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/vivas/[id]/turn">) {
  const { id } = await ctx.params;
  const viva = getViva(id);
  if (!viva || viva.status !== "ready" || !viva.brief) {
    return Response.json({ error: "Viva not found." }, { status: 404 });
  }
  if (viva.ended || viva.result) {
    return Response.json({ error: "This viva is over. Start it again to retake it." }, { status: 409 });
  }
  if (viva.messages.length >= MAX_MESSAGES) {
    return Response.json({ error: "This viva has gone on too long. End it to get your feedback." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.message === "string" ? body.message.trim().slice(0, MAX_ANSWER_CHARS) : "";
  const last = viva.messages.at(-1);

  let messages: VivaMessage[];
  if (text) {
    // An answer whose reply failed is replaced, not stacked.
    const base = last?.role === "user" ? viva.messages.slice(0, -1) : viva.messages;
    messages = [...base, { role: "user", content: text, topic: viva.topicIndex }];
  } else if (viva.messages.length === 0 || last?.role === "user") {
    messages = viva.messages;
  } else {
    return Response.json({ error: "Type your answer first." }, { status: 400 });
  }

  if (busy.has(id)) {
    return Response.json({ error: "The examiner is already replying in another tab." }, { status: 409 });
  }
  busy.add(id);
  // Keep the answer even if the reply fails, so it's still there after a reload.
  if (text) saveVivaTranscript(id, messages, viva.topicIndex, false);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: object) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          /* the browser went away */
        }
      };

      let reply = "";
      let topicIndex = viva.topicIndex;
      let ended = false;
      const filter = new MarkerFilter((e) => {
        if ("end" in e) {
          ended = true;
          send({ ended: true });
        } else if (e.topic > topicIndex && e.topic <= viva.brief!.topics.length) {
          topicIndex = e.topic;
          send({ topic: topicIndex });
        }
      });
      const emit = (piece: string) => {
        // The marker's line break would otherwise start the message.
        if (!reply) piece = piece.replace(/^\s+/, "");
        if (!piece) return;
        reply += piece;
        send({ text: piece });
      };

      try {
        await streamClaude({
          input: vivaTurnInput({ ...viva, brief: viva.brief!, messages, topicIndex }),
          systemPrompt: VIVA_SYSTEM_PROMPT,
          model: viva.config.model,
          effort: "low",
          signal: request.signal,
          onText: (t) => emit(filter.push(t)),
        });
        emit(filter.flush());
        send({ done: true });
      } catch (err) {
        emit(filter.flush());
        send({ error: err instanceof ClaudeError ? err.message : "Couldn't reach Claude. Try again." });
      } finally {
        reply = reply.trim();
        if (reply) {
          // The opening message always starts topic 1, marker or not.
          if (topicIndex === 0) topicIndex = 1;
          saveVivaTranscript(id, [...messages, { role: "assistant", content: reply, topic: topicIndex }], topicIndex, ended);
        }
        busy.delete(id);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Clears the conversation and feedback to take the viva again with the same questions. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/vivas/[id]/turn">) {
  const { id } = await ctx.params;
  if (busy.has(id)) return Response.json({ error: "Wait for the examiner to finish replying." }, { status: 409 });
  resetViva(id);
  return Response.json({ ok: true });
}
