import "server-only";
import { db } from "./db";
import type {
  AttemptRecord,
  DocumentRecord,
  GenerationConfig,
  Question,
  QuizRecord,
  QuizStatus,
  TutorChats,
  TutorMessage,
} from "./types";

interface DocumentRow {
  id: string;
  name: string;
  file_name: string;
  size: number;
  page_count: number;
  char_count: number;
  created_at: number;
}

interface QuizRow {
  id: string;
  title: string;
  status: QuizStatus;
  error: string | null;
  model: string;
  model_used: string | null;
  config_json: string;
  questions_json: string;
  duration_ms: number | null;
  created_at: number;
  started_at: number;
}

interface AttemptRow {
  id: string;
  quiz_id: string;
  answers_json: string;
  results_json: string;
  score: number;
  max_score: number;
  created_at: number;
}

const toDocument = (r: DocumentRow): DocumentRecord => ({
  id: r.id,
  name: r.name,
  fileName: r.file_name,
  size: r.size,
  pageCount: r.page_count,
  charCount: r.char_count,
  createdAt: r.created_at,
});

const toQuiz = (r: QuizRow, documents: QuizRecord["documents"]): QuizRecord => ({
  id: r.id,
  documents,
  title: r.title,
  status: r.status,
  error: r.error,
  model: r.model,
  modelUsed: r.model_used,
  config: JSON.parse(r.config_json),
  questions: JSON.parse(r.questions_json),
  durationMs: r.duration_ms,
  createdAt: r.created_at,
  startedAt: r.started_at,
});

const toAttempt = (r: AttemptRow): AttemptRecord => ({
  id: r.id,
  quizId: r.quiz_id,
  answers: JSON.parse(r.answers_json),
  results: JSON.parse(r.results_json),
  score: r.score,
  maxScore: r.max_score,
  createdAt: r.created_at,
});

// ---------- documents ----------

const DOC_COLUMNS = "id, name, file_name, size, page_count, char_count, created_at";

export function listDocuments(): (DocumentRecord & { quizCount: number })[] {
  const rows = db
    .prepare(
      `SELECT ${DOC_COLUMNS}, (SELECT COUNT(*) FROM quiz_documents qd WHERE qd.document_id = d.id) AS quiz_count
       FROM documents d ORDER BY created_at DESC`,
    )
    .all() as (DocumentRow & { quiz_count: number })[];
  return rows.map((r) => ({ ...toDocument(r), quizCount: r.quiz_count }));
}

export function getDocument(id: string): DocumentRecord | null {
  const row = db
    .prepare(`SELECT ${DOC_COLUMNS} FROM documents WHERE id = ?`)
    .get(id) as DocumentRow | undefined;
  return row ? toDocument(row) : null;
}

export function getDocuments(ids: string[]): DocumentRecord[] {
  const byId = new Map(
    (
      db
        .prepare(`SELECT ${DOC_COLUMNS} FROM documents WHERE id IN (SELECT value FROM json_each(?))`)
        .all(JSON.stringify(ids)) as DocumentRow[]
    ).map((r) => [r.id, toDocument(r)]),
  );
  return ids.flatMap((id) => byId.get(id) ?? []);
}

export function getDocumentPages(id: string): string[] {
  const row = db.prepare("SELECT pages_json FROM documents WHERE id = ?").get(id) as
    | { pages_json: string }
    | undefined;
  return row ? JSON.parse(row.pages_json) : [];
}

export function insertDocument(doc: DocumentRecord, pages: string[]) {
  db.prepare(
    `INSERT INTO documents (id, name, file_name, size, page_count, char_count, pages_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    doc.id,
    doc.name,
    doc.fileName,
    doc.size,
    doc.pageCount,
    doc.charCount,
    JSON.stringify(pages),
    doc.createdAt,
  );
}

/** Deletes a document and the question sets made only from it; sets that also use other documents are kept. */
export const deleteDocument = db.transaction((id: string) => {
  db.prepare(
    `DELETE FROM quizzes WHERE id IN (SELECT quiz_id FROM quiz_documents WHERE document_id = ?)
       AND NOT EXISTS (SELECT 1 FROM quiz_documents o WHERE o.quiz_id = quizzes.id AND o.document_id != ?)`,
  ).run(id, id);
  db.prepare("DELETE FROM documents WHERE id = ?").run(id);
});

export function renameDocument(id: string, name: string): boolean {
  return db.prepare("UPDATE documents SET name = ? WHERE id = ?").run(name, id).changes > 0;
}

// ---------- quizzes ----------

function withDocuments(rows: QuizRow[]): QuizRecord[] {
  if (rows.length === 0) return [];
  const links = db
    .prepare(
      `SELECT qd.quiz_id, d.id, d.name FROM quiz_documents qd JOIN documents d ON d.id = qd.document_id
       WHERE qd.quiz_id IN (SELECT value FROM json_each(?)) ORDER BY qd.position`,
    )
    .all(JSON.stringify(rows.map((r) => r.id))) as { quiz_id: string; id: string; name: string }[];
  const byQuiz = new Map<string, QuizRecord["documents"]>();
  for (const l of links) {
    if (!byQuiz.has(l.quiz_id)) byQuiz.set(l.quiz_id, []);
    byQuiz.get(l.quiz_id)!.push({ id: l.id, name: l.name });
  }
  return rows.map((r) => toQuiz(r, byQuiz.get(r.id) ?? []));
}

/** Generation times out after 15 minutes, so anything older was cut off (e.g. by a server restart). */
const STALE_AFTER_MS = 20 * 60 * 1000;

function expireStaleGenerations() {
  db.prepare(
    `UPDATE quizzes SET status = 'error', error = 'Generation was interrupted (the server may have restarted). Retry to generate again.'
     WHERE status = 'generating' AND started_at < ?`,
  ).run(Date.now() - STALE_AFTER_MS);
}

export function listQuizzes(documentId?: string): QuizRecord[] {
  expireStaleGenerations();
  const rows = (
    documentId
      ? db
          .prepare(
            `SELECT * FROM quizzes WHERE id IN (SELECT quiz_id FROM quiz_documents WHERE document_id = ?)
             ORDER BY created_at DESC`,
          )
          .all(documentId)
      : db.prepare("SELECT * FROM quizzes ORDER BY created_at DESC LIMIT 20").all()
  ) as QuizRow[];
  return withDocuments(rows);
}

export function getQuiz(id: string): QuizRecord | null {
  expireStaleGenerations();
  const row = db.prepare("SELECT * FROM quizzes WHERE id = ?").get(id) as QuizRow | undefined;
  return row ? withDocuments([row])[0] : null;
}

export const insertQuiz = db.transaction(
  (q: { id: string; documentIds: string[]; title: string; config: GenerationConfig; createdAt: number }) => {
    db.prepare(
      `INSERT INTO quizzes (id, title, status, model, config_json, created_at, started_at)
       VALUES (?, ?, 'generating', ?, ?, ?, ?)`,
    ).run(q.id, q.title, q.config.model, JSON.stringify(q.config), q.createdAt, q.createdAt);
    const link = db.prepare(
      "INSERT INTO quiz_documents (quiz_id, document_id, position) VALUES (?, ?, ?)",
    );
    q.documentIds.forEach((docId, i) => link.run(q.id, docId, i));
  },
);

export function markQuizGenerating(id: string) {
  db.prepare(
    "UPDATE quizzes SET status = 'generating', error = NULL, started_at = ? WHERE id = ?",
  ).run(Date.now(), id);
}

export function completeQuiz(
  id: string,
  questions: Question[],
  modelUsed: string | null,
  durationMs: number,
) {
  db.prepare(
    `UPDATE quizzes SET status = 'ready', error = NULL, questions_json = ?, model_used = ?, duration_ms = ?
     WHERE id = ?`,
  ).run(JSON.stringify(questions), modelUsed, durationMs, id);
}

export function failQuiz(id: string, error: string) {
  db.prepare("UPDATE quizzes SET status = 'error', error = ? WHERE id = ?").run(error, id);
}

export function deleteQuiz(id: string) {
  db.prepare("DELETE FROM quizzes WHERE id = ?").run(id);
}

export function renameQuiz(id: string, title: string): boolean {
  return db.prepare("UPDATE quizzes SET title = ? WHERE id = ?").run(title, id).changes > 0;
}

// ---------- attempts ----------

export function listAttempts(quizId: string): AttemptRecord[] {
  const rows = db
    .prepare("SELECT * FROM attempts WHERE quiz_id = ? ORDER BY created_at DESC")
    .all(quizId) as AttemptRow[];
  return rows.map(toAttempt);
}

/** Best score per quiz as a 0–1 fraction, plus the number of attempts. */
export function attemptStats(): Record<string, { best: number; count: number }> {
  const rows = db
    .prepare(
      `SELECT quiz_id, MAX(score / NULLIF(max_score, 0)) AS best, COUNT(*) AS n FROM attempts GROUP BY quiz_id`,
    )
    .all() as { quiz_id: string; best: number | null; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.quiz_id, { best: r.best ?? 0, count: r.n }]));
}

export function getAttempt(id: string): AttemptRecord | null {
  const row = db.prepare("SELECT * FROM attempts WHERE id = ?").get(id) as AttemptRow | undefined;
  return row ? toAttempt(row) : null;
}

export function insertAttempt(a: AttemptRecord) {
  db.prepare(
    `INSERT INTO attempts (id, quiz_id, answers_json, results_json, score, max_score, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    a.id,
    a.quizId,
    JSON.stringify(a.answers),
    JSON.stringify(a.results),
    a.score,
    a.maxScore,
    a.createdAt,
  );
}

// ---------- Ask Claude conversations ----------

export function listTutorChats(quizId: string): TutorChats {
  const rows = db
    .prepare("SELECT question_id, messages_json FROM tutor_chats WHERE quiz_id = ?")
    .all(quizId) as { question_id: string; messages_json: string }[];
  return Object.fromEntries(rows.map((r) => [r.question_id, JSON.parse(r.messages_json)]));
}

export function saveTutorChat(quizId: string, questionId: string, messages: TutorMessage[]) {
  db.prepare(
    `INSERT INTO tutor_chats (quiz_id, question_id, messages_json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (quiz_id, question_id) DO UPDATE SET messages_json = excluded.messages_json, updated_at = excluded.updated_at`,
  ).run(quizId, questionId, JSON.stringify(messages), Date.now());
}

export function deleteTutorChat(quizId: string, questionId: string) {
  db.prepare("DELETE FROM tutor_chats WHERE quiz_id = ? AND question_id = ?").run(quizId, questionId);
}
