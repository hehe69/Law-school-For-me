// Builds the node/edge data for the course and unit maps. Everything is computed on the server;
// the client only lays it out and draws it.

import type { Course, Note, Unit } from "./content/types";
import { getDb } from "./db";
import { courseQuestions, noteRef, resolveRuleRef } from "./content/loader";

export type Mastery = "green" | "amber" | "red" | "grey";
export type NodeKind = "unit" | "rule" | "element" | "exception" | "wisconsin" | "case" | "class" | "topic";

export type MapNode = {
  id: string;
  kind: NodeKind;
  label: string;
  /** Full text shown on hover */
  hover: string;
  href?: string;
  unitSlug: string;
  mastery: Mastery;
  draft: boolean;
  /** For rule-tree nodes: the rule note path they belong to */
  rule?: string;
  linked: boolean;
  /** Topic nodes: true when no note in the unit lists this topic */
  uncovered?: boolean;
};

export type MapEdge = { id: string; source: string; target: string; kind: "unit-rule" | "rule-element" | "rule-exception" | "rule-wisconsin" | "case-rule" | "class-rule" | "rule-rule" | "unit-topic" };

export type MapData = {
  nodes: MapNode[];
  edges: MapEdge[];
  rules: { id: string; label: string; treeHref: string }[];
  masteryNotes: Record<string, { ease: number | null; missRate: number | null }>;
};

const EASE_LOW = 1.3;
const EASE_HIGH = 2.5;

/** Blend flashcard ease and tag miss rate into a 0..1 score, or null with no data. */
export function masteryScore(ease: number | null, missRate: number | null): number | null {
  const parts: number[] = [];
  if (ease !== null) parts.push(Math.max(0, Math.min(1, (ease - EASE_LOW) / (EASE_HIGH - EASE_LOW))));
  if (missRate !== null) parts.push(1 - missRate);
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function masteryColour(score: number | null): Mastery {
  if (score === null) return "grey";
  if (score >= 0.7) return "green";
  if (score >= 0.4) return "amber";
  return "red";
}

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

function cardEases(): Map<string, number> {
  const rows = getDb().prepare("SELECT card_key, ease FROM card_states").all() as { card_key: string; ease: number }[];
  return new Map(rows.map((r) => [r.card_key, r.ease]));
}

export function buildMap(course: Course, only?: Unit): MapData {
  const units = only ? [only] : course.units;
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  const rules: MapData["rules"] = [];
  const masteryNotes: MapData["masteryNotes"] = {};
  const eases = cardEases();
  const missRates = tagMissRates(course.slug);
  const taggedQuestions = new Set(courseQuestions(course).flatMap((q) => q.tags.map((t) => t.toLowerCase())));
  const linkedIds = new Set<string>();
  const unitHref = (u: Unit) => `/courses/${course.slug}/units/${u.slug}`;
  const noteHref = (u: Unit, n: Note) => `${unitHref(u)}#note-${n.slug}`;
  const ruleId = (path: string) => `rule:${path}`;
  const push = (n: MapNode) => nodes.push(n);
  const link = (e: Omit<MapEdge, "id">) => {
    edges.push({ ...e, id: `${e.source}->${e.target}` });
    linkedIds.add(e.source);
    linkedIds.add(e.target);
  };

  for (const unit of units) {
    const unitId = `unit:${unit.slug}`;
    push({ id: unitId, kind: "unit", label: `Unit ${unit.order}: ${unit.title}`, hover: unit.syllabusTopics.length ? `Topics: ${unit.syllabusTopics.join(", ")}` : unit.title, href: unitHref(unit), unitSlug: unit.slug, mastery: "grey", draft: false, linked: true });

    const covered = new Set(unit.notes.flatMap((n) => n.topics.map((t) => t.toLowerCase())));
    for (const topic of unit.syllabusTopics) {
      const id = `topic:${unit.slug}:${topic.toLowerCase()}`;
      const uncovered = !covered.has(topic.toLowerCase());
      push({ id, kind: "topic", label: topic, hover: uncovered ? `Syllabus topic with no notes tagged to it` : `Syllabus topic`, href: `${unitHref(unit)}`, unitSlug: unit.slug, mastery: "grey", draft: false, linked: true, uncovered });
      link({ source: unitId, target: id, kind: "unit-topic" });
    }

    for (const note of unit.notes) {
      const fm = note.frontmatter;
      const draft = note.status === "draft";
      if (fm.type === "rule") {
        const id = ruleId(note.path);
        const ease = eases.get(note.path) ?? null;
        const rates = note.topics.map((t) => missRates.get(t.toLowerCase())).filter((r): r is number => r !== undefined);
        const missRate = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
        const hasTaggedQuestions = note.topics.some((t) => taggedQuestions.has(t.toLowerCase()));
        masteryNotes[id] = { ease, missRate: missRate ?? (hasTaggedQuestions ? null : null) };
        const mastery = masteryColour(masteryScore(ease, missRate));
        push({ id, kind: "rule", label: fm.name || note.slug, hover: fm.ruleStatement || "(no rule statement yet)", href: noteHref(unit, note), unitSlug: unit.slug, mastery, draft, rule: note.path, linked: true });
        rules.push({ id, label: `${unit.title}: ${fm.name || note.slug}`, treeHref: `${unitHref(unit)}/notes/${note.slug}/tree` });
        link({ source: `unit:${unit.slug}`, target: id, kind: "unit-rule" });
        fm.elements.forEach((el, i) => {
          const eid = `${id}#el${i + 1}`;
          push({ id: eid, kind: "element", label: `${i + 1}. ${el}`, hover: el, href: noteHref(unit, note), unitSlug: unit.slug, mastery, draft, rule: note.path, linked: true });
          link({ source: id, target: eid, kind: "rule-element" });
        });
        fm.exceptions.forEach((ex, i) => {
          const xid = `${id}#ex${i + 1}`;
          const el = fm.exceptionElements[i];
          push({ id: xid, kind: "exception", label: ex, hover: el ? `Exception to element ${el}: ${ex}` : ex, href: noteHref(unit, note), unitSlug: unit.slug, mastery, draft, rule: note.path, linked: true });
          link({ source: el && el <= fm.elements.length ? `${id}#el${el}` : id, target: xid, kind: "rule-exception" });
        });
        if (fm.wisconsinVariation) {
          const wid = `${id}#wi`;
          push({ id: wid, kind: "wisconsin", label: "Wisconsin", hover: fm.wisconsinVariation, href: noteHref(unit, note), unitSlug: unit.slug, mastery, draft, rule: note.path, linked: true });
          link({ source: fm.wisconsinElement && fm.wisconsinElement <= fm.elements.length ? `${id}#el${fm.wisconsinElement}` : id, target: wid, kind: "rule-wisconsin" });
        }
      } else if (fm.type === "case") {
        push({ id: `case:${note.path}`, kind: "case", label: fm.name || note.slug, hover: [fm.rule && `Rule: ${fm.rule}`, fm.holding && `Holding: ${fm.holding}`].filter(Boolean).join("\n") || "(no rule or holding yet)", href: noteHref(unit, note), unitSlug: unit.slug, mastery: "grey", draft, linked: false });
      } else {
        push({ id: `class:${note.path}`, kind: "class", label: `${fm.date || "?"} ${fm.topic || note.slug}`, hover: fm.professorPoint || "(no professor's point yet)", href: noteHref(unit, note), unitSlug: unit.slug, mastery: "grey", draft, linked: false });
      }
    }
  }

  // Cross-note edges, resolved against the whole course so unit maps can still point at rules elsewhere.
  const present = new Set(nodes.map((n) => n.id));
  for (const unit of units) {
    for (const note of unit.notes) {
      const fm = note.frontmatter;
      if (fm.type === "case" && fm.appliesRule) {
        const r = resolveRuleRef(course, fm.appliesRule);
        if (r && present.has(ruleId(r.note.path))) link({ source: `case:${note.path}`, target: ruleId(r.note.path), kind: "case-rule" });
      } else if (fm.type === "class" && fm.modifiesRule) {
        const r = resolveRuleRef(course, fm.modifiesRule);
        if (r && present.has(ruleId(r.note.path))) link({ source: `class:${note.path}`, target: ruleId(r.note.path), kind: "class-rule" });
      } else if (fm.type === "rule") {
        for (const ref of fm.relatedRules) {
          const r = resolveRuleRef(course, ref);
          if (r && present.has(ruleId(r.note.path)) && r.note.path !== note.path) link({ source: ruleId(note.path), target: ruleId(r.note.path), kind: "rule-rule" });
        }
      }
    }
  }
  for (const n of nodes) if (n.kind === "case" || n.kind === "class") n.linked = linkedIds.has(n.id);

  // Keep the ref form handy for external callers.
  void noteRef;
  return { nodes, edges, rules, masteryNotes };
}
