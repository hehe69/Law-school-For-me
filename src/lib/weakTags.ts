// Weak-tag statistics and "missed question" queries, computed from attempt_questions.
// Tags are the snapshot stored with each attempt, so renaming a tag in content starts a new row.

import { getDb } from "./db";
import type { AttemptRow } from "./attempts";
import type { Course, Question } from "./content/types";

export type TagStat = {
  tag: string;
  seen: number;
  missed: number;
  missRate: number; // 0..1
  /** Questions currently in content carrying this tag */
  inContent: number;
};

export const WEAKEST_COUNT = 3;

/** Every tag seen in attempts for this course, worst first. */
export function tagStats(course: Course): TagStat[] {
  const rows = getDb()
    .prepare(
      `SELECT j.value AS tag, COUNT(*) AS seen, SUM(CASE WHEN aq.is_correct = 0 THEN 1 ELSE 0 END) AS missed
       FROM attempt_questions aq, json_each(aq.tags) j
       WHERE aq.course_slug = ?
       GROUP BY j.value`,
    )
    .all(course.slug) as { tag: string; seen: number; missed: number }[];

  const inContent = new Map<string, number>();
  for (const unit of course.units) {
    for (const q of unit.questions) {
      for (const t of q.tags) inContent.set(t, (inContent.get(t) ?? 0) + 1);
    }
  }

  return rows
    .map((r) => ({ tag: r.tag, seen: r.seen, missed: r.missed, missRate: r.seen ? r.missed / r.seen : 0, inContent: inContent.get(r.tag) ?? 0 }))
    .sort((a, b) => b.missRate - a.missRate || b.missed - a.missed || b.seen - a.seen || a.tag.localeCompare(b.tag));
}

/** The N weakest tags that still have questions in content to test. */
export function weakestTags(stats: TagStat[], n = WEAKEST_COUNT): string[] {
  return stats.filter((s) => s.inContent > 0).slice(0, n).map((s) => s.tag);
}

/** Course questions carrying any of the given tags, in syllabus order. */
export function questionsWithTags(course: Course, tags: string[]): Question[] {
  const set = new Set(tags);
  return course.units.flatMap((u) => u.questions.filter((q) => q.tags.some((t) => set.has(t))));
}

/** Distinct ids of questions missed (wrong or unanswered) in any attempt. Optionally only one unit's questions. */
export function missedQuestionIds(courseSlug: string, unitSlug?: string): string[] {
  const db = getDb();
  const rows = unitSlug
    ? db.prepare("SELECT DISTINCT question_id FROM attempt_questions WHERE course_slug = ? AND unit_slug = ? AND is_correct = 0").all(courseSlug, unitSlug)
    : db.prepare("SELECT DISTINCT question_id FROM attempt_questions WHERE course_slug = ? AND is_correct = 0").all(courseSlug);
  return (rows as { question_id: string }[]).map((r) => r.question_id);
}

/** Ids missed in one specific attempt, in the order they were shown. */
export function missedInAttempt(attemptId: number): string[] {
  return (
    getDb()
      .prepare("SELECT question_id FROM attempt_questions WHERE attempt_id = ? AND is_correct = 0 ORDER BY position")
      .all(attemptId) as { question_id: string }[]
  ).map((r) => r.question_id);
}

/** Recent attempts for a course with a given scope (used for the weak-tags page, whose tests belong to no unit). */
export function listAttemptsForCourseScope(courseSlug: string, scope: string, limit = 10): AttemptRow[] {
  return getDb()
    .prepare("SELECT * FROM attempts WHERE course_slug = ? AND scope = ? ORDER BY finished_at DESC LIMIT ?")
    .all(courseSlug, scope, limit) as AttemptRow[];
}
