import { getDb } from "../db";
import type { CitationLogEntry, LinkPurpose } from "../types";

// --- Section–source links -------------------------------------------------

export function createSectionSourceLink(sectionId: number, sourceId: number, purpose: LinkPurpose, note: string): boolean {
  const db = getDb();
  const sec = db.prepare("SELECT paper_id FROM sections WHERE id = ?").get(sectionId) as { paper_id: number } | undefined;
  const src = db.prepare("SELECT paper_id FROM sources WHERE id = ?").get(sourceId) as { paper_id: number } | undefined;
  if (!sec || !src || sec.paper_id !== src.paper_id) return false;
  const exists = db.prepare("SELECT 1 FROM section_sources WHERE section_id = ? AND source_id = ?").get(sectionId, sourceId);
  if (exists) return false;
  db.transaction(() => {
    db.prepare("INSERT INTO section_sources (section_id, source_id, purpose, note) VALUES (?, ?, ?, ?)").run(sectionId, sourceId, purpose, note);
    // A link writes a log row with an empty pin cite.
    db.prepare(
      `INSERT INTO citation_log (paper_id, source_id, pin_cite, section_id, extract_id, used_in, note, origin)
       VALUES (?, ?, NULL, ?, NULL, '', ?, 'source_link')`,
    ).run(sec.paper_id, sourceId, sectionId, note);
  })();
  return true;
}

export function updateSectionSourceLink(id: number, purpose: LinkPurpose, note: string) {
  getDb().prepare("UPDATE section_sources SET purpose = ?, note = ? WHERE id = ?").run(purpose, note, id);
}

// Deleting a link does not delete its log row.
export function deleteSectionSourceLink(id: number) {
  getDb().prepare("DELETE FROM section_sources WHERE id = ?").run(id);
}

export interface SectionLinkRow {
  id: number;
  section_id: number;
  source_id: number;
  purpose: LinkPurpose;
  note: string;
  short_cite: string;
  citation: string;
  read_status: string;
}
export function linksForSection(sectionId: number): SectionLinkRow[] {
  return getDb()
    .prepare(
      `SELECT l.id, l.section_id, l.source_id, l.purpose, l.note, s.short_cite, s.citation, s.read_status
       FROM section_sources l JOIN sources s ON s.id = l.source_id WHERE l.section_id = ? ORDER BY l.id`,
    )
    .all(sectionId) as SectionLinkRow[];
}
export function linksForPaper(paperId: number): SectionLinkRow[] {
  return getDb()
    .prepare(
      `SELECT l.id, l.section_id, l.source_id, l.purpose, l.note, s.short_cite, s.citation, s.read_status
       FROM section_sources l JOIN sources s ON s.id = l.source_id WHERE s.paper_id = ? ORDER BY l.id`,
    )
    .all(paperId) as SectionLinkRow[];
}

// --- Citation log ----------------------------------------------------------

export function logFromExtractLink(paperId: number, sourceId: number, pinCite: string, sectionId: number, extractId: number) {
  getDb()
    .prepare(
      `INSERT INTO citation_log (paper_id, source_id, pin_cite, section_id, extract_id, used_in, note, origin)
       VALUES (?, ?, ?, ?, ?, '', '', 'extract_link')`,
    )
    .run(paperId, sourceId, pinCite, sectionId, extractId);
}

export function addManualLogEntry(
  paperId: number,
  input: { source_id: number; pin_cite: string | null; section_id: number | null; extract_id: number | null; used_in: string; note: string },
) {
  getDb()
    .prepare(
      `INSERT INTO citation_log (paper_id, source_id, pin_cite, section_id, extract_id, used_in, note, origin)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')`,
    )
    .run(paperId, input.source_id, input.pin_cite, input.section_id, input.extract_id, input.used_in, input.note);
}

export function updateLogEntry(
  id: number,
  input: Partial<{ pin_cite: string | null; used_in: string; note: string; verified: boolean; section_id: number | null }>,
) {
  const db = getDb();
  if (input.pin_cite !== undefined) db.prepare("UPDATE citation_log SET pin_cite = ? WHERE id = ?").run(input.pin_cite, id);
  if (input.used_in !== undefined) db.prepare("UPDATE citation_log SET used_in = ? WHERE id = ?").run(input.used_in, id);
  if (input.note !== undefined) db.prepare("UPDATE citation_log SET note = ? WHERE id = ?").run(input.note, id);
  if (input.verified !== undefined) db.prepare("UPDATE citation_log SET verified = ? WHERE id = ?").run(input.verified ? 1 : 0, id);
  if (input.section_id !== undefined) db.prepare("UPDATE citation_log SET section_id = ? WHERE id = ?").run(input.section_id, id);
}

export function deleteLogEntry(id: number) {
  getDb().prepare("DELETE FROM citation_log WHERE id = ?").run(id);
}

export interface LogRow extends CitationLogEntry {
  short_cite: string;
  section_heading: string | null;
  extract_pin: string | null;
  extract_text: string | null;
  outline_order: number;
}

export function listCitationLog(
  paperId: number,
  opts: { sort?: "outline" | "source" | "date"; unverified?: boolean; missingPin?: boolean } = {},
): LogRow[] {
  const db = getDb();
  const where: string[] = ["c.paper_id = ?"];
  if (opts.unverified) where.push("c.verified = 0");
  if (opts.missingPin) where.push("(c.pin_cite IS NULL OR TRIM(c.pin_cite) = '')");
  const rows = db
    .prepare(
      `SELECT c.*, s.short_cite, sec.heading AS section_heading, e.pin_cite AS extract_pin, e.text AS extract_text
       FROM citation_log c
       JOIN sources s ON s.id = c.source_id
       LEFT JOIN sections sec ON sec.id = c.section_id
       LEFT JOIN extracts e ON e.id = c.extract_id
       WHERE ${where.join(" AND ")} ORDER BY c.id DESC`,
    )
    .all(paperId) as Omit<LogRow, "outline_order">[];
  // Outline order from the depth-first tree; rows without a section sort last.
  const order = outlineOrderMap(paperId);
  const out: LogRow[] = rows.map((r) => ({ ...r, outline_order: r.section_id ? (order.get(r.section_id) ?? 1e9) : 1e9 }));
  const sort = opts.sort ?? "outline";
  if (sort === "outline") out.sort((a, b) => a.outline_order - b.outline_order || b.id - a.id);
  else if (sort === "source") out.sort((a, b) => a.short_cite.localeCompare(b.short_cite) || (a.pin_cite ?? "").localeCompare(b.pin_cite ?? ""));
  else out.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
  return out;
}

function outlineOrderMap(paperId: number): Map<number, number> {
  const rows = getDb()
    .prepare("SELECT id, parent_id, sort_order FROM sections WHERE paper_id = ?")
    .all(paperId) as { id: number; parent_id: number | null; sort_order: number }[];
  const byParent = new Map<number | null, typeof rows>();
  for (const r of rows) byParent.set(r.parent_id, [...(byParent.get(r.parent_id) ?? []), r]);
  const map = new Map<number, number>();
  let i = 0;
  const walk = (p: number | null, seen: Set<number>) => {
    for (const r of (byParent.get(p) ?? []).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      map.set(r.id, i++);
      walk(r.id, seen);
    }
  };
  walk(null, new Set());
  return map;
}

// Dashboard list: entries with no pin cite or not verified.
export function problemLogEntries(paperId: number): LogRow[] {
  return listCitationLog(paperId).filter((r) => !r.verified || !r.pin_cite || !r.pin_cite.trim());
}
