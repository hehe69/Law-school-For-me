"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourse, getOutline } from "@/lib/courses";
import { exportOutline, type ExportOptions } from "@/lib/export";
import { takeSnapshot } from "@/lib/snapshots";
import { restoreSnapshotAsOutline } from "@/lib/snapdiff";

export async function exportAction(formData: FormData) {
  const db = getDb();
  const outlineId = String(formData.get("outlineId") ?? "");
  const outline = getOutline(db, outlineId);
  const course = outline ? getCourse(db, outline.courseId) : null;
  if (!outline || !course) return;
  const formatRaw = String(formData.get("format") ?? "docx");
  const opts: ExportOptions = {
    format: formatRaw === "pdf" ? "pdf" : formatRaw === "md" ? "md" : "docx",
    sectionId: String(formData.get("sectionId") ?? "") || null,
    sources: formData.get("sources") === "footnotes" ? "footnotes" : formData.get("sources") === "none" ? "none" : "inline",
    revealAnswers: formData.get("answers") === "on",
  };
  const base = `/courses/${course.slug}/outlines/${outlineId}/export`;
  try {
    const result = await exportOutline(db, outlineId, opts);
    if (!result) redirect(`${base}?error=${encodeURIComponent("outline not found")}`);
    redirect(`${base}?done=${encodeURIComponent(result.path)}&bytes=${result.bytes}`);
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // Next's redirect
    redirect(`${base}?error=${encodeURIComponent((e as Error).message)}`);
  }
}

export async function takeSnapshotAction(formData: FormData) {
  const db = getDb();
  const outlineId = String(formData.get("outlineId") ?? "");
  const outline = getOutline(db, outlineId);
  const course = outline ? getCourse(db, outline.courseId) : null;
  if (!outline || !course) return;
  takeSnapshot(db, outlineId, String(formData.get("label") ?? "").trim());
  redirect(`/courses/${course.slug}/outlines/${outlineId}/snapshots`);
}

export async function restoreSnapshotAction(formData: FormData) {
  const db = getDb();
  const snapshotId = String(formData.get("snapshotId") ?? "");
  const name = String(formData.get("name") ?? "");
  const outline = restoreSnapshotAsOutline(db, snapshotId, name);
  if (!outline) return;
  const course = getCourse(db, outline.courseId);
  if (course) redirect(`/courses/${course.slug}/outlines/${outline.id}`);
}
