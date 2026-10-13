import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { shuffleOptions } from "./shuffle";
import type { Answers, Question } from "./types";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
export const WORK_DIR = path.join(DATA_DIR, "claude-workdir");

declare global {
  var __examHelperDb: Database.Database | undefined;
}

function open() {
  for (const dir of [DATA_DIR, UPLOAD_DIR, WORK_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(path.join(DATA_DIR, "exam-helper.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      file_name   TEXT NOT NULL,
      size        INTEGER NOT NULL,
      page_count  INTEGER NOT NULL,
      char_count  INTEGER NOT NULL,
      pages_json  TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id             TEXT PRIMARY KEY,
      document_id    TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      title          TEXT NOT NULL,
      status         TEXT NOT NULL,
      error          TEXT,
      model          TEXT NOT NULL,
      model_used     TEXT,
      config_json    TEXT NOT NULL,
      questions_json TEXT NOT NULL DEFAULT '[]',
      duration_ms    INTEGER,
      created_at     INTEGER NOT NULL,
      started_at     INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id           TEXT PRIMARY KEY,
      quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      answers_json TEXT NOT NULL,
      results_json TEXT NOT NULL,
      score        REAL NOT NULL,
      max_score    REAL NOT NULL,
      created_at   INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON attempts(quiz_id);
  `);
  return db;
}

/**
 * Schema migrations, applied in order and tracked with PRAGMA user_version.
 * The CREATE statements above are the original (version 0) schema.
 */
const MIGRATIONS: ((db: Database.Database) => void)[] = [
  // 1: a question set can draw from several documents.
  (db) => {
    db.exec(`
      CREATE TABLE quiz_documents (
        quiz_id     TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        position    INTEGER NOT NULL,
        PRIMARY KEY (quiz_id, document_id)
      );
      INSERT INTO quiz_documents (quiz_id, document_id, position)
        SELECT id, document_id, 0 FROM quizzes;

      CREATE TABLE quizzes_new (
        id             TEXT PRIMARY KEY,
        title          TEXT NOT NULL,
        status         TEXT NOT NULL,
        error          TEXT,
        model          TEXT NOT NULL,
        model_used     TEXT,
        config_json    TEXT NOT NULL,
        questions_json TEXT NOT NULL DEFAULT '[]',
        duration_ms    INTEGER,
        created_at     INTEGER NOT NULL,
        started_at     INTEGER NOT NULL
      );
      INSERT INTO quizzes_new
        SELECT id, title, status, error, model, model_used, config_json, questions_json,
               duration_ms, created_at, started_at
        FROM quizzes;
      DROP INDEX IF EXISTS idx_quizzes_document;
      DROP TABLE quizzes;
      ALTER TABLE quizzes_new RENAME TO quizzes;

      CREATE INDEX idx_quiz_documents_document ON quiz_documents(document_id);
    `);
  },
  // 2: shuffle choice options in existing sets (models list correct answers first),
  // remapping saved answers so past attempts still show what was picked.
  (db) => {
    const quizzes = db.prepare("SELECT id, questions_json FROM quizzes").all() as {
      id: string;
      questions_json: string;
    }[];
    const attemptsOf = db.prepare("SELECT id, answers_json FROM attempts WHERE quiz_id = ?");
    const saveQuiz = db.prepare("UPDATE quizzes SET questions_json = ? WHERE id = ?");
    const saveAttempt = db.prepare("UPDATE attempts SET answers_json = ? WHERE id = ?");

    for (const quiz of quizzes) {
      const remap = new Map<string, number[]>();
      const questions = (JSON.parse(quiz.questions_json) as Question[]).map((q) => {
        const { question, newIndex } = shuffleOptions(q);
        remap.set(q.id, newIndex);
        return question;
      });
      saveQuiz.run(JSON.stringify(questions), quiz.id);

      for (const a of attemptsOf.all(quiz.id) as { id: string; answers_json: string }[]) {
        const answers = JSON.parse(a.answers_json) as Answers;
        for (const [qid, answer] of Object.entries(answers)) {
          const map = remap.get(qid);
          if (map && answer?.kind === "choice") {
            answer.selected = answer.selected.map((i) => map[i] ?? i).sort((x, y) => x - y);
          }
        }
        saveAttempt.run(JSON.stringify(answers), a.id);
      }
    }
  },
  // 3: Ask Claude conversations, one per question.
  (db) => {
    db.exec(`
      CREATE TABLE tutor_chats (
        quiz_id       TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
        question_id   TEXT NOT NULL,
        messages_json TEXT NOT NULL,
        updated_at    INTEGER NOT NULL,
        PRIMARY KEY (quiz_id, question_id)
      );
    `);
  },
];

function migrate(db: Database.Database) {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version >= MIGRATIONS.length) return;

  // Rebuilding a table must not fire ON DELETE CASCADE, which would wipe attempts.
  // foreign_keys can only be toggled outside a transaction.
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      for (let v = version; v < MIGRATIONS.length; v++) MIGRATIONS[v](db);
      const broken = db.pragma("foreign_key_check") as unknown[];
      if (broken.length) throw new Error(`Migration left ${broken.length} broken references`);
      db.pragma(`user_version = ${MIGRATIONS.length}`);
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

export const db = (globalThis.__examHelperDb ??= open());
// Also covers a connection opened by older code and kept across dev hot reloads.
migrate(db);
