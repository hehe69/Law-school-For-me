// Flashcard review queue and SM-2 state persistence.

import { getDb } from "./db";
import type { ContentTree } from "./content/types";
import { allCards, type Card } from "./cards";
import { addDays, applySm2, NEW_CARD, todayString, type Rating, type Sm2State } from "./sm2";

export type CardStateRow = {
  card_key: string;
  course_slug: string;
  unit_slug: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  due_on: string; // YYYY-MM-DD
  last_reviewed_at: string | null;
  last_rating: number | null;
};

export type QueueCard = { card: Card; state: CardStateRow | null };

function stateMap(): Map<string, CardStateRow> {
  const rows = getDb().prepare("SELECT * FROM card_states").all() as CardStateRow[];
  return new Map(rows.map((r) => [r.card_key, r]));
}

/**
 * Cards due today (or overdue), plus never-reviewed cards, which count as due.
 * Overdue first, then new, then by last review time so a card just rated "Again" goes to the back.
 */
export function dueQueue(tree: ContentTree, courseSlug?: string): QueueCard[] {
  const today = todayString();
  const states = stateMap();
  const queue: QueueCard[] = [];
  for (const card of allCards(tree)) {
    if (courseSlug && card.courseSlug !== courseSlug) continue;
    const state = states.get(card.key) ?? null;
    if (state && state.due_on > today) continue;
    queue.push({ card, state });
  }
  queue.sort((a, b) => {
    const dueA = a.state?.due_on ?? today;
    const dueB = b.state?.due_on ?? today;
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    const lastA = a.state?.last_reviewed_at ?? "";
    const lastB = b.state?.last_reviewed_at ?? "";
    return lastA < lastB ? -1 : lastA > lastB ? 1 : 0;
  });
  return queue;
}

export type CourseDue = { due: number; total: number; newCards: number };

/** Per course: cards due today, total cards, and how many have never been reviewed. */
export function dueByCourse(tree: ContentTree): Map<string, CourseDue> {
  const today = todayString();
  const states = stateMap();
  const map = new Map<string, CourseDue>();
  for (const card of allCards(tree)) {
    const entry = map.get(card.courseSlug) ?? { due: 0, total: 0, newCards: 0 };
    entry.total += 1;
    const state = states.get(card.key);
    if (!state) entry.newCards += 1;
    if (!state || state.due_on <= today) entry.due += 1;
    map.set(card.courseSlug, entry);
  }
  return map;
}

export function getCardState(cardKey: string): CardStateRow | undefined {
  return getDb().prepare("SELECT * FROM card_states WHERE card_key = ?").get(cardKey) as CardStateRow | undefined;
}

/** Apply a rating to a card and persist the new state and a review log row. */
export function rateCard(card: Card, rating: Rating): CardStateRow {
  const db = getDb();
  const existing = getCardState(card.key);
  const prev: Sm2State = existing
    ? { ease: existing.ease, intervalDays: existing.interval_days, repetitions: existing.repetitions }
    : NEW_CARD;
  const next = applySm2(prev, rating);
  const now = new Date().toISOString();
  const dueOn = addDays(todayString(), next.intervalDays);

  db.transaction(() => {
    db.prepare(
      `INSERT INTO card_states (card_key, course_slug, unit_slug, ease, interval_days, repetitions, due_on, last_reviewed_at, last_rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(card_key) DO UPDATE SET
         course_slug = excluded.course_slug, unit_slug = excluded.unit_slug, ease = excluded.ease,
         interval_days = excluded.interval_days, repetitions = excluded.repetitions, due_on = excluded.due_on,
         last_reviewed_at = excluded.last_reviewed_at, last_rating = excluded.last_rating`,
    ).run(card.key, card.courseSlug, card.unitSlug, next.ease, next.intervalDays, next.repetitions, dueOn, now, rating);
    db.prepare(
      `INSERT INTO card_reviews (card_key, course_slug, unit_slug, reviewed_at, rating, interval_days, ease)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(card.key, card.courseSlug, card.unitSlug, now, rating, next.intervalDays, next.ease);
  })();

  return getCardState(card.key)!;
}

/** Number of reviews done today, for the review page header. */
export function reviewsToday(): number {
  const today = todayString();
  const row = getDb()
    .prepare("SELECT COUNT(*) AS n FROM card_reviews WHERE substr(reviewed_at, 1, 10) = ?")
    .get(today) as { n: number };
  return row.n;
}

/** Most recent card review per unit, keyed "course/unit". ISO timestamps. */
export function lastReviewByUnit(): Map<string, string> {
  const rows = getDb()
    .prepare("SELECT course_slug, unit_slug, MAX(reviewed_at) AS last FROM card_reviews GROUP BY course_slug, unit_slug")
    .all() as { course_slug: string; unit_slug: string; last: string }[];
  return new Map(rows.map((r) => [`${r.course_slug}/${r.unit_slug}`, r.last]));
}
