// Read/write helpers for the attempts tables.

import { getDb } from "./db";
import type { Scope } from "./content/loader";

export type AttemptRow = {
  id: number;
  course_slug: string;
  unit_slug: string;
  scope: Scope;
  started_at: string;
  finished_at: string;
  time_limit_seconds: number;
  time_used_seconds: number;
  auto_submitted: number;
  question_count: number;
  correct_count: number;
  score_percent: number;
};

export type AttemptQuestionRow = {
  attempt_id: number;
  position: number;
  course_slug: string;
  unit_slug: string;
  question_id: string;
  selected: number | null;
  correct_answer: number;
  is_correct: number;
  flagged: number;
  tags: string; // JSON array
};

export type NewAttempt = {
  courseSlug: string;
  unitSlug: string;
  scope: Scope;
  startedAt: string;
  finishedAt: string;
  timeLimitSeconds: number;
  timeUsedSeconds: number;
  autoSubmitted: boolean;
  questions: {
    courseSlug: string;
    unitSlug: string;
    questionId: string;
    selected: number | null;
    correctAnswer: number;
    flagged: boolean;
    tags: string[];
  }[];
};

export function insertAttempt(a: NewAttempt): number {
  const db = getDb();
  const correct = a.questions.filter((q) => q.selected === q.correctAnswer).length;
  const total = a.questions.length;
  const insertAttemptStmt = db.prepare(`
    INSERT INTO attempts (course_slug, unit_slug, scope, started_at, finished_at, time_limit_seconds,
      time_used_seconds, auto_submitted, question_count, correct_count, score_percent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertQuestionStmt = db.prepare(`
    INSERT INTO attempt_questions (attempt_id, position, course_slug, unit_slug, question_id, selected,
      correct_answer, is_correct, flagged, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const run = db.transaction(() => {
    const info = insertAttemptStmt.run(
      a.courseSlug, a.unitSlug, a.scope, a.startedAt, a.finishedAt, a.timeLimitSeconds,
      a.timeUsedSeconds, a.autoSubmitted ? 1 : 0, total, correct, total === 0 ? 0 : (100 * correct) / total,
    );
    const attemptId = Number(info.lastInsertRowid);
    a.questions.forEach((q, i) => {
      insertQuestionStmt.run(
        attemptId, i, q.courseSlug, q.unitSlug, q.questionId, q.selected,
        q.correctAnswer, q.selected === q.correctAnswer ? 1 : 0, q.flagged ? 1 : 0, JSON.stringify(q.tags),
      );
    });
    return attemptId;
  });
  return run();
}

export function getAttempt(id: number): { attempt: AttemptRow; questions: AttemptQuestionRow[] } | undefined {
  const db = getDb();
  const attempt = db.prepare("SELECT * FROM attempts WHERE id = ?").get(id) as AttemptRow | undefined;
  if (!attempt) return undefined;
  const questions = db
    .prepare("SELECT * FROM attempt_questions WHERE attempt_id = ? ORDER BY position")
    .all(id) as AttemptQuestionRow[];
  return { attempt, questions };
}

export function listAttemptsForUnit(courseSlug: string, unitSlug: string): AttemptRow[] {
  return getDb()
    .prepare("SELECT * FROM attempts WHERE course_slug = ? AND unit_slug = ? ORDER BY finished_at DESC")
    .all(courseSlug, unitSlug) as AttemptRow[];
}

export type UnitStats = { bestScore: number | null; lastAttemptAt: string | null; attemptCount: number };

/** Best score and last attempt date for every unit that has attempts, keyed "course/unit". */
export function unitStatsMap(): Map<string, UnitStats> {
  const rows = getDb()
    .prepare(
      `SELECT course_slug, unit_slug, MAX(score_percent) AS best, MAX(finished_at) AS last, COUNT(*) AS n
       FROM attempts GROUP BY course_slug, unit_slug`,
    )
    .all() as { course_slug: string; unit_slug: string; best: number; last: string; n: number }[];
  const map = new Map<string, UnitStats>();
  for (const r of rows) {
    map.set(`${r.course_slug}/${r.unit_slug}`, { bestScore: r.best, lastAttemptAt: r.last, attemptCount: r.n });
  }
  return map;
}
