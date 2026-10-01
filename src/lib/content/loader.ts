// Reads the content/ folder from disk on every call. Nothing is cached, so
// adding or editing a file shows up on the next page load.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ContentError, ContentTree, Course, Note, Question, Reading, Unit } from "./types";

export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);

function listFiles(dir: string, keep: (name: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith(".") && keep(d.name))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
}

function loadReadings(unitDir: string): Reading[] {
  const dir = path.join(unitDir, "readings");
  return listFiles(dir, (n) => n.toLowerCase().endsWith(".pdf")).map((file) => ({ file, bytes: fs.statSync(path.join(dir, file)).size }));
}

function loadImages(unitDir: string): string[] {
  return listFiles(path.join(unitDir, "images"), (n) => IMAGE_EXTENSIONS.has(path.extname(n).toLowerCase()));
}
import { normaliseRuleNoteRef, parseFrontmatter, validateCourseJson, validateQuestion, validateTopics, validateUnitJson } from "./validate";

export const CONTENT_ROOT = path.join(process.cwd(), "content");

function rel(p: string) {
  return path.relative(CONTENT_ROOT, p).split(path.sep).join("/");
}

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort();
}

function readJson(file: string, errors: ContentError[]): unknown | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    errors.push({ path: rel(file), message: `invalid JSON: ${(e as Error).message}` });
    return undefined;
  }
}

function loadNotes(unitDir: string, errors: ContentError[]): Note[] {
  const notesDir = path.join(unitDir, "notes");
  if (!fs.existsSync(notesDir)) return [];
  const notes: Note[] = [];
  const files = fs.readdirSync(notesDir).filter((f) => f.endsWith(".md")).sort();
  for (const file of files) {
    const full = path.join(notesDir, file);
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(fs.readFileSync(full, "utf8"));
    } catch (e) {
      errors.push({ path: rel(full), message: `could not parse frontmatter: ${(e as Error).message}` });
      continue;
    }
    const result = parseFrontmatter(parsed.data);
    if (!result.ok) {
      errors.push({ path: rel(full), message: result.problems.join("; ") });
      continue;
    }
    const topics = validateTopics(parsed.data);
    if (!topics.ok) {
      errors.push({ path: rel(full), message: topics.problems.join("; ") });
      continue;
    }
    notes.push({
      slug: file.replace(/\.md$/, ""),
      path: rel(full),
      frontmatter: result.value,
      status: result.missing.length ? "draft" : "complete",
      missingFields: result.missing,
      topics: topics.value,
      body: parsed.content.trim(),
    });
  }
  return notes;
}

function loadQuestions(unitDir: string, courseSlug: string, unitSlug: string, errors: ContentError[]): Question[] {
  const file = path.join(unitDir, "questions.json");
  if (!fs.existsSync(file)) return [];
  const raw = readJson(file, errors);
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    errors.push({ path: rel(file), message: "questions.json must be a JSON array" });
    return [];
  }
  const questions: Question[] = [];
  const seen = new Set<string>();
  raw.forEach((item, i) => {
    const result = validateQuestion(item, courseSlug, unitSlug);
    if (!result.ok) {
      errors.push({ path: rel(file), message: `question at index ${i}: ${result.problems.join("; ")}` });
      return;
    }
    if (seen.has(result.value.id)) {
      errors.push({ path: rel(file), message: `duplicate question id "${result.value.id}" at index ${i}` });
      return;
    }
    seen.add(result.value.id);
    questions.push(result.value);
  });
  return questions;
}

function loadUnit(courseSlug: string, courseDir: string, unitSlug: string, courseErrors: ContentError[]): Unit | null {
  const unitDir = path.join(courseDir, unitSlug);
  const unitJsonPath = path.join(unitDir, "unit.json");
  if (!fs.existsSync(unitJsonPath)) {
    courseErrors.push({ path: rel(unitDir), message: "folder has no unit.json, skipped" });
    return null;
  }
  const raw = readJson(unitJsonPath, courseErrors);
  if (raw === undefined) return null;
  const meta = validateUnitJson(raw);
  if (!meta.ok) {
    courseErrors.push({ path: rel(unitJsonPath), message: meta.problems.join("; ") });
    return null;
  }
  const errors: ContentError[] = [];
  const notes = loadNotes(unitDir, errors);
  const questions = loadQuestions(unitDir, courseSlug, unitSlug, errors);
  const images = loadImages(unitDir);
  for (const q of questions) {
    if (q.image && !images.includes(q.image.slice("images/".length))) {
      errors.push({ path: `${courseSlug}/${unitSlug}/questions.json`, message: `question "${q.id}": image "${q.image}" is not in the unit's images folder (the question still loads)` });
    }
  }
  return {
    slug: unitSlug,
    courseSlug,
    title: meta.title,
    order: meta.order,
    syllabusTopics: meta.syllabusTopics,
    emphasis: meta.emphasis,
    notes,
    questions,
    readings: loadReadings(unitDir),
    images,
    errors,
  };
}

function byOrder<T extends { order: number; title: string }>(a: T, b: T) {
  return a.order - b.order || a.title.localeCompare(b.title);
}

export function loadContent(): ContentTree {
  const errors: ContentError[] = [];
  const courses: Course[] = [];

  if (!fs.existsSync(CONTENT_ROOT)) {
    errors.push({ path: "content/", message: "content folder does not exist" });
    return { courses, errors };
  }

  for (const courseSlug of listDirs(CONTENT_ROOT)) {
    const courseDir = path.join(CONTENT_ROOT, courseSlug);
    const courseJsonPath = path.join(courseDir, "course.json");
    if (!fs.existsSync(courseJsonPath)) {
      errors.push({ path: courseSlug, message: "folder has no course.json, skipped" });
      continue;
    }
    const raw = readJson(courseJsonPath, errors);
    if (raw === undefined) continue;
    const meta = validateCourseJson(raw);
    if (!meta.ok) {
      errors.push({ path: rel(courseJsonPath), message: meta.problems.join("; ") });
      continue;
    }
    const units: Unit[] = [];
    for (const unitSlug of listDirs(courseDir)) {
      const unit = loadUnit(courseSlug, courseDir, unitSlug, errors);
      if (unit) {
        units.push(unit);
        errors.push(...unit.errors);
      }
    }
    units.sort(byOrder);
    courses.push({ slug: courseSlug, title: meta.title, order: meta.order, examDate: meta.examDate, units });
  }

  courses.sort(byOrder);

  // Issue questions must point at rule notes that exist in their course.
  for (const course of courses) {
    for (const unit of course.units) {
      unit.questions = unit.questions.filter((q) => {
        if (q.type !== "issue") return true;
        const bad = q.issues.filter((it) => !findRuleNote(course, it.ruleNotePath));
        if (bad.length === 0) return true;
        const msg = `issue question "${q.id}": ${bad.map((it) => `ruleNote "${it.ruleNote}" is not a rule note in this course`).join("; ")}`;
        unit.errors.push({ path: `${course.slug}/${unit.slug}/questions.json`, message: msg });
        errors.push({ path: `${course.slug}/${unit.slug}/questions.json`, message: msg });
        return false;
      });
    }
  }

  // Question ids must be unique across a course because a course-wide test pools them.
  for (const course of courses) {
    const seen = new Map<string, string>();
    for (const unit of course.units) {
      for (const q of unit.questions) {
        const prev = seen.get(q.id);
        if (prev && prev !== unit.slug) {
          errors.push({ path: `${course.slug}/${unit.slug}/questions.json`, message: `question id "${q.id}" is also used in unit "${prev}"` });
        } else {
          seen.set(q.id, unit.slug);
        }
      }
    }
  }
  return { courses, errors };
}

export function findCourse(tree: ContentTree, courseSlug: string): Course | undefined {
  return tree.courses.find((c) => c.slug === courseSlug);
}

export function findUnit(tree: ContentTree, courseSlug: string, unitSlug: string): { course: Course; unit: Unit } | undefined {
  const course = findCourse(tree, courseSlug);
  const unit = course?.units.find((u) => u.slug === unitSlug);
  return course && unit ? { course, unit } : undefined;
}

export const DEFAULT_SECONDS_PER_QUESTION = 90;

/** Scopes chosen on the test setup page; the pool is a set of units. */
export type PoolScope = "unit" | "upto" | "course";
/** Every scope an attempt can have. "tags" and "retry" tests are built from question ids, not units. */
export type Scope = PoolScope | "tags" | "retry" | "diagnostic";

export const SCOPE_LABELS: Record<Scope, string> = {
  unit: "This unit",
  upto: "All units up to this one",
  course: "Whole course",
  tags: "Weakest tags",
  retry: "Retry missed",
  diagnostic: "Diagnostic",
};

export function isPoolScope(v: unknown): v is PoolScope {
  return v === "unit" || v === "upto" || v === "course";
}

export function isScope(v: unknown): v is Scope {
  return isPoolScope(v) || v === "tags" || v === "retry" || v === "diagnostic";
}

/** Questions that can appear in tests: everything not marked disabled. */
export function activeQuestions(unit: Unit): Question[] {
  return unit.questions.filter((q) => !q.disabled);
}

/** The pool of questions a test can draw from, in syllabus order. Disabled questions are left out. */
export function questionsForScope(course: Course, unit: Unit, scope: PoolScope): Question[] {
  const units =
    scope === "unit" ? [unit] : scope === "upto" ? course.units.filter((u) => u.order <= unit.order) : course.units;
  return units.flatMap(activeQuestions);
}

/** URL at which a file under a unit's readings/ or images/ folder is served. */
export function fileUrl(courseSlug: string, unitSlug: string, relPath: string): string {
  return `/files/${courseSlug}/${unitSlug}/${relPath.split("/").map(encodeURIComponent).join("/")}`;
}

/** A rule note in this course by content-relative path (drafts included), or undefined. */
export function findRuleNote(course: Course, notePath: string): { unit: Unit; note: Note } | undefined {
  for (const unit of course.units) {
    const note = unit.notes.find((n) => n.path === notePath && n.frontmatter.type === "rule");
    if (note) return { unit, note };
  }
  return undefined;
}

/** Resolve a rule reference as written in a note ("unit/notes/file.md") to the rule note, if any. */
export function resolveRuleRef(course: Course, ref: string | undefined | null): { unit: Unit; note: Note } | undefined {
  if (!ref || !ref.trim()) return undefined;
  return findRuleNote(course, normaliseRuleNoteRef(ref, course.slug));
}

/** Course-relative reference for a note, the form stored in appliesRule, modifiesRule, relatedRules, ruleNote. */
export function noteRef(unit: Unit, note: Note): string {
  return `${unit.slug}/notes/${note.slug}.md`;
}

/** Every rule note in a course with its reference and label, for pickers. */
export function ruleNoteOptions(course: Course): { ref: string; label: string; path: string }[] {
  return course.units.flatMap((u) =>
    u.notes
      .filter((n) => n.frontmatter.type === "rule")
      .map((n) => ({
        ref: noteRef(u, n),
        path: n.path,
        label: `${u.title}: ${(n.frontmatter.type === "rule" && n.frontmatter.name) || n.slug}${n.status === "draft" ? " (draft)" : ""}`,
      })),
  );
}

/** Look up a note by its content-relative path (the flashcard key). */
export function findNoteByPath(tree: ContentTree, notePath: string): { course: Course; unit: Unit; note: Note } | undefined {
  for (const course of tree.courses) {
    for (const unit of course.units) {
      const note = unit.notes.find((n) => n.path === notePath);
      if (note) return { course, unit, note };
    }
  }
  return undefined;
}

/** Every test-eligible question in a course, in syllabus order. */
export function courseQuestions(course: Course): Question[] {
  return course.units.flatMap(activeQuestions);
}

/** Look up a question by its stored identity; undefined if it has since been removed from content. */
export function findQuestion(tree: ContentTree, courseSlug: string, unitSlug: string, id: string): Question | undefined {
  return findUnit(tree, courseSlug, unitSlug)?.unit.questions.find((q) => q.id === id);
}

/** Resolved links for a note card: hrefs for refs that resolve, plain text otherwise. */
export function noteLinks(course: Course, note: Note): { appliesRule?: { href: string; label: string } | { text: string }; modifiesRule?: { href: string; label: string } | { text: string }; relatedRules?: ({ href: string; label: string } | { text: string })[] } {
  const toLink = (ref: string) => {
    const r = resolveRuleRef(course, ref);
    if (!r) return { text: ref };
    const name = (r.note.frontmatter.type === "rule" && r.note.frontmatter.name) || r.note.slug;
    return { href: `/courses/${course.slug}/units/${r.unit.slug}#note-${r.note.slug}`, label: name };
  };
  const fm = note.frontmatter;
  if (fm.type === "case") return fm.appliesRule ? { appliesRule: toLink(fm.appliesRule) } : {};
  if (fm.type === "class") return fm.modifiesRule ? { modifiesRule: toLink(fm.modifiesRule) } : {};
  return fm.relatedRules.length ? { relatedRules: fm.relatedRules.map(toLink) } : {};
}
