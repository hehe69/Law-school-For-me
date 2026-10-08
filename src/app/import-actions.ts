"use server";

// Study-app import, linked-node refresh, and .docx / .md import into a new outline.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getCourse, getOutline, updateCourse } from "@/lib/courses";
import { getNode } from "@/lib/nodes";
import { getStudyContentDir } from "@/lib/settings";
import { importNotes, importUnit, loadStudyTree, refreshLinkedNode } from "@/lib/studyapp";
import { createOutlineFromTree, parseOutlineFile } from "@/lib/importers";
import type { NodeStatus } from "@/lib/types";
import { NODE_STATUSES } from "@/lib/types";

const text = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};

function placement(fd: FormData, courseId: number) {
  const db = getDb();
  const outlineId = text(fd, "outlineId");
  const outline = getOutline(db, outlineId);
  if (!outline || outline.courseId !== courseId) return null;
  const parentId = text(fd, "parentId") || null;
  if (parentId) {
    const parent = getNode(db, parentId);
    if (!parent || parent.outlineId !== outlineId) return null;
  }
  const statusRaw = text(fd, "status");
  const status: NodeStatus = (NODE_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as NodeStatus) : "drafted";
  return { outlineId, parentId, status };
}

export async function importFromStudyAppAction(formData: FormData) {
  const db = getDb();
  const courseId = Number(text(formData, "courseId"));
  const course = getCourse(db, courseId);
  if (!course || !course.studyCourseSlug) return;
  const place = placement(formData, courseId);
  if (!place) return;
  const { dir } = getStudyContentDir(db);
  const tree = loadStudyTree(dir);
  const studyCourse = tree.courses.find((c) => c.slug === course.studyCourseSlug);
  if (!studyCourse) return;
  const unitSlugs = formData.getAll("unit").filter((u): u is string => typeof u === "string");
  const notePaths = formData.getAll("note").filter((n): n is string => typeof n === "string");
  let created = 0;
  let skipped = 0;
  let firstId: string | null = null;
  for (const slug of unitSlugs) {
    const unit = studyCourse.units.find((u) => u.slug === slug);
    if (!unit) continue;
    const r = importUnit(db, courseId, unit, place);
    created += 1 + r.created.length;
    skipped += r.skipped.length;
    firstId ??= r.heading.id;
  }
  const allNotes = studyCourse.units.flatMap((u) => u.notes);
  const notes = notePaths.map((p) => allNotes.find((n) => n.path === p)).filter((n): n is NonNullable<typeof n> => n !== undefined);
  if (notes.length) {
    const r = importNotes(db, courseId, notes, place);
    created += r.created.length;
    skipped += r.skipped.length;
    firstId ??= r.created[0]?.id ?? null;
  }
  if (formData.get("topics") === "on") {
    const topics = new Set(course.syllabusTopics);
    for (const u of studyCourse.units) for (const t of u.syllabusTopics) topics.add(t);
    updateCourse(db, courseId, { syllabusTopics: Array.from(topics) });
  }
  revalidatePath(`/courses/${course.slug}/import`);
  const query = new URLSearchParams({ created: String(created), skipped: String(skipped) });
  if (firstId && created > 0) redirect(`/courses/${course.slug}/outlines/${place.outlineId}?node=${firstId}`);
  redirect(`/courses/${course.slug}/import?${query}`);
}

export async function importTopicsAction(formData: FormData) {
  const db = getDb();
  const courseId = Number(text(formData, "courseId"));
  const course = getCourse(db, courseId);
  if (!course || !course.studyCourseSlug) return;
  const { dir } = getStudyContentDir(db);
  const studyCourse = loadStudyTree(dir).courses.find((c) => c.slug === course.studyCourseSlug);
  if (!studyCourse) return;
  const topics = new Set(course.syllabusTopics);
  for (const u of studyCourse.units) for (const t of u.syllabusTopics) topics.add(t);
  updateCourse(db, courseId, { syllabusTopics: Array.from(topics) });
  revalidatePath(`/courses/${course.slug}/import`);
  revalidatePath(`/courses/${course.slug}/syllabus`);
}

export async function refreshLinkedNodeAction(formData: FormData) {
  const db = getDb();
  const nodeId = text(formData, "nodeId");
  const node = getNode(db, nodeId);
  if (!node) return;
  const { dir } = getStudyContentDir(db);
  refreshLinkedNode(db, nodeId, dir);
  const outline = getOutline(db, node.outlineId);
  const course = outline ? getCourse(db, outline.courseId) : null;
  if (course) revalidatePath(`/courses/${course.slug}/import`);
}

export async function importFileAction(formData: FormData) {
  const db = getDb();
  const courseId = Number(text(formData, "courseId"));
  const course = getCourse(db, courseId);
  if (!course) return;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`/courses/${course.slug}/import?error=${encodeURIComponent("Choose a .docx or .md file")}`);
  let tree;
  try {
    tree = await parseOutlineFile(file.name, Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    redirect(`/courses/${course.slug}/import?error=${encodeURIComponent((e as Error).message)}`);
  }
  const name = text(formData, "name") || file.name.replace(/\.[^.]+$/, "");
  const { outlineId, count } = createOutlineFromTree(db, courseId, name, tree);
  revalidatePath(`/courses/${course.slug}`);
  if (count === 0) redirect(`/courses/${course.slug}/import?error=${encodeURIComponent("No headings or list items were found in the file")}`);
  redirect(`/courses/${course.slug}/outlines/${outlineId}`);
}
