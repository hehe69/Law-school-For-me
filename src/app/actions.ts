"use server";

// Server actions for the course and outline forms. The editor itself talks to /api/outlines/[id]/sync.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { createCourse, createOutline, deleteCourse, deleteOutline, getCourse, getOutline, updateCourse, updateOutline } from "@/lib/courses";
import type { NumberingStyle, OutlineKind } from "@/lib/types";
import { NUMBERING_STYLES, OUTLINE_KINDS } from "@/lib/types";

const text = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};

function optionalInt(fd: FormData, key: string): number | null {
  const v = text(fd, key);
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function topics(fd: FormData): string[] {
  return Array.from(
    new Set(
      text(fd, "syllabusTopics")
        .split(/\r?\n|,/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
}

export async function createCourseAction(formData: FormData) {
  const db = getDb();
  const course = createCourse(db, {
    title: text(formData, "title") || "Untitled course",
    examDate: text(formData, "examDate") || null,
    examFormat: text(formData, "examFormat"),
    pageLimit: optionalInt(formData, "pageLimit"),
    studyCourseSlug: text(formData, "studyCourseSlug") || null,
    syllabusTopics: topics(formData),
  });
  revalidatePath("/");
  redirect(`/courses/${course.slug}`);
}

export async function updateCourseAction(formData: FormData) {
  const db = getDb();
  const id = Number(text(formData, "id"));
  const course = getCourse(db, id);
  if (!course) return;
  updateCourse(db, id, {
    title: text(formData, "title") || course.title,
    examDate: text(formData, "examDate") || null,
    examFormat: text(formData, "examFormat"),
    pageLimit: optionalInt(formData, "pageLimit"),
    studyCourseSlug: text(formData, "studyCourseSlug") || null,
    syllabusTopics: topics(formData),
    order: optionalInt(formData, "order") ?? course.order,
  });
  revalidatePath("/");
  revalidatePath(`/courses/${course.slug}`);
}

export async function deleteCourseAction(formData: FormData) {
  const db = getDb();
  const id = Number(text(formData, "id"));
  deleteCourse(db, id);
  revalidatePath("/");
  redirect("/");
}

export async function createOutlineAction(formData: FormData) {
  const db = getDb();
  const courseId = Number(text(formData, "courseId"));
  const course = getCourse(db, courseId);
  if (!course) return;
  const kindRaw = text(formData, "kind");
  const kind: OutlineKind = (OUTLINE_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as OutlineKind) : "full";
  const numberingRaw = text(formData, "numbering");
  const numbering: NumberingStyle | undefined = (NUMBERING_STYLES as readonly string[]).includes(numberingRaw) ? (numberingRaw as NumberingStyle) : undefined;
  const outline = createOutline(db, courseId, { name: text(formData, "name") || "Untitled", kind, numbering, isDefault: formData.get("isDefault") === "on" });
  revalidatePath(`/courses/${course.slug}`);
  redirect(`/courses/${course.slug}/outlines/${outline.id}`);
}

export async function renameOutlineAction(formData: FormData) {
  const db = getDb();
  const id = text(formData, "id");
  const outline = getOutline(db, id);
  if (!outline) return;
  updateOutline(db, id, { name: text(formData, "name") || outline.name, isDefault: formData.get("isDefault") === "on" ? true : undefined });
  const course = getCourse(db, outline.courseId);
  if (course) revalidatePath(`/courses/${course.slug}`);
}

export async function deleteOutlineAction(formData: FormData) {
  const db = getDb();
  const id = text(formData, "id");
  const outline = getOutline(db, id);
  if (!outline) return;
  const course = getCourse(db, outline.courseId);
  deleteOutline(db, id);
  if (course) {
    revalidatePath(`/courses/${course.slug}`);
    redirect(`/courses/${course.slug}`);
  }
}
