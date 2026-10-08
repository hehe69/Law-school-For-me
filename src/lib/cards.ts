// Flashcards: rule and element nodes with the flashcard toggle on. One SM-2 state per node; every rating is
// kept in card_reviews. The daily review page works through the due cards.

import type { OutlineNode } from "./types.ts";
import { nowIso, type Db } from "./db.ts";
import { rowToNode } from "./nodes.ts";
import { addDays, applySm2, NEW_CARD, todayString, type Rating, type Sm2State } from "./sm2.ts";
import { asElements, fieldString } from "./fields.ts";

export type CardState = Sm2State & { nodeId: string; dueOn: string; lastReviewedAt: string | null; lastRating: number | null };

type StateRow = { node_id: string; ease: number; interval_days: number; repetitions: number; due_on: string; last_reviewed_at: string | null; last_rating: number | null };

function rowToState(r: StateRow): CardState {
  return { nodeId: r.node_id, ease: r.ease, intervalDays: r.interval_days, repetitions: r.repetitions, dueOn: r.due_on, lastReviewedAt: r.last_reviewed_at, lastRating: r.last_rating };
}

export function getCardState(db: Db, nodeId: string): CardState | null {
  const row = db.prepare("SELECT * FROM card_states WHERE node_id = ?").get(nodeId) as StateRow | undefined;
  return row ? rowToState(row) : null;
}

/** Front and back of a card. */
export function cardFaces(node: OutlineNode): { front: string; back: string[] } {
  if (node.type === "rule") {
    const elements = asElements(node.fields.elements).filter((e) => e.text.trim());
    return {
      front: node.title || "(untitled rule)",
      back: [
        fieldString(node, "ruleStatement"),
        ...elements.map((e, i) => `${i + 1}. ${e.text}${e.definition ? ` — ${e.definition}` : ""}`),
        fieldString(node, "localVariation") ? `Wisconsin: ${fieldString(node, "localVariation")}` : "",
      ].filter(Boolean),
    };
  }
  return {
    front: node.title || fieldString(node, "text") || "(untitled element)",
    back: [fieldString(node, "text") !== node.title ? fieldString(node, "text") : "", fieldString(node, "definition"), fieldString(node, "satisfiedWhen") ? `Satisfied when: ${fieldString(node, "satisfiedWhen")}` : ""].filter(Boolean),
  };
}

export type CourseCard = { courseId: number; courseSlug: string; courseTitle: string; outlineName: string; node: OutlineNode; state: CardState | null };

type CardRow = Parameters<typeof rowToNode>[0] & { outline_name: string; course_id: number; course_slug: string; course_title: string } & Partial<StateRow>;

/** Every flashcard node (of one course, or all), with its scheduling state. Attack outlines never make cards. */
export function listCards(db: Db, courseId?: number): CourseCard[] {
  const rows = db
    .prepare(
      `SELECT n.*, o.name AS outline_name, c.id AS course_id, c.slug AS course_slug, c.title AS course_title,
              s.ease, s.interval_days, s.repetitions, s.due_on, s.last_reviewed_at, s.last_rating
       FROM nodes n
       JOIN outlines o ON o.id = n.outline_id
       JOIN courses c ON c.id = o.course_id
       LEFT JOIN card_states s ON s.node_id = n.id
       WHERE n.flashcard = 1 AND n.type IN ('rule', 'element') AND o.kind != 'attack' ${courseId !== undefined ? "AND c.id = ?" : ""}
       ORDER BY c.sort_order, c.title, o.created_at, n.created_at`,
    )
    .all(...(courseId !== undefined ? [courseId] : [])) as CardRow[];
  return rows.map((r) => ({
    courseId: r.course_id,
    courseSlug: r.course_slug,
    courseTitle: r.course_title,
    outlineName: r.outline_name,
    node: rowToNode(r),
    state: r.due_on ? rowToState({ node_id: r.id, ease: r.ease!, interval_days: r.interval_days!, repetitions: r.repetitions!, due_on: r.due_on, last_reviewed_at: r.last_reviewed_at ?? null, last_rating: r.last_rating ?? null }) : null,
  }));
}

/** Cards due today (or never reviewed), oldest due first; new cards last. */
export function dueCards(db: Db, courseId?: number, today = todayString()): CourseCard[] {
  return listCards(db, courseId)
    .filter((c) => !c.state || c.state.dueOn <= today)
    .sort((a, b) => (a.state?.dueOn ?? "9999").localeCompare(b.state?.dueOn ?? "9999"));
}

export type ReviewSummary = { due: number; newCards: number; total: number; reviewedToday: number };

export function reviewSummary(db: Db, courseId?: number, today = todayString()): ReviewSummary {
  const cards = listCards(db, courseId);
  const due = cards.filter((c) => c.state && c.state.dueOn <= today).length;
  const newCards = cards.filter((c) => !c.state).length;
  const ids = new Set(cards.map((c) => c.node.id));
  const reviewedToday = (db.prepare("SELECT node_id FROM card_reviews WHERE reviewed_at >= ?").all(`${today}T00:00:00`) as { node_id: string }[]).filter((r) => ids.has(r.node_id)).length;
  return { due: due + newCards, newCards, total: cards.length, reviewedToday };
}

/** Rate a card: apply SM-2, store the new state and the review. Returns the new state. */
export function reviewCard(db: Db, nodeId: string, rating: Rating, today = todayString()): CardState {
  const current = getCardState(db, nodeId);
  const next = applySm2(current ?? NEW_CARD, rating);
  const dueOn = addDays(today, next.intervalDays);
  const now = nowIso();
  db.transaction(() => {
    db.prepare(
      `INSERT INTO card_states (node_id, ease, interval_days, repetitions, due_on, last_reviewed_at, last_rating) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(node_id) DO UPDATE SET ease = excluded.ease, interval_days = excluded.interval_days, repetitions = excluded.repetitions, due_on = excluded.due_on, last_reviewed_at = excluded.last_reviewed_at, last_rating = excluded.last_rating`,
    ).run(nodeId, next.ease, next.intervalDays, next.repetitions, dueOn, now, rating);
    db.prepare("INSERT INTO card_reviews (node_id, reviewed_at, rating, interval_days, ease) VALUES (?, ?, ?, ?, ?)").run(nodeId, now, rating, next.intervalDays, next.ease);
  })();
  return { nodeId, ...next, dueOn, lastReviewedAt: now, lastRating: rating };
}
