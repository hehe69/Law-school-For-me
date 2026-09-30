// Reads the content/ folder from disk on every call. Nothing is cached, so
// adding or editing a file shows up on the next page load.

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { ContentError, ContentTree, Course, Note, Question, Unit } from "./types";
import { validateCourseJson, validateFrontmatter, validateQuestion, validateUnitJson } from "./validate";

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
    const result = validateFrontmatter(parsed.data);
    if (!result.ok) {
      errors.push({ path: rel(full), message: result.problems.join("; ") });
      continue;
    }
    notes.push({ slug: file.replace(/\.md$/, ""), path: rel(full), frontmatter: result.value, body: parsed.content.trim() });
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
  return { slug: unitSlug, courseSlug, title: meta.title, order: meta.order, syllabusTopics: meta.syllabusTopics, notes, questions, errors };
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
    courses.push({ slug: courseSlug, title: meta.title, order: meta.order, units });
  }

  courses.sort(byOrder);
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

export type Scope = "unit" | "upto" | "course";

export const SCOPE_LABELS: Record<Scope, string> = {
  unit: "This unit",
  upto: "All units up to this one",
  course: "Whole course",
};

export function isScope(v: unknown): v is Scope {
  return v === "unit" || v === "upto" || v === "course";
}

/** The pool of questions a test can draw from, in syllabus order. */
export function questionsForScope(course: Course, unit: Unit, scope: Scope): Question[] {
  const units =
    scope === "unit" ? [unit] : scope === "upto" ? course.units.filter((u) => u.order <= unit.order) : course.units;
  return units.flatMap((u) => u.questions);
}

/** Look up a question by its stored identity; undefined if it has since been removed from content. */
export function findQuestion(tree: ContentTree, courseSlug: string, unitSlug: string, id: string): Question | undefined {
  return findUnit(tree, courseSlug, unitSlug)?.unit.questions.find((q) => q.id === id);
}
