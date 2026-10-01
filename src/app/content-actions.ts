"use server";

// Server actions that write to the content/ folder: question import, note save, unit emphasis.
// Each one re-reads content from disk, validates, writes, and redirects or returns errors.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { findUnit, loadContent } from "@/lib/content/loader";
import { checkImportBatch, type ImportError, type ImportMode } from "@/lib/content/importer";
import { validateQuestion, NOTE_FIELDS } from "@/lib/content/validate";
import {
  courseExists, createCourse, createUnit, isSlug, noteExists, readRawNote, readRawQuestions, saveUnitFile, slugify,
  unitFolderExists, updateCourseJson, updateRawQuestion, updateUnitJson, writeNote, writeQuestions,
} from "@/lib/content/writer";
import { findCourse, findRuleNote, ruleNoteOptions } from "@/lib/content/loader";
import { normaliseRuleNoteRef } from "@/lib/content/validate";
import { buildOutline, OUTLINE_DIR, outlineMarkdown } from "@/lib/outline";
import { toDateString } from "@/lib/sm2";
import { writeSettings } from "@/lib/settings";
import fs from "node:fs";
import path from "node:path";
import type { NoteType } from "@/lib/content/types";
import { addCapture, getCapture, markDiscarded, markFiled } from "@/lib/captures";
import { runBackup } from "@/lib/backup";

/** Browsers submit textarea content with CRLF line endings; files on disk should use LF. */
function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").replace(/\r\n?/g, "\n");
}

// ---------- Question importer

export type ImportState = {
  json: string;
  mode: ImportMode;
  errors: ImportError[];
  success?: { written: number; total: number; path: string };
};

export async function importQuestionsAction(prev: ImportState, formData: FormData): Promise<ImportState> {
  const courseSlug = String(formData.get("course") ?? "");
  const unitSlug = String(formData.get("unit") ?? "");
  const json = text(formData, "json");
  const mode: ImportMode = formData.get("mode") === "replace" ? "replace" : "append";
  const fail = (errors: ImportError[]): ImportState => ({ json, mode, errors });

  if (!isSlug(courseSlug) || !isSlug(unitSlug)) return fail([{ index: null, message: "bad course or unit slug" }]);
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) return fail([{ index: null, message: "unit not found" }]);
  const { course, unit } = found;

  if (json.trim() === "") return fail([{ index: null, message: "paste a JSON array first" }]);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return fail([{ index: null, message: `not valid JSON: ${(e as Error).message}` }]);
  }

  const checked = checkImportBatch(parsed, course, unit, mode);
  if (!checked.ok) return fail(checked.errors);

  let combined: unknown[];
  if (mode === "append") {
    let existing: unknown[];
    try {
      existing = readRawQuestions(courseSlug, unitSlug);
    } catch (e) {
      return fail([{ index: null, message: `the unit's current questions.json cannot be read (${(e as Error).message}); fix it by hand or choose Replace` }]);
    }
    // Refuse to append onto a file that already has invalid entries: the result would fail validation too.
    const bad = existing.map((q, i) => (validateQuestion(q, courseSlug, unitSlug).ok ? null : i)).filter((i): i is number => i !== null);
    if (bad.length) {
      return fail([{ index: null, message: `the unit's current questions.json has invalid entries at index ${bad.join(", ")} (see the unit page); fix them first or choose Replace` }]);
    }
    combined = [...existing, ...checked.questions];
  } else {
    combined = checked.questions;
  }

  // Final gate: the file we are about to write must load cleanly.
  const final = combined.map((q, i) => ({ i, r: validateQuestion(q, courseSlug, unitSlug) })).filter((x) => !x.r.ok);
  if (final.length) return fail(final.map((x) => ({ index: x.i, message: "would not validate after merge; nothing was written" })));

  const path = writeQuestions(courseSlug, unitSlug, combined);
  return { json: "", mode, errors: [], success: { written: checked.questions.length, total: combined.length, path } };
}

// ---------- Note form

export type NoteFormState = { error: string | null; savedAs?: string };

const LIST_FIELDS = new Set(["elements", "exceptions"]);

function linesToList(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

export async function saveNoteAction(prev: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const courseSlug = String(formData.get("course") ?? "");
  const unitSlug = String(formData.get("unit") ?? "");
  const existingSlug = String(formData.get("existingSlug") ?? "");
  const type = String(formData.get("type") ?? "") as NoteType;
  if (!isSlug(courseSlug) || !isSlug(unitSlug)) return { error: "bad course or unit slug" };
  if (!(type in NOTE_FIELDS)) return { error: "pick a note type" };
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) return { error: "unit not found" };

  // Build the frontmatter from the fields this type defines. Empty fields are written as "" so the
  // file shows its shape; the loader then marks the note as a draft until they are filled in.
  const data: Record<string, unknown> = { type };
  for (const key of NOTE_FIELDS[type]) {
    const raw = text(formData, key);
    data[key] = LIST_FIELDS.has(key) ? linesToList(raw) : raw.trim();
  }
  // Links between notes (all optional; see README "Linking notes").
  const ruleRefs = new Set(ruleNoteOptions(found.course).map((r) => r.ref));
  if (type === "case") {
    const applies = String(formData.get("appliesRule") ?? "").trim();
    if (applies && !ruleRefs.has(applies)) return { error: `appliesRule "${applies}" is not a rule note in this course` };
    if (applies) data.appliesRule = applies;
  }
  if (type === "class") {
    const pick = String(formData.get("modifiesRuleSelect") ?? "");
    if (pick && pick !== "__text__") {
      if (!ruleRefs.has(pick)) return { error: `modifiesRule "${pick}" is not a rule note in this course` };
      data.modifiesRule = pick;
    }
  }
  if (type === "rule") {
    // Exceptions typed as "@2 text" defeat element 2; stored as { text, element } so plain strings keep working.
    const lines = data.exceptions as string[];
    data.exceptions = lines.map((line) => {
      const m = /^@(\d+)\s+(.*)$/.exec(line);
      return m ? { text: m[2].trim(), element: Number(m[1]) } : line;
    });
    const we = Number(formData.get("wisconsinElement"));
    if (Number.isInteger(we) && we >= 1) data.wisconsinElement = we;
    else delete data.wisconsinElement;
    const related = formData.getAll("relatedRules").map((r) => String(r).trim()).filter(Boolean);
    for (const r of related) if (!ruleRefs.has(r)) return { error: `relatedRules "${r}" is not a rule note in this course` };
    if (related.length) data.relatedRules = related;
    else delete data.relatedRules;
  }
  const topics = formData.getAll("topics").map((t) => String(t).trim()).filter(Boolean);
  const syllabus = new Set(found.unit.syllabusTopics);
  if (topics.some((t) => !syllabus.has(t))) return { error: "topics must come from the unit's syllabus topics" };
  data.topics = topics;
  const body = text(formData, "body");

  if (type === "class" && data.date && !/^\d{4}-\d{2}-\d{2}$/.test(String(data.date))) {
    return { error: "date must be YYYY-MM-DD" };
  }

  let slug: string;
  if (existingSlug) {
    if (!isSlug(existingSlug) || !noteExists(courseSlug, unitSlug, existingSlug)) return { error: `note "${existingSlug}" not found` };
    slug = existingSlug;
    // Keep any keys the user wrote by hand that the form does not know about.
    const raw = readRawNote(courseSlug, unitSlug, slug);
    if (raw) {
      const formOwned = new Set(["appliesRule", "relatedRules", "wisconsinElement"]);
      for (const [k, v] of Object.entries(raw.data)) if (!(k in data) && !formOwned.has(k)) data[k] = v;
    }
  } else {
    const nameSource = type === "class" ? `${data.date ?? ""} ${data.topic ?? ""}` : String(data.name ?? "");
    slug = slugify(nameSource);
    if (!slug) return { error: type === "class" ? "enter a date or topic so the filename can be derived" : "enter a name so the filename can be derived" };
    if (noteExists(courseSlug, unitSlug, slug)) return { error: `a note file named "${slug}.md" already exists in this unit; open it with Edit instead` };
  }

  const written = writeNote(courseSlug, unitSlug, slug, data, body);

  // Filing a quick capture: mark it so it leaves the inbox.
  const captureId = Number(formData.get("captureId"));
  if (Number.isInteger(captureId) && captureId > 0 && getCapture(captureId)) {
    markFiled(captureId, written);
    revalidatePath("/", "layout"); // header inbox count
  }

  redirect(`/courses/${courseSlug}/units/${unitSlug}#note-${slug}`);
}

// ---------- Professor emphasis

export async function saveEmphasisAction(formData: FormData): Promise<void> {
  const courseSlug = String(formData.get("course") ?? "");
  const unitSlug = String(formData.get("unit") ?? "");
  if (!isSlug(courseSlug) || !isSlug(unitSlug)) throw new Error("bad course or unit slug");
  const emphasis = text(formData, "emphasis").trim();
  updateUnitJson(courseSlug, unitSlug, { emphasis });
  redirect(`/courses/${courseSlug}/units/${unitSlug}`);
}

// ---------- Courses and units

export type MetaFormState = { error: string | null };

function parseOrder(formData: FormData): number | null {
  const n = Number(formData.get("order"));
  return Number.isFinite(n) ? n : null;
}

export async function createCourseAction(prev: MetaFormState, formData: FormData): Promise<MetaFormState> {
  const title = text(formData, "title").trim();
  const order = parseOrder(formData);
  if (!title) return { error: "enter a title" };
  if (order === null) return { error: "order must be a number" };
  const slug = slugify(title);
  if (!slug) return { error: "the title must contain at least one letter or digit so a folder name can be derived" };
  try {
    if (courseExists(slug)) return { error: `a course folder named "${slug}" already exists` };
    createCourse(slug, { title, order });
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/courses/${slug}`);
}

function parseTopics(formData: FormData): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of formData.getAll("syllabusTopics")) {
    const v = String(t).replace(/\r\n?/g, "\n").trim();
    if (v && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export async function createUnitAction(prev: MetaFormState, formData: FormData): Promise<MetaFormState> {
  const courseSlug = String(formData.get("course") ?? "");
  const title = text(formData, "title").trim();
  const order = parseOrder(formData);
  if (!isSlug(courseSlug)) return { error: "bad course slug" };
  if (!title) return { error: "enter a title" };
  if (order === null) return { error: "order must be a number" };
  const slug = slugify(title);
  if (!slug) return { error: "the title must contain at least one letter or digit so a folder name can be derived" };
  try {
    if (unitFolderExists(courseSlug, slug)) return { error: `a unit folder named "${slug}" already exists in this course` };
    createUnit(courseSlug, slug, { title, order, syllabusTopics: parseTopics(formData) });
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/courses/${courseSlug}/units/${slug}`);
}

/** Edit title, order, and syllabus topics in unit.json. The folder name and every other key stay as they are. */
export async function updateUnitAction(prev: MetaFormState, formData: FormData): Promise<MetaFormState> {
  const courseSlug = String(formData.get("course") ?? "");
  const unitSlug = String(formData.get("unit") ?? "");
  const title = text(formData, "title").trim();
  const order = parseOrder(formData);
  if (!isSlug(courseSlug) || !isSlug(unitSlug)) return { error: "bad course or unit slug" };
  if (!title) return { error: "enter a title" };
  if (order === null) return { error: "order must be a number" };
  try {
    updateUnitJson(courseSlug, unitSlug, { title, order, syllabusTopics: parseTopics(formData) });
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/courses/${courseSlug}/units/${unitSlug}`);
}

// ---------- Backup

export async function backupAction(): Promise<void> {
  let target = "";
  try {
    const written = await runBackup();
    target = `/?backup=ok&file=${encodeURIComponent(written)}`;
  } catch (e) {
    target = `/?backup=error&message=${encodeURIComponent((e as Error).message)}`;
  }
  redirect(target);
}

// ---------- Quick capture

export type CaptureState = { saved: boolean; error: string | null };

export async function captureAction(prev: CaptureState, formData: FormData): Promise<CaptureState> {
  const body = text(formData, "text").trim();
  if (!body) return { saved: false, error: "nothing to save" };
  addCapture(body);
  revalidatePath("/", "layout"); // refresh the header's inbox count without leaving the page
  return { saved: true, error: null };
}

export async function discardCaptureAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (Number.isInteger(id) && id > 0) markDiscarded(id);
  revalidatePath("/", "layout"); // header inbox count
  redirect("/inbox");
}

// ---------- Readings and images

const MAX_UPLOAD = 100 * 1024 * 1024;

export async function uploadReadingsAction(formData: FormData): Promise<void> {
  const courseSlug = String(formData.get("course") ?? "");
  const unitSlug = String(formData.get("unit") ?? "");
  if (!isSlug(courseSlug) || !isSlug(unitSlug)) throw new Error("bad course or unit slug");
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const saved: string[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    if (!f.name.toLowerCase().endsWith(".pdf") || f.size > MAX_UPLOAD) {
      skipped.push(f.name);
      continue;
    }
    saved.push(saveUnitFile(courseSlug, unitSlug, "readings", f.name, Buffer.from(await f.arrayBuffer())));
  }
  const q = new URLSearchParams();
  if (saved.length) q.set("uploaded", saved.join(","));
  if (skipped.length) q.set("skipped", skipped.join(","));
  redirect(`/courses/${courseSlug}/units/${unitSlug}?${q}#readings`);
}

export type UploadImageResult = { ok: true; name: string; markdown: string } | { ok: false; error: string };

/** Called directly from the note form: stores the image under images/ and returns the markdown to insert. */
export async function uploadImageAction(formData: FormData): Promise<UploadImageResult> {
  const courseSlug = String(formData.get("course") ?? "");
  const unitSlug = String(formData.get("unit") ?? "");
  const file = formData.get("file");
  if (!isSlug(courseSlug) || !isSlug(unitSlug)) return { ok: false, error: "bad course or unit slug" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "choose an image file" };
  const ext = path.extname(file.name).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"].includes(ext)) return { ok: false, error: "only png, jpg, gif, webp, or svg" };
  if (file.size > MAX_UPLOAD) return { ok: false, error: "file is too large" };
  try {
    const name = saveUnitFile(courseSlug, unitSlug, "images", file.name, Buffer.from(await file.arrayBuffer()));
    const alt = name.replace(/\.[^.]+$/, "").replace(/-/g, " ");
    return { ok: true, name, markdown: `![${alt}](images/${name})` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------- Question management

export type QuestionFormState = { error: string | null };

function splitTags(v: string): string[] {
  return v.split(",").map((t) => t.trim()).filter(Boolean);
}

/** Save edits to one question. The form posts the same fields as the JSON schema; unknown keys in the file are kept. */
export async function saveQuestionAction(prev: QuestionFormState, formData: FormData): Promise<QuestionFormState> {
  const courseSlug = String(formData.get("course") ?? "");
  const unitSlug = String(formData.get("unit") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!isSlug(courseSlug) || !isSlug(unitSlug) || !id) return { error: "bad course, unit, or id" };
  const tree = loadContent();
  const course = findCourse(tree, courseSlug);
  const unit = course?.units.find((u) => u.slug === unitSlug);
  if (!course || !unit) return { error: "unit not found" };

  const type = formData.get("type") === "issue" ? "issue" : "mc";
  const patch: Record<string, unknown> = { id, type, tags: splitTags(text(formData, "tags")) };
  const image = text(formData, "image").trim();
  patch.image = image || undefined;
  if (type === "mc") {
    patch.stem = text(formData, "stem").trim();
    patch.choices = [0, 1, 2, 3, 4].map((i) => text(formData, `choice-${i}`).trim());
    patch.answer = Number(formData.get("answer"));
    patch.explanation = text(formData, "explanation").trim();
  } else {
    patch.factPattern = text(formData, "factPattern").trim();
    patch.minutes = Number(formData.get("minutes"));
    const count = Number(formData.get("issueCount")) || 0;
    patch.issues = Array.from({ length: count }, (_, i) => ({
      name: text(formData, `issue-${i}-name`).trim(),
      ruleNote: text(formData, `issue-${i}-ruleNote`).trim(),
      modelAnalysis: text(formData, `issue-${i}-modelAnalysis`).trim(),
    })).filter((it) => it.name || it.ruleNote || it.modelAnalysis);
  }

  // Validate exactly as the loader would, plus rule-note and image existence.
  const merged = { ...(readRawQuestions(courseSlug, unitSlug).find((q) => (q as { id?: unknown })?.id === id) as Record<string, unknown> | undefined), ...patch };
  for (const k of ["stem", "choices", "answer", "explanation", "factPattern", "minutes", "issues"]) if (!(k in patch)) delete merged[k];
  if (merged.image === undefined) delete merged.image;
  const checked = validateQuestion(merged, courseSlug, unitSlug);
  if (!checked.ok) return { error: checked.problems.join("; ") };
  if (checked.value.type === "mc" && checked.value.choices.length !== 5) return { error: "exactly 5 choices are required" };
  if (checked.value.type === "issue") {
    for (const it of checked.value.issues) {
      if (!findRuleNote(course, normaliseRuleNoteRef(it.ruleNote, courseSlug))) return { error: `ruleNote "${it.ruleNote}" is not a rule note in this course` };
    }
  }
  if (checked.value.image && !unit.images.includes(checked.value.image.slice("images/".length))) return { error: `image "${checked.value.image}" is not in this unit's images folder` };

  try {
    updateRawQuestion(courseSlug, unitSlug, id, () => merged);
  } catch (e) {
    return { error: (e as Error).message };
  }
  redirect(`/courses/${courseSlug}/units/${unitSlug}#question-${encodeURIComponent(id)}`);
}

export async function deleteQuestionAction(formData: FormData): Promise<void> {
  const courseSlug = String(formData.get("course") ?? "");
  const unitSlug = String(formData.get("unit") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!isSlug(courseSlug) || !isSlug(unitSlug) || !id) throw new Error("bad course, unit, or id");
  updateRawQuestion(courseSlug, unitSlug, id, () => null);
  revalidatePath(`/courses/${courseSlug}/units/${unitSlug}`); // same page: a hash-only redirect would not refetch
  redirect(`/courses/${courseSlug}/units/${unitSlug}#questions`);
}

export async function toggleQuestionAction(formData: FormData): Promise<void> {
  const courseSlug = String(formData.get("course") ?? "");
  const unitSlug = String(formData.get("unit") ?? "");
  const id = String(formData.get("id") ?? "");
  const disabled = formData.get("disabled") === "true";
  if (!isSlug(courseSlug) || !isSlug(unitSlug) || !id) throw new Error("bad course, unit, or id");
  updateRawQuestion(courseSlug, unitSlug, id, (raw) => {
    const next = { ...raw };
    if (disabled) next.disabled = true;
    else delete next.disabled;
    return next;
  });
  revalidatePath(`/courses/${courseSlug}/units/${unitSlug}`); // same page: a hash-only redirect would not refetch
  redirect(`/courses/${courseSlug}/units/${unitSlug}#question-${encodeURIComponent(id)}`);
}

// ---------- Course outline export


export async function exportOutlineAction(formData: FormData): Promise<void> {
  const courseSlug = String(formData.get("course") ?? "");
  if (!isSlug(courseSlug)) throw new Error("bad course slug");
  const course = findCourse(loadContent(), courseSlug);
  if (!course) throw new Error("course not found");
  const today = toDateString(new Date());
  const md = outlineMarkdown(course, buildOutline(course), today);
  fs.mkdirSync(OUTLINE_DIR, { recursive: true });
  const target = path.join(OUTLINE_DIR, `${courseSlug}-${today}.md`);
  fs.writeFileSync(target, md, "utf8");
  redirect(`/courses/${courseSlug}/outline?exported=${encodeURIComponent(target)}`);
}

// ---------- Exam date

export async function setExamDateAction(formData: FormData): Promise<void> {
  const courseSlug = String(formData.get("course") ?? "");
  if (!isSlug(courseSlug)) throw new Error("bad course slug");
  const raw = String(formData.get("examDate") ?? "").trim();
  if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error("exam date must be YYYY-MM-DD");
  updateCourseJson(courseSlug, { examDate: raw || undefined });
  redirect(`/courses/${courseSlug}`);
}

// ---------- Settings

export async function setNetworkAccessAction(formData: FormData): Promise<void> {
  writeSettings({ networkAccess: formData.get("networkAccess") === "on" });
  redirect("/?settings=saved");
}
