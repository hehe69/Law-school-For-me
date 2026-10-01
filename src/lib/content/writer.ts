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

function writeAtomic(file: string, text: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text, "utf8");
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
