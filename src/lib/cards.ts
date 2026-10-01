// Flashcards are derived from notes on every request. There is no card authoring:
// every rule note and every case note is a card, keyed by the note's content path.

import type { ContentTree, Course, Note, Unit } from "./content/types";

export type CardSection = { label: string; text?: string; items?: string[] };

export type Card = {
  /** Note path relative to content/, e.g. "property/adverse-possession/notes/x.md". Stable key for SQLite. */
  key: string;
  courseSlug: string;
  courseTitle: string;
  unitSlug: string;
  unitTitle: string;
  unitOrder: number;
  noteType: "rule" | "case";
  front: string;
  back: CardSection[];
};

export function cardFromNote(course: Course, unit: Unit, note: Note): Card | null {
  const fm = note.frontmatter;
  const base = {
    key: note.path,
    courseSlug: course.slug,
    courseTitle: course.title,
    unitSlug: unit.slug,
    unitTitle: unit.title,
    unitOrder: unit.order,
  };
  if (fm.type === "rule") {
    return {
      ...base,
      noteType: "rule",
      front: fm.name,
      back: [
        { label: "Rule statement", text: fm.ruleStatement },
        { label: "Elements", items: fm.elements },
        { label: "Exceptions", items: fm.exceptions },
        { label: "Wisconsin variation", text: fm.wisconsinVariation },
      ],
    };
  }
  if (fm.type === "case") {
    return {
      ...base,
      noteType: "case",
      front: fm.name,
      back: [
        { label: "Rule", text: fm.rule },
        { label: "Holding", text: fm.holding },
      ],
    };
  }
  return null;
}

/** All cards in syllabus order: courses by order, units by order, notes by filename. */
export function allCards(tree: ContentTree): Card[] {
  const cards: Card[] = [];
  for (const course of tree.courses) {
    for (const unit of course.units) {
      for (const note of unit.notes) {
        const card = cardFromNote(course, unit, note);
        if (card) cards.push(card);
      }
    }
  }
  return cards;
}

export function cardsForUnit(course: Course, unit: Unit): Card[] {
  return unit.notes.map((n) => cardFromNote(course, unit, n)).filter((c): c is Card => c !== null);
}
