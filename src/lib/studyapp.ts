// Reading the study app's content folder (courses / units / notes as markdown with frontmatter) and turning
// its notes into outline nodes. Import is one-way: nothing here writes to the content folder.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { NodeStatus, OutlineNode } from "./types.ts";
import { nowIso, type Db } from "./db.ts";
import { getCourse, listOutlines } from "./courses.ts";
import { getNode, loadNodes, upsertNodes } from "./nodes.ts";
import { createLink } from "./attachments.ts";
import { makeNode } from "./nodeFactory.ts";
import type { ElementField, ExceptionField } from "./fields.ts";

export type RuleData = {
  name: string;
  ruleStatement: string;
  elements: ElementField[];
  exceptions: ExceptionField[];
  wisconsinVariation: string;
  wisconsinElement: number | null;
  relatedRules: string[];
};
export type CaseData = { name: string; facts: string; issue: string; rule: string; holding: string; whyItMatters: string; appliesRule: string | null };
export type ClassData = { date: string; topic: string; professorPoint: string; modifiesRule: string };

export type StudyNote =
  | { kind: "rule"; path: string; slug: string; title: string; data: RuleData; body: string; topics: string[]; hash: string }
  | { kind: "case"; path: string; slug: string; title: string; data: CaseData; body: string; topics: string[]; hash: string }
  | { kind: "class"; path: string; slug: string; title: string; data: ClassData; body: string; topics: string[]; hash: string };

export type StudyUnit = { slug: string; title: string; order: number; syllabusTopics: string[]; emphasis: string; notes: StudyNote[] };
export type StudyCourse = { slug: string; title: string; order: number; units: StudyUnit[] };
export type StudyTree = { courses: StudyCourse[]; errors: string[]; exists: boolean };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function hashText(text: string): string {
  return crypto.createHash("sha1").update(text).digest("hex");
}

/** "adverse-possession/notes/x.md" or "content/property/…" -> "property/adverse-possession/notes/x.md". */
export function normaliseNoteRef(ref: string, courseSlug: string): string {
  let r = ref.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  if (r.startsWith("content/")) r = r.slice("content/".length);
  if (!r.startsWith(`${courseSlug}/`)) r = `${courseSlug}/${r}`;
  return r;
}

function parseElements(v: unknown): ElementField[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => (typeof e === "string" ? { text: e, definition: "" } : isRecord(e) ? { text: str(e.text), definition: str(e.definition) } : null))
    .filter((e): e is ElementField => e !== null && e.text.trim() !== "");
}

function parseExceptions(v: unknown): ExceptionField[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => {
      if (typeof e === "string") return { text: e, element: null };
      if (isRecord(e)) return { text: str(e.text), element: typeof e.element === "number" && e.element >= 1 ? Math.floor(e.element) : null };
      return null;
    })
    .filter((e): e is ExceptionField => e !== null && e.text.trim() !== "");
}

function normaliseDate(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = str(v).trim();
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

/** Parse one note file. Returns null when it is not a note the outline app understands. */
export function parseStudyNote(contentRelPath: string, text: string): StudyNote | null {
  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(text);
  } catch {
    return null;
  }
  const fm = parsed.data as Record<string, unknown>;
  const topics = Array.isArray(fm.topics) ? fm.topics.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean) : [];
  const slug = path.basename(contentRelPath, ".md");
  const base = { path: contentRelPath, slug, body: parsed.content.trim(), topics, hash: hashText(text) };
  if (fm.type === "rule") {
    const data: RuleData = {
      name: str(fm.name),
      ruleStatement: str(fm.ruleStatement),
      elements: parseElements(fm.elements),
      exceptions: parseExceptions(fm.exceptions),
      wisconsinVariation: str(fm.wisconsinVariation),
      wisconsinElement: typeof fm.wisconsinElement === "number" && fm.wisconsinElement >= 1 ? Math.floor(fm.wisconsinElement) : null,
      relatedRules: Array.isArray(fm.relatedRules) ? fm.relatedRules.filter((r): r is string => typeof r === "string") : [],
    };
    return { kind: "rule", title: data.name || slug, data, ...base };
  }
  if (fm.type === "case") {
    const data: CaseData = {
      name: str(fm.name),
      facts: str(fm.facts),
      issue: str(fm.issue),
      rule: str(fm.rule),
      holding: str(fm.holding),
      whyItMatters: str(fm.whyItMatters),
      appliesRule: str(fm.appliesRule) || null,
    };
    return { kind: "case", title: data.name || slug, data, ...base };
  }
  if (fm.type === "class") {
    const data: ClassData = { date: normaliseDate(fm.date), topic: str(fm.topic), professorPoint: str(fm.professorPoint), modifiesRule: str(fm.modifiesRule) };
    return { kind: "class", title: data.topic || slug, data, ...base };
  }
  return null;
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();
}

/** Read every course, unit and note under the content folder. Never throws; problems go into `errors`. */
export function loadStudyTree(contentDir: string): StudyTree {
  const errors: string[] = [];
  if (!fs.existsSync(contentDir)) return { courses: [], errors: [`The folder does not exist: ${contentDir}`], exists: false };
  const courses: StudyCourse[] = [];
  for (const courseSlug of listDirs(contentDir)) {
    const courseDir = path.join(contentDir, courseSlug);
    const meta = readJson(path.join(courseDir, "course.json"));
    if (!isRecord(meta)) {
      errors.push(`${courseSlug}: no readable course.json, skipped`);
      continue;
    }
    const units: StudyUnit[] = [];
    for (const unitSlug of listDirs(courseDir)) {
      const unitDir = path.join(courseDir, unitSlug);
      const umeta = readJson(path.join(unitDir, "unit.json"));
      if (!isRecord(umeta)) {
        errors.push(`${courseSlug}/${unitSlug}: no readable unit.json, skipped`);
        continue;
      }
      const notes: StudyNote[] = [];
      const notesDir = path.join(unitDir, "notes");
      if (fs.existsSync(notesDir)) {
        for (const file of fs.readdirSync(notesDir).filter((f) => f.endsWith(".md")).sort()) {
          const rel = `${courseSlug}/${unitSlug}/notes/${file}`;
          const note = parseStudyNote(rel, fs.readFileSync(path.join(notesDir, file), "utf8"));
          if (note) notes.push(note);
          else errors.push(`${rel}: not a rule, case or class note, skipped`);
        }
      }
      units.push({
        slug: unitSlug,
        title: str(umeta.title) || unitSlug,
        order: typeof umeta.order === "number" ? umeta.order : 0,
        syllabusTopics: Array.isArray(umeta.syllabusTopics) ? umeta.syllabusTopics.filter((t): t is string => typeof t === "string") : [],
        emphasis: str(umeta.emphasis),
        notes,
      });
    }
    units.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
    courses.push({ slug: courseSlug, title: str(meta.title) || courseSlug, order: typeof meta.order === "number" ? meta.order : 0, units });
  }
  courses.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  return { courses, errors, exists: true };
}

/** Read one note by its content-relative path, or null when missing or unreadable. */
export function readStudyNote(contentDir: string, relPath: string): StudyNote | null {
  const full = path.resolve(contentDir, relPath);
  if (!full.startsWith(path.resolve(contentDir) + path.sep) || !fs.existsSync(full)) return null;
  return parseStudyNote(relPath, fs.readFileSync(full, "utf8"));
}

/** The node content (type, title, fields, body, tags) a note maps to. */
export function noteToNodeContent(note: StudyNote): Pick<OutlineNode, "type" | "title" | "fields" | "body" | "tags"> {
  if (note.kind === "rule") {
    const d = note.data;
    const variation = d.wisconsinElement ? `${d.wisconsinVariation}${d.wisconsinVariation ? "\n\n" : ""}(Changes element ${d.wisconsinElement}.)` : d.wisconsinVariation;
    return {
      type: "rule",
      title: note.title,
      fields: { ruleStatement: d.ruleStatement, elements: d.elements, exceptions: d.exceptions, localVariation: variation, majorityPosition: "", burden: "" },
      body: note.body,
      tags: note.topics,
    };
  }
  if (note.kind === "case") {
    const d = note.data;
    const extra = [d.issue ? `**Issue.** ${d.issue}` : "", d.rule ? `**Rule.** ${d.rule}` : ""].filter(Boolean).join("\n\n");
    return {
      type: "case",
      title: note.title,
      fields: { courtYear: "", facts: d.facts, holding: d.holding, whyHere: d.whyItMatters, professorUse: "", disposition: "" },
      body: [extra, note.body].filter(Boolean).join("\n\n"),
      tags: note.topics,
    };
  }
  const d = note.data;
  return {
    type: "professor-note",
    title: note.title,
    fields: { date: d.date, said: d.professorPoint, modifiesRule: null },
    body: note.body,
    tags: note.topics,
  };
}

/** Find the node (in any outline of the course) linked to a study note path. */
export function findLinkedNode(db: Db, courseId: number, notePath: string): OutlineNode | null {
  for (const outline of listOutlines(db, courseId)) {
    const hit = loadNodes(db, outline.id).find((n) => n.linkedNotePath === notePath);
    if (hit) return hit;
  }
  return null;
}

export type ImportOptions = { outlineId: string; parentId: string | null; status?: NodeStatus };

/**
 * Create nodes for `notes` under the parent (appended in order) and keep the links. Notes already imported
 * into this course are skipped (returned in `skipped`) so an import can be run twice safely. References
 * between notes (a case applying a rule, a class note modifying one) become links when the rule exists.
 */
export function importNotes(db: Db, courseId: number, notes: StudyNote[], opts: ImportOptions): { created: OutlineNode[]; skipped: StudyNote[] } {
  const course = getCourse(db, courseId);
  if (!course) return { created: [], skipped: notes };
  const created: OutlineNode[] = [];
  const skipped: StudyNote[] = [];
  let position = loadNodes(db, opts.outlineId).filter((n) => n.parentId === opts.parentId).length;
  // Rules first so cases and class notes can point at them.
  const ordered = [...notes.filter((n) => n.kind === "rule"), ...notes.filter((n) => n.kind !== "rule")];
  for (const note of ordered) {
    if (findLinkedNode(db, courseId, note.path)) {
      skipped.push(note);
      continue;
    }
    const content = noteToNodeContent(note);
    const node = makeNode(opts.outlineId, content.type, opts.status ?? "drafted", {
      ...content,
      parentId: opts.parentId,
      position: position++,
      linkedNotePath: note.path,
      linkedNoteHash: note.hash,
    });
    upsertNodes(db, [node]);
    created.push(node);
  }
  // Note references are relative to the study app's course folder, not to this app's course slug.
  for (const node of created) resolveNoteReferences(db, course.studyCourseSlug ?? course.slug, courseId, node, notes);
  return { created, skipped };
}

/** Links for appliesRule / modifiesRule, and the professor note's "modifies" field. */
function resolveNoteReferences(db: Db, studyCourseSlug: string, courseId: number, node: OutlineNode, notes: StudyNote[]) {
  const note = notes.find((n) => n.path === node.linkedNotePath);
  if (!note) return;
  const ref = note.kind === "case" ? note.data.appliesRule : note.kind === "class" ? note.data.modifiesRule : null;
  if (!ref) return;
  const target = findLinkedNode(db, courseId, normaliseNoteRef(ref, studyCourseSlug));
  if (!target || target.id === node.id) return;
  createLink(db, node.id, target.id, note.kind === "case" ? "applies" : "modifies", `From the study app note`);
  if (note.kind === "class") {
    upsertNodes(db, [{ ...node, fields: { ...node.fields, modifiesRule: target.id }, updatedAt: nowIso() }]);
  }
}

/** Import a whole unit: a heading with the unit's notes beneath it. */
export function importUnit(db: Db, courseId: number, unit: StudyUnit, opts: ImportOptions): { heading: OutlineNode; created: OutlineNode[]; skipped: StudyNote[] } {
  const position = loadNodes(db, opts.outlineId).filter((n) => n.parentId === opts.parentId).length;
  const heading = makeNode(opts.outlineId, "heading", opts.status ?? "skeleton", {
    parentId: opts.parentId,
    position,
    title: unit.title,
    body: unit.emphasis ? `**Emphasis.** ${unit.emphasis}` : "",
    tags: unit.syllabusTopics,
  });
  upsertNodes(db, [heading]);
  const result = importNotes(db, courseId, unit.notes, { ...opts, parentId: heading.id });
  return { heading, ...result };
}

export type LinkedStatus = { node: OutlineNode; outlineName: string; status: "unchanged" | "changed" | "missing" };

/** Every linked node of the course with whether its note changed since the import. */
export function linkedNodeStatuses(db: Db, courseId: number, contentDir: string): LinkedStatus[] {
  const out: LinkedStatus[] = [];
  for (const outline of listOutlines(db, courseId)) {
    for (const node of loadNodes(db, outline.id)) {
      if (!node.linkedNotePath) continue;
      const note = readStudyNote(contentDir, node.linkedNotePath);
      out.push({ node, outlineName: outline.name, status: !note ? "missing" : note.hash === node.linkedNoteHash ? "unchanged" : "changed" });
    }
  }
  return out;
}

/** Re-read the note and overwrite the node's title, fields and body. Status, tags, children and links stay. */
export function refreshLinkedNode(db: Db, nodeId: string, contentDir: string): { ok: true; node: OutlineNode } | { ok: false; error: string } {
  const node = getNode(db, nodeId);
  if (!node || !node.linkedNotePath) return { ok: false, error: "the node is not linked to a study-app note" };
  const note = readStudyNote(contentDir, node.linkedNotePath);
  if (!note) return { ok: false, error: `the note no longer exists: ${node.linkedNotePath}` };
  const content = noteToNodeContent(note);
  const fields = { ...content.fields };
  if (node.type === "professor-note" && typeof node.fields.modifiesRule === "string") fields.modifiesRule = node.fields.modifiesRule;
  const updated: OutlineNode = {
    ...node,
    type: content.type,
    title: content.title,
    fields,
    body: content.body,
    tags: Array.from(new Set([...node.tags, ...content.tags])),
    linkedNoteHash: note.hash,
    updatedAt: nowIso(),
  };
  upsertNodes(db, [updated]);
  return { ok: true, node: updated };
}
