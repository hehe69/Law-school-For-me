// The Gaps view: what each course is missing. Computed from content plus activity in SQLite.

import type { ContentTree, Course, Unit } from "./content/types";
import { unitStatsMap } from "./attempts";
import { lastReviewByUnit } from "./reviews";

export const STALE_DAYS = 7;

export type TopicGap = { unit: Unit; topic: string };
export type UnknownTopic = { unit: Unit; notePath: string; topic: string };
export type StaleUnit = { unit: Unit; lastActivityAt: string | null; daysSince: number | null };

export type CourseGaps = {
  course: Course;
  /** Syllabus topics from unit.json that no note in that unit lists under "topics" */
  uncoveredTopics: TopicGap[];
  /** Note topics that do not match any syllabus topic in the unit (likely typos) */
  unknownTopics: UnknownTopic[];
  unitsWithoutQuestions: Unit[];
  staleUnits: StaleUnit[];
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function computeGaps(tree: ContentTree, now = new Date()): CourseGaps[] {
  const attempts = unitStatsMap();
  const reviews = lastReviewByUnit();
  const nowMs = now.getTime();

  return tree.courses.map((course) => {
    const uncoveredTopics: TopicGap[] = [];
    const unknownTopics: UnknownTopic[] = [];
    const unitsWithoutQuestions: Unit[] = [];
    const staleUnits: StaleUnit[] = [];

    for (const unit of course.units) {
      const syllabus = new Set(unit.syllabusTopics.map(norm));
      const covered = new Set<string>();
      for (const note of unit.notes) {
        for (const topic of note.topics) {
          const t = norm(topic);
          if (syllabus.has(t)) covered.add(t);
          else unknownTopics.push({ unit, notePath: note.path, topic });
        }
      }
      for (const topic of unit.syllabusTopics) {
        if (!covered.has(norm(topic))) uncoveredTopics.push({ unit, topic });
      }

      if (unit.questions.length === 0) unitsWithoutQuestions.push(unit);

      const key = `${course.slug}/${unit.slug}`;
      const candidates = [attempts.get(key)?.lastAttemptAt ?? null, reviews.get(key) ?? null].filter(
        (x): x is string => x !== null,
      );
      const last = candidates.length ? candidates.sort().at(-1)! : null;
      const daysSince = last === null ? null : Math.floor((nowMs - new Date(last).getTime()) / 86_400_000);
      if (daysSince === null || daysSince >= STALE_DAYS) staleUnits.push({ unit, lastActivityAt: last, daysSince });
    }

    return { course, uncoveredTopics, unknownTopics, unitsWithoutQuestions, staleUnits };
  });
}
