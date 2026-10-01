"use server";

// Server actions for the map editor: autosave the map file and write element definitions back to rule notes.

import { findCourse, findNoteByPath, loadContent } from "@/lib/content/loader";
import { normaliseMap, writeMap, type MapFile } from "@/lib/content/mapfile";
import { readRawNote, writeNote } from "@/lib/content/writer";
import { isSlug } from "@/lib/slug";

export type SaveMapResult = { ok: true; savedAt: string; path: string; problems: string[] } | { ok: false; error: string };

export async function saveMapAction(courseSlug: string, unitSlug: string, map: MapFile): Promise<SaveMapResult> {
  if (!isSlug(courseSlug) || (unitSlug && !isSlug(unitSlug))) return { ok: false, error: "bad course or unit slug" };
  const course = findCourse(loadContent(), courseSlug);
  if (!course) return { ok: false, error: "course not found" };
  if (unitSlug && !course.units.some((u) => u.slug === unitSlug)) return { ok: false, error: "unit not found" };
  const { map: clean, problems } = normaliseMap(map);
  try {
    const path = writeMap(courseSlug, unitSlug || undefined, clean);
    return { ok: true, savedAt: new Date().toISOString(), path, problems };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type SaveElementResult = { ok: true } | { ok: false; error: string };

/** Write a definition for element `index` (1-based) of a rule note. The element text is kept as it is. */
export async function saveElementDefinitionAction(notePath: string, index: number, definition: string): Promise<SaveElementResult> {
  const found = findNoteByPath(loadContent(), notePath);
  if (!found || found.note.frontmatter.type !== "rule") return { ok: false, error: "rule note not found" };
  const [courseSlug, unitSlug] = notePath.split("/");
  const raw = readRawNote(courseSlug, unitSlug, found.note.slug);
  if (!raw) return { ok: false, error: "note file not found" };
  const elements = Array.isArray(raw.data.elements) ? [...(raw.data.elements as unknown[])] : [];
  if (index < 1 || index > elements.length) return { ok: false, error: `element ${index} does not exist` };
  const current = elements[index - 1];
  const text = typeof current === "string" ? current : (current as { text: string }).text;
  const clean = definition.replace(/\r\n?/g, "\n").trim();
  elements[index - 1] = clean ? { text, definition: clean } : text;
  writeNote(courseSlug, unitSlug, found.note.slug, { ...raw.data, elements }, raw.body);
  return { ok: true };
}
