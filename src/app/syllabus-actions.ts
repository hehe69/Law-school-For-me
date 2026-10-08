"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getCourse, updateCourse } from "@/lib/courses";
import { deleteSyllabus, saveSyllabus } from "@/lib/syllabus";

const MAX_PDF_BYTES = 100 * 1024 * 1024;

export async function uploadSyllabusAction(formData: FormData) {
  const db = getDb();
  const courseId = Number(formData.get("courseId"));
  const course = getCourse(db, courseId);
  if (!course) return;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) redirect(`/courses/${course.slug}/syllabus?error=${encodeURIComponent("Choose a PDF file")}`);
  if (file.size > MAX_PDF_BYTES) redirect(`/courses/${course.slug}/syllabus?error=${encodeURIComponent("The PDF is larger than 100 MB")}`);
  const data = Buffer.from(await file.arrayBuffer());
  if (data.subarray(0, 5).toString("latin1") !== "%PDF-") redirect(`/courses/${course.slug}/syllabus?error=${encodeURIComponent("That file is not a PDF")}`);
  saveSyllabus(db, course, data);
  revalidatePath(`/courses/${course.slug}/syllabus`);
  redirect(`/courses/${course.slug}/syllabus`);
}

export async function removeSyllabusAction(formData: FormData) {
  const db = getDb();
  const courseId = Number(formData.get("courseId"));
  const course = getCourse(db, courseId);
  if (!course) return;
  deleteSyllabus(db, courseId);
  revalidatePath(`/courses/${course.slug}/syllabus`);
}

export async function saveTopicsAction(formData: FormData) {
  const db = getDb();
  const courseId = Number(formData.get("courseId"));
  const course = getCourse(db, courseId);
  if (!course) return;
  const raw = formData.get("syllabusTopics");
  const topics = Array.from(
    new Set(
      (typeof raw === "string" ? raw : "")
        .split(/\r?\n|,/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  );
  updateCourse(db, courseId, { syllabusTopics: topics });
  revalidatePath(`/courses/${course.slug}/syllabus`);
  revalidatePath(`/courses/${course.slug}`);
}
