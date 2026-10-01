// Mastery colours for rule notes (and the elements they contain), used by the map editor's mastery toggle.
// Flashcard ease and the miss rate of questions tagged with the note's topics are blended into one score.

import type { Course } from "./content/types";
import { getDb } from "./db";


export { masteryColour, masteryScore, MASTERY_FILL, type Mastery } from "./mastery";
import { masteryColour, masteryScore, type Mastery } from "./mastery";

/** Miss rate per tag for a course from graded attempts, lowercase keys. */
function tagMissRates(courseSlug: string): Map<string, number> {
  const rows = getDb()
    .prepare(
      `SELECT lower(j.value) AS tag, COUNT(*) AS seen, SUM(CASE WHEN aq.is_correct = 0 THEN 1 ELSE 0 END) AS missed
       FROM attempt_questions aq, json_each(aq.tags) j
       WHERE aq.course_slug = ? AND NOT (aq.question_type = 'issue' AND aq.graded_at IS NULL)
       GROUP BY lower(j.value)`,
    )
    .all(courseSlug) as { tag: string; seen: number; missed: number }[];
  return new Map(rows.map((r) => [r.tag, r.seen ? r.missed / r.seen : 0]));
}

/** Mastery per rule note path in a course. */
export function ruleMastery(course: Course): Record<string, Mastery> {
  const eases = new Map((getDb().prepare("SELECT card_key, ease FROM card_states").all() as { card_key: string; ease: number }[]).map((r) => [r.card_key, r.ease]));
  const rates = tagMissRates(course.slug);
  const out: Record<string, Mastery> = {};
  for (const unit of course.units) {
    for (const note of unit.notes) {
      if (note.frontmatter.type !== "rule") continue;
      const ease = eases.get(note.path) ?? null;
      const r = note.topics.map((t) => rates.get(t.toLowerCase())).filter((x): x is number => x !== undefined);
      const missRate = r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
      out[note.path] = masteryColour(masteryScore(ease, missRate));
    }
  }
  return out;
}
