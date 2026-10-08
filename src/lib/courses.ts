// Courses and outlines: read and write helpers over SQLite. Every function takes the database so the same code
// runs in tests against ":memory:".

import type { Course, NumberingStyle, Outline, OutlineKind, OutlineOptions } from "./types.ts";
import { NUMBERING_STYLES, OUTLINE_KINDS } from "./types.ts";
import { nowIso, type Db } from "./db.ts";
import { newId } from "./ids.ts";
import { slugify } from "./slug.ts";

type CourseRow = {
  id: number;
  title: string;
  slug: string;
  sort_order: number;
  exam_date: string | null;
  exam_format: string;
  page_limit: number | null;
  study_course_slug: string | null;
  syllabus_topics: string;
  created_at: string;
};

type OutlineRow = {
  id: string;
  course_id: number;
  name: string;
  kind: OutlineKind;
  numbering: NumberingStyle;
  is_default: number;
  source_outline_id: string | null;
  options: string;
  created_at: string;
  updated_at: string;
};

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export function rowToCourse(r: CourseRow): Course {
  return {
    id: r.id,
    title: r.title,
    slug: r.slug,
    order: r.sort_order,
    examDate: r.exam_date,
    examFormat: r.exam_format,
    pageLimit: r.page_limit,
    studyCourseSlug: r.study_course_slug,
    syllabusTopics: parseJson<string[]>(r.syllabus_topics, []).filter((t) => typeof t === "string"),
    createdAt: r.created_at,
  };
}

export function rowToOutline(r: OutlineRow): Outline {
  return {
    id: r.id,
    courseId: r.course_id,
    name: r.name,
    kind: r.kind,
    numbering: NUMBERING_STYLES.includes(r.numbering) ? r.numbering : "legal",
    isDefault: r.is_default === 1,
    sourceOutlineId: r.source_outline_id,
    options: parseJson<OutlineOptions>(r.options, {}),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listCourses(db: Db): Course[] {
  return (db.prepare("SELECT * FROM courses ORDER BY sort_order, title").all() as CourseRow[]).map(rowToCourse);
}

export function getCourse(db: Db, id: number): Course | null {
  const row = db.prepare("SELECT * FROM courses WHERE id = ?").get(id) as CourseRow | undefined;
  return row ? rowToCourse(row) : null;
}

export function getCourseBySlug(db: Db, slug: string): Course | null {
  const row = db.prepare("SELECT * FROM courses WHERE slug = ?").get(slug) as CourseRow | undefined;
  return row ? rowToCourse(row) : null;
}

/** A slug no other course uses: "property", then "property-2", ... */
export function uniqueCourseSlug(db: Db, title: string, exceptId?: number): string {
  const base = slugify(title);
  let slug = base;
  for (let n = 2; ; n++) {
    const row = db.prepare("SELECT id FROM courses WHERE slug = ?").get(slug) as { id: number } | undefined;
    if (!row || row.id === exceptId) return slug;
    slug = `${base}-${n}`;
  }
}

export type CourseInput = {
  title: string;
  examDate?: string | null;
  examFormat?: string;
  pageLimit?: number | null;
  studyCourseSlug?: string | null;
  syllabusTopics?: string[];
  order?: number;
};

/** Create a course with its default "Full" outline and its scratch outline. */
export function createCourse(db: Db, input: CourseInput): Course {
  const title = input.title.trim() || "Untitled course";
  const slug = uniqueCourseSlug(db, title);
  const order = input.order ?? ((db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM courses").get() as { n: number }).n);
  const now = nowIso();
  const result = db
    .prepare(
      `INSERT INTO courses (title, slug, sort_order, exam_date, exam_format, page_limit, study_course_slug, syllabus_topics, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      title,
      slug,
      order,
      input.examDate || null,
      input.examFormat ?? "",
      input.pageLimit ?? null,
      input.studyCourseSlug || null,
      JSON.stringify(input.syllabusTopics ?? []),
      now,
    );
  const id = Number(result.lastInsertRowid);
  createOutline(db, id, { name: "Full", kind: "full", isDefault: true });
  createOutline(db, id, { name: "Scratch", kind: "scratch" });
  return getCourse(db, id)!;
}

export function updateCourse(db: Db, id: number, patch: Partial<CourseInput>): Course | null {
  const current = getCourse(db, id);
  if (!current) return null;
  const title = patch.title !== undefined ? patch.title.trim() || current.title : current.title;
  db.prepare(
    `UPDATE courses SET title = ?, exam_date = ?, exam_format = ?, page_limit = ?, study_course_slug = ?, syllabus_topics = ?, sort_order = ? WHERE id = ?`,
  ).run(
    title,
    patch.examDate !== undefined ? patch.examDate || null : current.examDate,
    patch.examFormat !== undefined ? patch.examFormat : current.examFormat,
    patch.pageLimit !== undefined ? patch.pageLimit : current.pageLimit,
    patch.studyCourseSlug !== undefined ? patch.studyCourseSlug || null : current.studyCourseSlug,
    JSON.stringify(patch.syllabusTopics !== undefined ? patch.syllabusTopics : current.syllabusTopics),
    patch.order !== undefined ? patch.order : current.order,
    id,
  );
  return getCourse(db, id);
}

export function deleteCourse(db: Db, id: number) {
  db.prepare("DELETE FROM courses WHERE id = ?").run(id);
}

export function listOutlines(db: Db, courseId: number): Outline[] {
  return (db.prepare("SELECT * FROM outlines WHERE course_id = ? ORDER BY is_default DESC, created_at").all(courseId) as OutlineRow[]).map(rowToOutline);
}

export function getOutline(db: Db, id: string): Outline | null {
  const row = db.prepare("SELECT * FROM outlines WHERE id = ?").get(id) as OutlineRow | undefined;
  return row ? rowToOutline(row) : null;
}

/** The outline the course page opens by default: the default full outline, else the first full one. */
export function defaultOutline(db: Db, courseId: number): Outline | null {
  const all = listOutlines(db, courseId);
  return all.find((o) => o.isDefault && o.kind === "full") ?? all.find((o) => o.kind === "full") ?? all[0] ?? null;
}

export function scratchOutline(db: Db, courseId: number): Outline {
  const existing = listOutlines(db, courseId).find((o) => o.kind === "scratch");
  return existing ?? createOutline(db, courseId, { name: "Scratch", kind: "scratch" });
}

export type OutlineInput = {
  name: string;
  kind?: OutlineKind;
  numbering?: NumberingStyle;
  isDefault?: boolean;
  sourceOutlineId?: string | null;
  options?: OutlineOptions;
  id?: string;
};

export function createOutline(db: Db, courseId: number, input: OutlineInput): Outline {
  const id = input.id ?? newId();
  const now = nowIso();
  const kind: OutlineKind = input.kind && OUTLINE_KINDS.includes(input.kind) ? input.kind : "full";
  const numbering: NumberingStyle = input.numbering && NUMBERING_STYLES.includes(input.numbering) ? input.numbering : kind === "scratch" ? "bullets" : "legal";
  db.transaction(() => {
    if (input.isDefault) db.prepare("UPDATE outlines SET is_default = 0 WHERE course_id = ?").run(courseId);
    db.prepare(
      `INSERT INTO outlines (id, course_id, name, kind, numbering, is_default, source_outline_id, options, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, courseId, input.name.trim() || "Untitled", kind, numbering, input.isDefault ? 1 : 0, input.sourceOutlineId ?? null, JSON.stringify(input.options ?? {}), now, now);
  })();
  return getOutline(db, id)!;
}

export function updateOutline(db: Db, id: string, patch: Partial<Omit<OutlineInput, "id" | "kind">>): Outline | null {
  const current = getOutline(db, id);
  if (!current) return null;
  const numbering = patch.numbering && NUMBERING_STYLES.includes(patch.numbering) ? patch.numbering : current.numbering;
  db.transaction(() => {
    if (patch.isDefault) db.prepare("UPDATE outlines SET is_default = 0 WHERE course_id = ?").run(current.courseId);
    db.prepare(`UPDATE outlines SET name = ?, numbering = ?, is_default = ?, source_outline_id = ?, options = ?, updated_at = ? WHERE id = ?`).run(
      patch.name !== undefined ? patch.name.trim() || current.name : current.name,
      numbering,
      patch.isDefault !== undefined ? (patch.isDefault ? 1 : 0) : current.isDefault ? 1 : 0,
      patch.sourceOutlineId !== undefined ? patch.sourceOutlineId : current.sourceOutlineId,
      JSON.stringify(patch.options !== undefined ? { ...current.options, ...patch.options } : current.options),
      nowIso(),
      id,
    );
  })();
  return getOutline(db, id);
}

export function touchOutline(db: Db, id: string) {
  db.prepare("UPDATE outlines SET updated_at = ? WHERE id = ?").run(nowIso(), id);
}

export function deleteOutline(db: Db, id: string) {
  db.prepare("DELETE FROM outlines WHERE id = ?").run(id);
}
