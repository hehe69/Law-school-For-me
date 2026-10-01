import { getDb } from "../db";
import { slugify } from "../slug";
import { DEFAULT_MILESTONES, type Milestone, type OpenQuestion, type Paper, type PaperStatus, type ThesisVersion } from "../types";
import { daysUntil } from "../format";

export function listPapers(): Paper[] {
  return getDb().prepare("SELECT * FROM papers ORDER BY created_at DESC, id DESC").all() as Paper[];
}

export function getPaperBySlug(slug: string): Paper | undefined {
  return getDb().prepare("SELECT * FROM papers WHERE slug = ?").get(slug) as Paper | undefined;
}

export function getPaperById(id: number): Paper | undefined {
  return getDb().prepare("SELECT * FROM papers WHERE id = ?").get(id) as Paper | undefined;
}

export function uniqueSlug(base: string, excludeId?: number) {
  const db = getDb();
  let slug = slugify(base);
  let n = 2;
  const taken = (s: string) =>
    db.prepare("SELECT id FROM papers WHERE slug = ? AND id IS NOT ?").get(s, excludeId ?? -1) !== undefined;
  const root = slug;
  while (taken(slug)) {
    slug = `${root}-${n}`;
    n += 1;
  }
  return slug;
}

export function createPaper(input: { title: string; venue: string; word_limit: number | null; thesis: string }): Paper {
  const db = getDb();
  const slug = uniqueSlug(input.title);
  return db.transaction(() => {
    const res = db
      .prepare("INSERT INTO papers (title, slug, venue, word_limit, thesis) VALUES (?, ?, ?, ?, ?)")
      .run(input.title, slug, input.venue, input.word_limit, input.thesis);
    const id = Number(res.lastInsertRowid);
    if (input.thesis.trim()) {
      db.prepare("INSERT INTO thesis_versions (paper_id, text, note) VALUES (?, ?, ?)").run(id, input.thesis, "initial thesis");
    }
    const ins = db.prepare("INSERT INTO milestones (paper_id, name, sort_order) VALUES (?, ?, ?)");
    DEFAULT_MILESTONES.forEach((name, i) => ins.run(id, name, i));
    return getPaperById(id)!;
  })();
}

export function updatePaper(
  id: number,
  input: { title: string; slug: string; venue: string; word_limit: number | null; status: PaperStatus },
) {
  const slug = uniqueSlug(input.slug || input.title, id);
  getDb()
    .prepare("UPDATE papers SET title = ?, slug = ?, venue = ?, word_limit = ?, status = ? WHERE id = ?")
    .run(input.title, slug, input.venue, input.word_limit, input.status, id);
  return slug;
}

export function deletePaper(id: number) {
  getDb().prepare("DELETE FROM papers WHERE id = ?").run(id);
}

// Thesis: every revision writes a version row so the history is kept.
export function reviseThesis(paperId: number, text: string, note: string) {
  const db = getDb();
  db.transaction(() => {
    db.prepare("UPDATE papers SET thesis = ? WHERE id = ?").run(text, paperId);
    db.prepare("INSERT INTO thesis_versions (paper_id, text, note) VALUES (?, ?, ?)").run(paperId, text, note);
  })();
}

export function listThesisVersions(paperId: number): ThesisVersion[] {
  return getDb().prepare("SELECT * FROM thesis_versions WHERE paper_id = ? ORDER BY id DESC").all(paperId) as ThesisVersion[];
}

// Milestones
export function listMilestones(paperId: number): Milestone[] {
  return getDb().prepare("SELECT * FROM milestones WHERE paper_id = ? ORDER BY sort_order, id").all(paperId) as Milestone[];
}
export function addMilestone(paperId: number, name: string, due: string | null) {
  const db = getDb();
  const max = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM milestones WHERE paper_id = ?").get(paperId) as { m: number };
  db.prepare("INSERT INTO milestones (paper_id, name, due_date, sort_order) VALUES (?, ?, ?, ?)").run(paperId, name, due, max.m + 1);
}
export function updateMilestone(id: number, input: { name?: string; due_date?: string | null; done?: boolean }) {
  const db = getDb();
  if (input.name !== undefined) db.prepare("UPDATE milestones SET name = ? WHERE id = ?").run(input.name, id);
  if (input.due_date !== undefined) db.prepare("UPDATE milestones SET due_date = ? WHERE id = ?").run(input.due_date, id);
  if (input.done !== undefined) db.prepare("UPDATE milestones SET done = ? WHERE id = ?").run(input.done ? 1 : 0, id);
}
export function deleteMilestone(id: number) {
  getDb().prepare("DELETE FROM milestones WHERE id = ?").run(id);
}

export function nextMilestone(paperId: number): (Milestone & { days: number | null }) | null {
  const rows = listMilestones(paperId).filter((m) => !m.done);
  // Earliest dated undone milestone; fall back to the first undone one.
  const dated = rows.filter((m) => m.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const m = dated[0] ?? rows[0];
  if (!m) return null;
  return { ...m, days: daysUntil(m.due_date) };
}

// Open questions
export function listOpenQuestions(paperId: number): (OpenQuestion & { section_heading: string | null })[] {
  return getDb()
    .prepare(
      `SELECT q.*, s.heading AS section_heading FROM open_questions q
       LEFT JOIN sections s ON s.id = q.section_id
       WHERE q.paper_id = ? ORDER BY q.resolved, q.id DESC`,
    )
    .all(paperId) as (OpenQuestion & { section_heading: string | null })[];
}
export function addOpenQuestion(paperId: number, text: string, sectionId: number | null) {
  getDb().prepare("INSERT INTO open_questions (paper_id, section_id, text) VALUES (?, ?, ?)").run(paperId, sectionId, text);
}
export function setQuestionResolved(id: number, resolved: boolean) {
  getDb().prepare("UPDATE open_questions SET resolved = ? WHERE id = ?").run(resolved ? 1 : 0, id);
}
export function deleteOpenQuestion(id: number) {
  getDb().prepare("DELETE FROM open_questions WHERE id = ?").run(id);
}

// Counts for the home page.
export interface PaperCounts {
  unread_sources: number;
  unlinked_sources: number;
  unlinked_extracts: number;
  unsupported_sections: number;
  sources: number;
  extracts: number;
  sections: number;
}

export function paperCounts(paperId: number): PaperCounts {
  const db = getDb();
  const one = (sql: string) => (db.prepare(sql).get(paperId) as { n: number }).n;
  return {
    sources: one("SELECT COUNT(*) n FROM sources WHERE paper_id = ?"),
    extracts: one("SELECT COUNT(*) n FROM extracts e JOIN sources s ON s.id = e.source_id WHERE s.paper_id = ?"),
    sections: one("SELECT COUNT(*) n FROM sections WHERE paper_id = ?"),
    unread_sources: one("SELECT COUNT(*) n FROM sources WHERE paper_id = ? AND read_status = 'unread'"),
    unlinked_sources: one(
      "SELECT COUNT(*) n FROM sources s WHERE s.paper_id = ? AND NOT EXISTS (SELECT 1 FROM section_sources l WHERE l.source_id = s.id)",
    ),
    unlinked_extracts: one(
      `SELECT COUNT(*) n FROM extracts e JOIN sources s ON s.id = e.source_id
       WHERE s.paper_id = ? AND NOT EXISTS (SELECT 1 FROM extract_sections x WHERE x.extract_id = e.id)`,
    ),
    unsupported_sections: one(
      `SELECT COUNT(*) n FROM sections sec WHERE sec.paper_id = ?
       AND NOT EXISTS (SELECT 1 FROM section_sources l WHERE l.section_id = sec.id)
       AND NOT EXISTS (SELECT 1 FROM extract_sections x WHERE x.section_id = sec.id)`,
    ),
  };
}
