// Diagnostic exams: an even sample across every unit (and across tags within a unit), preferring
// questions never seen, plus the report computed from the graded rows and saved with the attempt.

import type { AttemptQuestionRow } from "./attempts";
import type { Course, Question } from "./content/types";
import { activeQuestions } from "./content/loader";
import { masteryColour, type Mastery } from "./map";
import { shuffle } from "./testing";

export const DEFAULT_PER_UNIT = 2;

export type Rating = "strong" | "okay" | "weak" | "untested";

export type ReportLine = { key: string; label: string; seen: number; correct: number; rating: Rating };

export type DiagnosticReport = {
  units: ReportLine[]; // every unit in syllabus order, including untested ones
  tags: ReportLine[]; // worst first
  recommendedOrder: { slug: string; label: string; rating: Rating }[];
  ungraded: number; // issue questions still to grade when the report was built
};

/** Units that can contribute questions. */
export function unitsWithQuestions(course: Course) {
  return course.units.filter((u) => activeQuestions(u).length > 0);
}

export function minimumCount(course: Course): number {
  return unitsWithQuestions(course).length;
}

export function defaultCount(course: Course): number {
  return unitsWithQuestions(course).length * DEFAULT_PER_UNIT;
}

function tagGroups(questions: Question[]): Map<string, Question[]> {
  const groups = new Map<string, Question[]>();
  for (const q of questions) {
    const tags = q.tags.length ? q.tags : ["(untagged)"];
    for (const t of tags) {
      const list = groups.get(t) ?? [];
      list.push(q);
      groups.set(t, list);
    }
  }
  return groups;
}

/**
 * Pick up to `quota` questions from a unit: first round-robin across tags over never-seen questions,
 * then, if more are needed, round-robin again over seen ones.
 */
function pickFromUnit(questions: Question[], quota: number, seen: Set<string>): Question[] {
  const picked: Question[] = [];
  const pickedIds = new Set<string>();
  for (const pass of [(q: Question) => !seen.has(q.id), (q: Question) => seen.has(q.id)]) {
    const groups = shuffle([...tagGroups(questions.filter(pass)).values()].map((qs) => shuffle(qs)));
    while (picked.length < quota && groups.some((g) => g.length > 0)) {
      for (const g of groups) {
        if (picked.length >= quota) break;
        let next = g.shift();
        while (next && pickedIds.has(next.id)) next = g.shift();
        if (next) {
          picked.push(next);
          pickedIds.add(next.id);
        }
      }
    }
  }
  return picked;
}

/**
 * Build the diagnostic: `count` questions spread evenly over every unit with questions (at least one each),
 * one issue question from the unit with the most issue questions when the course has any, the rest multiple choice.
 */
export function buildDiagnostic(course: Course, count: number, seen: Set<string>): Question[] {
  const units = unitsWithQuestions(course);
  if (units.length === 0) return [];
  const total = Math.max(units.length, Math.floor(count));
  const base = Math.floor(total / units.length);
  let remainder = total - base * units.length;
  const quotas = new Map(units.map((u) => [u.slug, base]));
  // Spare questions go to the units with the largest pools.
  for (const u of [...units].sort((a, b) => activeQuestions(b).length - activeQuestions(a).length)) {
    if (remainder <= 0) break;
    quotas.set(u.slug, (quotas.get(u.slug) ?? 0) + 1);
    remainder -= 1;
  }

  let issuePick: Question | undefined;
  const issueUnit = [...units].sort((a, b) => activeQuestions(b).filter((q) => q.type === "issue").length - activeQuestions(a).filter((q) => q.type === "issue").length)[0];
  const issuePool = issueUnit ? activeQuestions(issueUnit).filter((q) => q.type === "issue") : [];
  if (issuePool.length > 0) {
    issuePick = shuffle(issuePool.filter((q) => !seen.has(q.id)))[0] ?? shuffle(issuePool)[0];
    quotas.set(issueUnit.slug, Math.max(0, (quotas.get(issueUnit.slug) ?? 1) - 1));
  }

  const mc: Question[] = [];
  const leftovers: { unit: typeof units[number]; pool: Question[] }[] = [];
  for (const u of units) {
    const pool = activeQuestions(u).filter((q) => q.type === "mc");
    const got = pickFromUnit(pool, quotas.get(u.slug) ?? 0, seen);
    mc.push(...got);
    const gotIds = new Set(got.map((q) => q.id));
    leftovers.push({ unit: u, pool: pool.filter((q) => !gotIds.has(q.id)) });
  }
  // A unit with too few questions for its quota hands the spare slots to the units with the most left.
  const wantMc = total - (issuePick ? 1 : 0);
  while (mc.length < wantMc) {
    const next = leftovers.filter((l) => l.pool.length > 0).sort((a, b) => b.pool.length - a.pool.length)[0];
    if (!next) break;
    const extra = pickFromUnit(next.pool, 1, seen)[0];
    next.pool = next.pool.filter((q) => q.id !== extra.id);
    mc.push(extra);
  }
  return issuePick ? [...mc, issuePick] : mc;
}

const RATING_BY_MASTERY: Record<Mastery, Rating> = { green: "strong", amber: "okay", red: "weak", grey: "untested" };

function rate(seen: number, correct: number): Rating {
  return RATING_BY_MASTERY[masteryColour(seen === 0 ? null : correct / seen)];
}

/** Build the report from an attempt's rows. Ungraded issue questions are left out of the counts. */
export function buildReport(course: Course, rows: AttemptQuestionRow[]): DiagnosticReport {
  const graded = rows.filter((r) => !(r.question_type === "issue" && !r.graded_at));
  const ungraded = rows.length - graded.length;

  const units: ReportLine[] = course.units.map((u) => {
    const mine = graded.filter((r) => r.unit_slug === u.slug);
    const correct = mine.filter((r) => r.is_correct).length;
    const hasQuestions = activeQuestions(u).length > 0;
    return { key: u.slug, label: `Unit ${u.order}: ${u.title}`, seen: mine.length, correct, rating: hasQuestions && mine.length ? rate(mine.length, correct) : "untested" };
  });

  const byTag = new Map<string, { seen: number; correct: number }>();
  for (const r of graded) {
    const tags: string[] = JSON.parse(r.tags);
    for (const t of tags.length ? tags : ["(untagged)"]) {
      const e = byTag.get(t) ?? { seen: 0, correct: 0 };
      e.seen += 1;
      if (r.is_correct) e.correct += 1;
      byTag.set(t, e);
    }
  }
  const tags: ReportLine[] = [...byTag.entries()]
    .map(([t, e]) => ({ key: t, label: t, seen: e.seen, correct: e.correct, rating: rate(e.seen, e.correct) }))
    .sort((a, b) => a.correct / a.seen - b.correct / b.seen || b.seen - a.seen || a.label.localeCompare(b.label));

  const weakFirst = units
    .filter((u) => u.rating !== "untested")
    .sort((a, b) => a.correct / a.seen - b.correct / b.seen || a.correct - b.correct);
  const untested = units.filter((u) => u.rating === "untested");
  const recommendedOrder = [...weakFirst, ...untested].map((u) => ({ slug: u.key, label: u.label, rating: u.rating }));

  return { units, tags, recommendedOrder, ungraded };
}
