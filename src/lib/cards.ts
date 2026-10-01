// Flashcards are derived from notes on every request. There is no card authoring:
// every rule note and every case note is a card, keyed by the note's content path.

import type { ContentTree, Course, Note, Unit } from "./content/types";
import { readMap, type MapNodeFile } from "./content/mapfile";

export type CardSection = { label: string; text?: string; items?: string[] };

export type Card = {
  /** Note path relative to content/, e.g. "property/adverse-possession/notes/x.md". Stable key for SQLite. */
  key: string;
  courseSlug: string;
  courseTitle: string;
  unitSlug: string;
  unitTitle: string;
  unitOrder: number;
  noteType: "rule" | "case" | "map";
  front: string;
  back: CardSection[];
};

export function cardFromNote(course: Course, unit: Unit, note: Note): Card | null {
  if (note.status === "draft") return null;
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

/** A map box with a definition and no linked note is a card: front = label, back = definition. Opt out with flashcard: false. */
export function cardFromMapNode(course: Course, unit: Unit | undefined, node: MapNodeFile): Card | null {
  if (node.linkedNote || node.flashcard === false || !node.definition.trim()) return null;
  return {
    key: `map:${course.slug}${unit ? `/${unit.slug}` : ""}#${node.id}`,
    courseSlug: course.slug,
    courseTitle: course.title,
    unitSlug: unit?.slug ?? "",
    unitTitle: unit ? unit.title : `${course.title} map`,
    unitOrder: unit?.order ?? 0,
    noteType: "map",
    front: node.label,
    back: [{ label: node.kind, text: node.definition }],
  };
}

/** Cards from the course map and each unit map. */
export function mapCards(course: Course): Card[] {
  const out: Card[] = [];
  for (const n of readMap(course.slug).map.nodes) {
    const c = cardFromMapNode(course, undefined, n);
    if (c) out.push(c);
  }
  for (const unit of course.units) {
    for (const n of readMap(course.slug, unit.slug).map.nodes) {
      const c = cardFromMapNode(course, unit, n);
      if (c) out.push(c);
    }
  }
  return out;
}

/** All cards in syllabus order: courses by order, units by order, notes by filename, then map boxes. */
export function allCards(tree: ContentTree): Card[] {
  const cards: Card[] = [];
  for (const course of tree.courses) {
    for (const unit of course.units) {
      for (const note of unit.notes) {
        const card = cardFromNote(course, unit, note);
        if (card) cards.push(card);
      }
    }
    cards.push(...mapCards(course));
  }
  return cards;
}

/** Find any card by key, whether it comes from a note or a map box. */
export function cardByKey(tree: ContentTree, key: string): Card | undefined {
  return allCards(tree).find((c) => c.key === key);
}

export function cardsForUnit(course: Course, unit: Unit): Card[] {
  const fromNotes = unit.notes.map((n) => cardFromNote(course, unit, n)).filter((c): c is Card => c !== null);
  const fromMap = readMap(course.slug, unit.slug).map.nodes.map((n) => cardFromMapNode(course, unit, n)).filter((c): c is Card => c !== null);
  return [...fromNotes, ...fromMap];
}
