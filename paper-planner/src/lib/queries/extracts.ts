import { getDb } from "../db";
import type { Extract, ExtractKind } from "../types";
import { extractTagMap, setExtractTags } from "./tags";
import { logFromExtractLink } from "./citations";

export interface ExtractRow extends Extract {
  paper_id: number;
  short_cite: string;
  tags: string[];
  sections: { id: number; heading: string }[];
}

export interface ExtractFilters {
  kind?: string;
  section?: number;
  source?: number;
  tag?: string;
  unlinked?: boolean;
  q?: string;
}

// Turn free text into a safe FTS5 MATCH expression: each term quoted, implicit AND.
export function ftsQuery(raw: string): string | null {
  const terms = raw
    .split(/\s+/)
    .map((t) => t.replace(/"/g, "").trim())
    .filter(Boolean);
  if (terms.length === 0) return null;
  return terms.map((t) => `"${t}"`).join(" ");
}

export function listExtracts(paperId: number, f: ExtractFilters = {}): ExtractRow[] {
  const db = getDb();
  const where: string[] = ["s.paper_id = ?"];
  const params: unknown[] = [paperId];
  if (f.kind) {
    where.push("e.kind = ?");
    params.push(f.kind);
  }
  if (f.source) {
    where.push("e.source_id = ?");
    params.push(f.source);
  }
  if (f.section) {
    where.push("EXISTS (SELECT 1 FROM extract_sections x WHERE x.extract_id = e.id AND x.section_id = ?)");
    params.push(f.section);
  }
  if (f.tag) {
    where.push("EXISTS (SELECT 1 FROM extract_tags et JOIN tags t ON t.id = et.tag_id WHERE et.extract_id = e.id AND t.name = ? COLLATE NOCASE)");
    params.push(f.tag);
  }
  if (f.unlinked) {
    where.push("NOT EXISTS (SELECT 1 FROM extract_sections x WHERE x.extract_id = e.id)");
  }
  const match = f.q ? ftsQuery(f.q) : null;
  if (match) {
    where.push("e.id IN (SELECT rowid FROM extracts_fts WHERE extracts_fts MATCH ?)");
    params.push(match);
  }
  const rows = db
    .prepare(
      `SELECT e.*, s.paper_id, s.short_cite FROM extracts e JOIN sources s ON s.id = e.source_id
       WHERE ${where.join(" AND ")} ORDER BY e.created_at DESC, e.id DESC`,
    )
    .all(...params) as (Extract & { paper_id: number; short_cite: string })[];
  return decorate(paperId, rows);
}

function decorate(paperId: number, rows: (Extract & { paper_id: number; short_cite: string })[]): ExtractRow[] {
  const tags = extractTagMap(paperId);
  const secRows = getDb()
    .prepare(
      `SELECT x.extract_id, sec.id, sec.heading FROM extract_sections x
       JOIN sections sec ON sec.id = x.section_id WHERE sec.paper_id = ? ORDER BY sec.sort_order`,
    )
    .all(paperId) as { extract_id: number; id: number; heading: string }[];
  const secMap = new Map<number, { id: number; heading: string }[]>();
  for (const r of secRows) secMap.set(r.extract_id, [...(secMap.get(r.extract_id) ?? []), { id: r.id, heading: r.heading }]);
  return rows.map((r) => ({ ...r, tags: tags.get(r.id) ?? [], sections: secMap.get(r.id) ?? [] }));
}

export function extractsForSource(sourceId: number): ExtractRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.*, s.paper_id, s.short_cite FROM extracts e JOIN sources s ON s.id = e.source_id
       WHERE e.source_id = ? ORDER BY e.id DESC`,
    )
    .all(sourceId) as (Extract & { paper_id: number; short_cite: string })[];
  if (rows.length === 0) return [];
  return decorate(rows[0].paper_id, rows);
}

export function extractsForSection(sectionId: number): ExtractRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.*, s.paper_id, s.short_cite FROM extract_sections x
       JOIN extracts e ON e.id = x.extract_id JOIN sources s ON s.id = e.source_id
       WHERE x.section_id = ? ORDER BY e.id`,
    )
    .all(sectionId) as (Extract & { paper_id: number; short_cite: string })[];
  if (rows.length === 0) return [];
  return decorate(rows[0].paper_id, rows);
}

export function getExtract(id: number): ExtractRow | undefined {
  const row = getDb()
    .prepare(`SELECT e.*, s.paper_id, s.short_cite FROM extracts e JOIN sources s ON s.id = e.source_id WHERE e.id = ?`)
    .get(id) as (Extract & { paper_id: number; short_cite: string }) | undefined;
  if (!row) return undefined;
  return decorate(row.paper_id, [row])[0];
}

export interface ExtractInput {
  pin_cite: string;
  text: string;
  note: string;
  kind: ExtractKind;
  tags: string;
  section_ids: number[];
}

export function createExtract(sourceId: number, paperId: number, input: ExtractInput): number {
  const db = getDb();
  return db.transaction(() => {
    const res = db
      .prepare("INSERT INTO extracts (source_id, pin_cite, text, note, kind) VALUES (?, ?, ?, ?, ?)")
      .run(sourceId, input.pin_cite, input.text, input.note, input.kind);
    const id = Number(res.lastInsertRowid);
    setExtractTags(id, paperId, input.tags);
    for (const sid of input.section_ids) linkExtractToSection(id, sid);
    return id;
  })();
}

export function updateExtract(id: number, input: Omit<ExtractInput, "section_ids">) {
  const db = getDb();
  const ex = getExtract(id);
  if (!ex) return;
  db.transaction(() => {
    db.prepare("UPDATE extracts SET pin_cite = ?, text = ?, note = ?, kind = ? WHERE id = ?").run(
      input.pin_cite,
      input.text,
      input.note,
      input.kind,
      id,
    );
    setExtractTags(id, ex.paper_id, input.tags);
  })();
}

export function deleteExtract(id: number) {
  getDb().prepare("DELETE FROM extracts WHERE id = ?").run(id);
}

// Linking an extract to a section writes a citation log row with the pin cite copied in.
export function linkExtractToSection(extractId: number, sectionId: number): boolean {
  const db = getDb();
  const ex = db.prepare("SELECT e.*, s.paper_id FROM extracts e JOIN sources s ON s.id = e.source_id WHERE e.id = ?").get(extractId) as
    | (Extract & { paper_id: number })
    | undefined;
  const sec = db.prepare("SELECT paper_id FROM sections WHERE id = ?").get(sectionId) as { paper_id: number } | undefined;
  if (!ex || !sec || ex.paper_id !== sec.paper_id) return false;
  const exists = db.prepare("SELECT 1 FROM extract_sections WHERE extract_id = ? AND section_id = ?").get(extractId, sectionId);
  if (exists) return false;
  db.transaction(() => {
    db.prepare("INSERT INTO extract_sections (extract_id, section_id) VALUES (?, ?)").run(extractId, sectionId);
    logFromExtractLink(ex.paper_id, ex.source_id, ex.pin_cite, sectionId, extractId);
  })();
  return true;
}

// Unlinking leaves the citation log row in place; it's a log.
export function unlinkExtractFromSection(extractId: number, sectionId: number) {
  getDb().prepare("DELETE FROM extract_sections WHERE extract_id = ? AND section_id = ?").run(extractId, sectionId);
}

export function unlinkedExtracts(paperId: number): ExtractRow[] {
  return listExtracts(paperId, { unlinked: true });
}
