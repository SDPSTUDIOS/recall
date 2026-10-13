import { ClaudeError, streamClaude } from "@/lib/claude";
import { deleteTutorChat, getQuiz, saveTutorChat } from "@/lib/repo";
import { tutorInput, tutorSystemPrompt } from "@/lib/tutor";
import type { Answer, TutorMessage } from "@/lib/types";

/** How much of the conversation Claude sees. The whole conversation is still saved. */
const PROMPT_MESSAGES = 40;
const PROMPT_CHARS = 8_000;
const MAX_SAVED_MESSAGES = 500;
const MAX_SAVED_CHARS = 50_000;

/**
 * Talks a student through one question. Replies stream back as newline-delimited
 * JSON: {"text": "..."} pieces, then {"done": true} or {"error": "..."}.
 * The conversation is saved once the reply ends, including a reply stopped partway.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/quizzes/[id]/tutor">) {
  const { id } = await ctx.params;
  const quiz = getQuiz(id);
  if (!quiz || quiz.status !== "ready") {
    return Response.json({ error: "Question set not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const question = quiz.questions.find((q) => q.id === body?.questionId);
  if (!question) return Response.json({ error: "Question not found." }, { status: 404 });

  const messages: TutorMessage[] = (Array.isArray(body?.messages) ? body.messages : [])
    .filter(
      (m: unknown): m is TutorMessage =>
        !!m &&
        typeof m === "object" &&
        ((m as TutorMessage).role === "user" || (m as TutorMessage).role === "assistant") &&
        typeof (m as TutorMessage).content === "string",
    )
    .slice(-MAX_SAVED_MESSAGES)
    .map((m: TutorMessage) => ({ role: m.role, content: m.content.slice(0, MAX_SAVED_CHARS) }));
  if (messages.at(-1)?.role !== "user") {
    return Response.json({ error: "Send a message to Claude." }, { status: 400 });
  }

  const revealed = body?.revealed === true;
  const answer: Answer | undefined = body?.answer && typeof body.answer === "object" ? body.answer : undefined;
  const feedback = typeof body?.feedback === "string" ? body.feedback.slice(0, 4_000) : undefined;

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
      try {
        await streamClaude({
          input: tutorInput({
            question,
            answer,
            revealed,
            feedback,
            messages: messages.slice(-PROMPT_MESSAGES).map((m) => ({ ...m, content: m.content.slice(0, PROMPT_CHARS) })),
          }),
          systemPrompt: tutorSystemPrompt(revealed),
          model: quiz.config.model,
          effort: "low",
          signal: request.signal,
          onText: (text) => {
            reply += text;
            send({ text });
          },
        });
        send({ done: true });
      } catch (err) {
        send({ error: err instanceof ClaudeError ? err.message : "Couldn't reach Claude. Try again." });
      } finally {
        // Without a reply, keep the question so it can be asked again after a reload.
        saveTutorChat(id, question.id, reply.trim() ? [...messages, { role: "assistant", content: reply }] : messages);
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

/** Clears the conversation about one question ("New chat"). */
export async function DELETE(request: Request, ctx: RouteContext<"/api/quizzes/[id]/tutor">) {
  const { id } = await ctx.params;
  const questionId = new URL(request.url).searchParams.get("questionId");
  if (!questionId) return Response.json({ error: "Missing questionId." }, { status: 400 });
  deleteTutorChat(id, questionId);
  return Response.json({ ok: true });
}
