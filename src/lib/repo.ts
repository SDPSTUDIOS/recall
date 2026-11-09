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
  UnitRecord,
  UnitSummary,
  VivaBrief,
  VivaConfig,
  VivaMessage,
  VivaRecord,
  VivaResult,
  VivaSource,
  VivaStatus,
} from "./types";

interface DocumentRow {
  id: string;
  unit_id: string;
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
  unitId: r.unit_id,
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

// ---------- units ----------

interface UnitRow {
  id: string;
  name: string;
  code: string | null;
  created_at: number;
}

const toUnit = (r: UnitRow): UnitRecord => ({ id: r.id, name: r.name, code: r.code, createdAt: r.created_at });

/** Units with their material, page and question set counts, most recently created first. */
export function listUnits(): UnitSummary[] {
  const rows = db
    .prepare(
      `SELECT u.*,
         (SELECT COUNT(*) FROM documents d WHERE d.unit_id = u.id) AS document_count,
         (SELECT COALESCE(SUM(page_count), 0) FROM documents d WHERE d.unit_id = u.id) AS page_count,
         (SELECT COUNT(DISTINCT qd.quiz_id) FROM quiz_documents qd JOIN documents d ON d.id = qd.document_id
            WHERE d.unit_id = u.id) AS quiz_count
       FROM units u ORDER BY u.created_at DESC`,
    )
    .all() as (UnitRow & { document_count: number; page_count: number; quiz_count: number })[];
  return rows.map((r) => ({
    ...toUnit(r),
    documentCount: r.document_count,
    pageCount: r.page_count,
    quizCount: r.quiz_count,
  }));
}

export function getUnit(id: string): UnitRecord | null {
  const row = db.prepare("SELECT * FROM units WHERE id = ?").get(id) as UnitRow | undefined;
  return row ? toUnit(row) : null;
}

export function insertUnit(unit: UnitRecord) {
  db.prepare("INSERT INTO units (id, name, code, created_at) VALUES (?, ?, ?, ?)").run(
    unit.id,
    unit.name,
    unit.code,
    unit.createdAt,
  );
}

export function updateUnit(id: string, fields: { name?: string; code?: string | null }): boolean {
  const unit = getUnit(id);
  if (!unit) return false;
  db.prepare("UPDATE units SET name = ?, code = ? WHERE id = ?").run(
    fields.name ?? unit.name,
    fields.code !== undefined ? fields.code : unit.code,
    id,
  );
  return true;
}

/**
 * Deletes a unit, its documents and the question sets made only from them.
 * Returns the stored file names so the caller can remove the PDFs from disk.
 */
export const deleteUnit = db.transaction((id: string): string[] => {
  const docs = db.prepare("SELECT id, file_name FROM documents WHERE unit_id = ?").all(id) as {
    id: string;
    file_name: string;
  }[];
  for (const d of docs) deleteDocument(d.id);
  db.prepare("DELETE FROM units WHERE id = ?").run(id);
  return docs.map((d) => d.file_name);
});

// ---------- documents ----------

const DOC_COLUMNS = "id, unit_id, name, file_name, size, page_count, char_count, created_at";

export function listDocuments(unitId?: string): (DocumentRecord & { quizCount: number })[] {
  const rows = db
    .prepare(
      `SELECT ${DOC_COLUMNS}, (SELECT COUNT(*) FROM quiz_documents qd WHERE qd.document_id = d.id) AS quiz_count
       FROM documents d ${unitId ? "WHERE unit_id = ?" : ""} ORDER BY created_at DESC`,
    )
    .all(...(unitId ? [unitId] : [])) as (DocumentRow & { quiz_count: number })[];
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
    `INSERT INTO documents (id, unit_id, name, file_name, size, page_count, char_count, pages_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    doc.id,
    doc.unitId,
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

export function moveDocument(id: string, unitId: string): boolean {
  return db.prepare("UPDATE documents SET unit_id = ? WHERE id = ?").run(unitId, id).changes > 0;
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

/** Question sets that use at least one document from the unit. */
export function listUnitQuizzes(unitId: string): QuizRecord[] {
  expireStaleGenerations();
  const rows = db
    .prepare(
      `SELECT * FROM quizzes WHERE id IN (
         SELECT qd.quiz_id FROM quiz_documents qd JOIN documents d ON d.id = qd.document_id WHERE d.unit_id = ?
       ) ORDER BY created_at DESC`,
    )
    .all(unitId) as QuizRow[];
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

// ---------- vivas ----------

interface VivaRow {
  id: string;
  source: VivaSource;
  repo_url: string;
  repo_name: string;
  branch: string | null;
  commit_sha: string | null;
  title: string;
  status: VivaStatus;
  error: string | null;
  config_json: string;
  brief_json: string | null;
  messages_json: string;
  topic_index: number;
  ended: number;
  result_json: string | null;
  model_used: string | null;
  duration_ms: number | null;
  created_at: number;
  started_at: number;
  completed_at: number | null;
}

const toViva = (r: VivaRow): VivaRecord => ({
  id: r.id,
  source: r.source,
  repoUrl: r.repo_url,
  repoName: r.repo_name,
  branch: r.branch,
  commit: r.commit_sha,
  title: r.title,
  status: r.status,
  error: r.error,
  config: JSON.parse(r.config_json),
  brief: r.brief_json ? JSON.parse(r.brief_json) : null,
  messages: JSON.parse(r.messages_json),
  topicIndex: r.topic_index,
  ended: r.ended === 1,
  result: r.result_json ? JSON.parse(r.result_json) : null,
  modelUsed: r.model_used,
  durationMs: r.duration_ms,
  createdAt: r.created_at,
  startedAt: r.started_at,
  completedAt: r.completed_at,
});

/** Preparation times out after 15 minutes, so anything older was cut off (e.g. by a server restart). */
function expireStaleVivas() {
  db.prepare(
    `UPDATE vivas SET status = 'error', error = 'Preparation was interrupted (the server may have restarted). Retry to prepare again.'
     WHERE status = 'preparing' AND started_at < ?`,
  ).run(Date.now() - STALE_AFTER_MS);
}

export function listVivas(): VivaRecord[] {
  expireStaleVivas();
  return (db.prepare("SELECT * FROM vivas ORDER BY created_at DESC").all() as VivaRow[]).map(toViva);
}

export function getViva(id: string): VivaRecord | null {
  expireStaleVivas();
  const row = db.prepare("SELECT * FROM vivas WHERE id = ?").get(id) as VivaRow | undefined;
  return row ? toViva(row) : null;
}

export function insertViva(v: {
  id: string;
  source: VivaSource;
  repoUrl: string;
  repoName: string;
  branch: string | null;
  title: string;
  config: VivaConfig;
  createdAt: number;
}) {
  db.prepare(
    `INSERT INTO vivas (id, source, repo_url, repo_name, branch, title, status, config_json, created_at, started_at)
     VALUES (?, ?, ?, ?, ?, ?, 'preparing', ?, ?, ?)`,
  ).run(v.id, v.source, v.repoUrl, v.repoName, v.branch, v.title, JSON.stringify(v.config), v.createdAt, v.createdAt);
}

export function markVivaPreparing(id: string) {
  db.prepare("UPDATE vivas SET status = 'preparing', error = NULL, started_at = ? WHERE id = ?").run(Date.now(), id);
}

export function completeVivaPrep(
  id: string,
  p: { brief: VivaBrief; branch: string | null; commit: string | null; modelUsed: string | null; durationMs: number },
) {
  db.prepare(
    `UPDATE vivas SET status = 'ready', error = NULL, brief_json = ?, branch = ?, commit_sha = ?, model_used = ?,
       duration_ms = ?, messages_json = '[]', topic_index = 0, ended = 0, result_json = NULL, completed_at = NULL
     WHERE id = ?`,
  ).run(JSON.stringify(p.brief), p.branch, p.commit, p.modelUsed, p.durationMs, id);
}

export function failViva(id: string, error: string) {
  db.prepare("UPDATE vivas SET status = 'error', error = ? WHERE id = ?").run(error, id);
}

export function saveVivaTranscript(id: string, messages: VivaMessage[], topicIndex: number, ended: boolean) {
  db.prepare("UPDATE vivas SET messages_json = ?, topic_index = ?, ended = ? WHERE id = ?").run(
    JSON.stringify(messages),
    topicIndex,
    ended ? 1 : 0,
    id,
  );
}

export function saveVivaResult(id: string, result: VivaResult) {
  db.prepare("UPDATE vivas SET result_json = ?, ended = 1, completed_at = ? WHERE id = ?").run(
    JSON.stringify(result),
    Date.now(),
    id,
  );
}

/** Clears the conversation and assessment so the viva can be taken again with the same plan. */
export function resetViva(id: string) {
  db.prepare(
    `UPDATE vivas SET messages_json = '[]', topic_index = 0, ended = 0, result_json = NULL, completed_at = NULL
     WHERE id = ?`,
  ).run(id);
}

export function renameViva(id: string, title: string): boolean {
  return db.prepare("UPDATE vivas SET title = ? WHERE id = ?").run(title, id).changes > 0;
}

export function deleteViva(id: string) {
  db.prepare("DELETE FROM vivas WHERE id = ?").run(id);
}
