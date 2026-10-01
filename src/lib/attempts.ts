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
  /** 1 per multiple-choice question, 1 per issue in an issue question */
  points_earned: number;
  points_possible: number;
  /** JSON DiagnosticReport, only for scope = 'diagnostic' */
  diagnostic_report: string | null;
};

export type IssueResult = "spotted" | "missed" | "wrong-rule";
export type IssueResultEntry = { name: string; ruleNotePath: string; result: IssueResult };

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
  question_type: "mc" | "issue";
  written_answer: string | null;
  issue_count: number | null;
  spotted_count: number | null;
  issue_results: string | null; // JSON IssueResultEntry[] once graded
  graded_at: string | null;
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
  questions: NewAttemptQuestion[];
};

export type NewAttemptQuestion =
  | { type: "mc"; courseSlug: string; unitSlug: string; questionId: string; selected: number | null; correctAnswer: number; flagged: boolean; tags: string[] }
  | { type: "issue"; courseSlug: string; unitSlug: string; questionId: string; written: string; issueCount: number; flagged: boolean; tags: string[] };

export function insertAttempt(a: NewAttempt): number {
  const db = getDb();
  const mcCorrect = a.questions.filter((q) => q.type === "mc" && q.selected === q.correctAnswer).length;
  const pointsPossible = a.questions.reduce((n, q) => n + (q.type === "mc" ? 1 : q.issueCount), 0);
  const total = a.questions.length;
  const insertAttemptStmt = db.prepare(`
    INSERT INTO attempts (course_slug, unit_slug, scope, started_at, finished_at, time_limit_seconds,
      time_used_seconds, auto_submitted, question_count, correct_count, score_percent, points_earned, points_possible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertQuestionStmt = db.prepare(`
    INSERT INTO attempt_questions (attempt_id, position, course_slug, unit_slug, question_id, selected,
      correct_answer, is_correct, flagged, tags, question_type, written_answer, issue_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const run = db.transaction(() => {
    // Issue questions start ungraded, so they contribute nothing to the score until graded.
    const info = insertAttemptStmt.run(
      a.courseSlug, a.unitSlug, a.scope, a.startedAt, a.finishedAt, a.timeLimitSeconds,
      a.timeUsedSeconds, a.autoSubmitted ? 1 : 0, total, mcCorrect,
      pointsPossible === 0 ? 0 : (100 * mcCorrect) / pointsPossible, mcCorrect, pointsPossible,
    );
    const attemptId = Number(info.lastInsertRowid);
    a.questions.forEach((q, i) => {
      if (q.type === "mc") {
        insertQuestionStmt.run(
          attemptId, i, q.courseSlug, q.unitSlug, q.questionId, q.selected,
          q.correctAnswer, q.selected === q.correctAnswer ? 1 : 0, q.flagged ? 1 : 0, JSON.stringify(q.tags), "mc", null, null,
        );
      } else {
        insertQuestionStmt.run(
          attemptId, i, q.courseSlug, q.unitSlug, q.questionId, null,
          -1, 0, q.flagged ? 1 : 0, JSON.stringify(q.tags), "issue", q.written, q.issueCount,
        );
      }
    });
    return attemptId;
  });
  return run();
}

/** Store self-grading for every issue question in an attempt and recompute its score. */
export function gradeIssues(attemptId: number, grades: Map<number, IssueResultEntry[]>): void {
  const db = getDb();
  const run = db.transaction(() => {
    const now = new Date().toISOString();
    const update = db.prepare(
      "UPDATE attempt_questions SET issue_results = ?, spotted_count = ?, is_correct = ?, graded_at = ? WHERE attempt_id = ? AND position = ? AND question_type = 'issue'",
    );
    for (const [position, entries] of grades) {
      const spotted = entries.filter((e) => e.result === "spotted").length;
      update.run(JSON.stringify(entries), spotted, spotted === entries.length ? 1 : 0, now, attemptId, position);
    }
    const rows = db.prepare("SELECT * FROM attempt_questions WHERE attempt_id = ?").all(attemptId) as AttemptQuestionRow[];
    const earned = rows.reduce((n, r) => n + (r.question_type === "mc" ? r.is_correct : (r.spotted_count ?? 0)), 0);
    const possible = rows.reduce((n, r) => n + (r.question_type === "mc" ? 1 : (r.issue_count ?? 0)), 0);
    const correct = rows.filter((r) => r.is_correct).length;
    db.prepare("UPDATE attempts SET points_earned = ?, points_possible = ?, correct_count = ?, score_percent = ? WHERE id = ?").run(
      earned, possible, correct, possible === 0 ? 0 : (100 * earned) / possible, attemptId,
    );
  });
  run();
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

export function setDiagnosticReport(attemptId: number, reportJson: string): void {
  getDb().prepare("UPDATE attempts SET diagnostic_report = ? WHERE id = ?").run(reportJson, attemptId);
}

export function listDiagnostics(courseSlug: string): AttemptRow[] {
  return getDb()
    .prepare("SELECT * FROM attempts WHERE course_slug = ? AND scope = 'diagnostic' ORDER BY finished_at DESC")
    .all(courseSlug) as AttemptRow[];
}

/** Most recent diagnostic per course, keyed by course slug. */
export function lastDiagnosticByCourse(): Map<string, AttemptRow> {
  const rows = getDb()
    .prepare("SELECT * FROM attempts WHERE scope = 'diagnostic' ORDER BY finished_at DESC")
    .all() as AttemptRow[];
  const map = new Map<string, AttemptRow>();
  for (const r of rows) if (!map.has(r.course_slug)) map.set(r.course_slug, r);
  return map;
}

/** Ids of questions that have appeared in any attempt for this course. */
export function seenQuestionIds(courseSlug: string): Set<string> {
  const rows = getDb().prepare("SELECT DISTINCT question_id FROM attempt_questions WHERE course_slug = ?").all(courseSlug) as { question_id: string }[];
  return new Set(rows.map((r) => r.question_id));
}
