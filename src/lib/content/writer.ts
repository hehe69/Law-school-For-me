// Every write to the content/ folder goes through here. Paths are built only from
// validated slugs, and files are written atomically (temp file + rename).

import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { CONTENT_ROOT } from "./loader";
import { isSlug } from "../slug";

export { isSlug, slugify } from "../slug";

function assertSlug(s: string, label: string) {
  if (!isSlug(s)) throw new Error(`${label} "${s}" is not a valid slug (lowercase letters, digits, hyphens)`);
}

/** Absolute unit folder, or throws if the slugs are bad or the unit does not exist. */
export function unitDir(courseSlug: string, unitSlug: string): string {
  assertSlug(courseSlug, "course");
  assertSlug(unitSlug, "unit");
  const dir = path.join(CONTENT_ROOT, courseSlug, unitSlug);
  if (!fs.existsSync(path.join(dir, "unit.json"))) throw new Error(`unit ${courseSlug}/${unitSlug} does not exist`);
  return dir;
}

function writeAtomic(file: string, data: string | Buffer) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  if (typeof data === "string") fs.writeFileSync(tmp, data, "utf8");
  else fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}

// ---- questions.json

/** Raw parsed questions.json, [] when the file is missing. Throws when it is not a JSON array. */
export function readRawQuestions(courseSlug: string, unitSlug: string): unknown[] {
  const file = path.join(unitDir(courseSlug, unitSlug), "questions.json");
  if (!fs.existsSync(file)) return [];
  const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(parsed)) throw new Error("questions.json is not a JSON array");
  return parsed;
}

export function writeQuestions(courseSlug: string, unitSlug: string, questions: unknown[]): string {
  const file = path.join(unitDir(courseSlug, unitSlug), "questions.json");
  writeAtomic(file, JSON.stringify(questions, null, 2) + "\n");
  return `${courseSlug}/${unitSlug}/questions.json`;
}

// ---- notes

export function noteFile(courseSlug: string, unitSlug: string, noteSlug: string): string {
  assertSlug(noteSlug, "note");
  return path.join(unitDir(courseSlug, unitSlug), "notes", `${noteSlug}.md`);
}

export function noteExists(courseSlug: string, unitSlug: string, noteSlug: string): boolean {
  return fs.existsSync(noteFile(courseSlug, unitSlug, noteSlug));
}

/** Raw frontmatter and body of an existing note, so unknown keys survive an edit. */
export function readRawNote(courseSlug: string, unitSlug: string, noteSlug: string): { data: Record<string, unknown>; body: string } | undefined {
  const file = noteFile(courseSlug, unitSlug, noteSlug);
  if (!fs.existsSync(file)) return undefined;
  const parsed = matter(fs.readFileSync(file, "utf8"));
  return { data: parsed.data as Record<string, unknown>, body: parsed.content };
}

export function writeNote(courseSlug: string, unitSlug: string, noteSlug: string, data: Record<string, unknown>, body: string): string {
  const file = noteFile(courseSlug, unitSlug, noteSlug);
  const text = matter.stringify(body.trim() ? body.trim() + "\n" : "", data);
  writeAtomic(file, text);
  return `${courseSlug}/${unitSlug}/notes/${noteSlug}.md`;
}

// ---- unit.json

/** Merge fields into unit.json, keeping everything else as it is. */
export function updateUnitJson(courseSlug: string, unitSlug: string, patch: Record<string, unknown>): void {
  const file = path.join(unitDir(courseSlug, unitSlug), "unit.json");
  const current = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  writeAtomic(file, JSON.stringify({ ...current, ...patch }, null, 2) + "\n");
}

// ---- readings and images

const SAFE_NAME = /[^a-z0-9._-]+/g;

/** A filesystem-safe file name that keeps the extension: "Week 3 Cases.PDF" -> "week-3-cases.pdf". */
export function safeFileName(original: string): string {
  const base = path.basename(original).toLowerCase();
  const ext = path.extname(base);
  const stem = base.slice(0, base.length - ext.length).replace(SAFE_NAME, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "file";
  return `${stem}${ext}`;
}

/** Write an uploaded file under readings/ or images/. Returns the stored file name (made unique if taken). */
export function saveUnitFile(courseSlug: string, unitSlug: string, folder: "readings" | "images", original: string, data: Buffer): string {
  const dir = path.join(unitDir(courseSlug, unitSlug), folder);
  fs.mkdirSync(dir, { recursive: true });
  let name = safeFileName(original);
  const ext = path.extname(name);
  const stem = name.slice(0, name.length - ext.length);
  for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${stem}-${i}${ext}`;
  writeAtomic(path.join(dir, name), data);
  return name;
}

/** Absolute path of a served file, or null if the request escapes the unit's readings/ or images/ folder. */
export function servedFilePath(courseSlug: string, unitSlug: string, folder: string, file: string): string | null {
  if (!isSlug(courseSlug) || !isSlug(unitSlug)) return null;
  if (folder !== "readings" && folder !== "images") return null;
  if (!file || file !== path.basename(file) || file.startsWith(".")) return null;
  const full = path.join(CONTENT_ROOT, courseSlug, unitSlug, folder, file);
  return fs.existsSync(full) && fs.statSync(full).isFile() ? full : null;
}

// ---- question management (edits write back to questions.json, keeping unknown keys)

/** Replace, patch, or remove one raw question by id. `update` returns the new raw entry or null to delete. */
export function updateRawQuestion(courseSlug: string, unitSlug: string, id: string, update: (raw: Record<string, unknown>) => Record<string, unknown> | null): string {
  const all = readRawQuestions(courseSlug, unitSlug);
  const index = all.findIndex((q) => typeof q === "object" && q !== null && (q as { id?: unknown }).id === id);
  if (index === -1) throw new Error(`question "${id}" not found in questions.json`);
  const next = update(all[index] as Record<string, unknown>);
  if (next === null) all.splice(index, 1);
  else all[index] = next;
  return writeQuestions(courseSlug, unitSlug, all);
}

/** Merge fields into course.json, keeping everything else as it is. */
export function updateCourseJson(courseSlug: string, patch: Record<string, unknown>): void {
  if (!isSlug(courseSlug)) throw new Error("bad course slug");
  const file = path.join(CONTENT_ROOT, courseSlug, "course.json");
  const current = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  const merged = { ...current, ...patch };
  for (const [k, v] of Object.entries(patch)) if (v === undefined) delete merged[k];
  writeAtomic(file, JSON.stringify(merged, null, 2) + "\n");
}

// ---- courses and units

function assertSlugOnly(s: string, label: string) {
  if (!isSlug(s)) throw new Error(`${label} "${s}" is not a valid slug (lowercase letters, digits, hyphens)`);
}

export function courseExists(courseSlug: string): boolean {
  assertSlugOnly(courseSlug, "course");
  return fs.existsSync(path.join(CONTENT_ROOT, courseSlug));
}

/** Create content/<course>/course.json. Refuses if the folder already exists. */
export function createCourse(courseSlug: string, meta: { title: string; order: number }): string {
  assertSlugOnly(courseSlug, "course");
  const dir = path.join(CONTENT_ROOT, courseSlug);
  if (fs.existsSync(dir)) throw new Error(`a folder named "${courseSlug}" already exists under content/`);
  fs.mkdirSync(dir, { recursive: true });
  writeAtomic(path.join(dir, "course.json"), JSON.stringify(meta, null, 2) + "\n");
  return `${courseSlug}/course.json`;
}

export function unitFolderExists(courseSlug: string, unitSlug: string): boolean {
  assertSlugOnly(courseSlug, "course");
  assertSlugOnly(unitSlug, "unit");
  return fs.existsSync(path.join(CONTENT_ROOT, courseSlug, unitSlug));
}

/** Create content/<course>/<unit>/unit.json and an empty notes/ folder. Refuses if the folder exists. */
export function createUnit(
  courseSlug: string,
  unitSlug: string,
  meta: { title: string; order: number; syllabusTopics: string[] },
): string {
  assertSlugOnly(courseSlug, "course");
  assertSlugOnly(unitSlug, "unit");
  const courseDir = path.join(CONTENT_ROOT, courseSlug);
  if (!fs.existsSync(path.join(courseDir, "course.json"))) throw new Error(`course "${courseSlug}" does not exist`);
  const dir = path.join(courseDir, unitSlug);
  if (fs.existsSync(dir)) throw new Error(`a folder named "${unitSlug}" already exists in this course`);
  fs.mkdirSync(path.join(dir, "notes"), { recursive: true });
  writeAtomic(path.join(dir, "unit.json"), JSON.stringify(meta, null, 2) + "\n");
  return `${courseSlug}/${unitSlug}/unit.json`;
}
