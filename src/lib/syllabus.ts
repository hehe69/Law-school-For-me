// The course syllabus PDF: one file per course under uploads/<course-slug>/syllabus.pdf. Re-uploading replaces
// the file; the course's topics (on the courses table) are untouched.

import fs from "node:fs";
import path from "node:path";
import type { Course, Syllabus } from "./types.ts";
import { nowIso, type Db } from "./db.ts";
import { UPLOADS_DIR } from "./paths.ts";

type Row = { course_id: number; file_path: string; uploaded_at: string };

export function getSyllabus(db: Db, courseId: number): Syllabus | null {
  const row = db.prepare("SELECT * FROM syllabi WHERE course_id = ?").get(courseId) as Row | undefined;
  return row ? { courseId: row.course_id, filePath: row.file_path, uploadedAt: row.uploaded_at } : null;
}

/** URL the browser can load the PDF from; the upload time busts the cache after a replacement. */
export function syllabusUrl(s: Syllabus): string {
  return `/files/${s.filePath.split("/").map(encodeURIComponent).join("/")}?v=${encodeURIComponent(s.uploadedAt)}`;
}

export function saveSyllabus(db: Db, course: Course, data: Buffer): Syllabus {
  const dir = path.join(UPLOADS_DIR, course.slug);
  fs.mkdirSync(dir, { recursive: true });
  const rel = `${course.slug}/syllabus.pdf`;
  const tmp = path.join(UPLOADS_DIR, `${rel}.tmp`);
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, path.join(UPLOADS_DIR, rel));
  const now = nowIso();
  db.prepare("INSERT INTO syllabi (course_id, file_path, uploaded_at) VALUES (?, ?, ?) ON CONFLICT(course_id) DO UPDATE SET file_path = excluded.file_path, uploaded_at = excluded.uploaded_at").run(
    course.id,
    rel,
    now,
  );
  return { courseId: course.id, filePath: rel, uploadedAt: now };
}

export function deleteSyllabus(db: Db, courseId: number) {
  const current = getSyllabus(db, courseId);
  if (!current) return;
  db.prepare("DELETE FROM syllabi WHERE course_id = ?").run(courseId);
  fs.rmSync(path.join(UPLOADS_DIR, current.filePath), { force: true });
}
