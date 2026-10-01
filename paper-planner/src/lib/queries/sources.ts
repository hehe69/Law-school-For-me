import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db";
import { ensureDir, resolveStored, sourcesDir, toStored, uniquePath } from "../paths";
import type { ReadStatus, Source, SourceType } from "../types";
import { ensureTags, setSourceTags, sourceTagMap } from "./tags";
import { getPaperById } from "./papers";

export interface SourceRow extends Source {
  tags: string[];
  extract_count: number;
  link_count: number;
}

export function listSources(paperId: number): SourceRow[] {
  const rows = getDb()
    .prepare(
      `SELECT s.*,
         (SELECT COUNT(*) FROM extracts e WHERE e.source_id = s.id) AS extract_count,
         (SELECT COUNT(*) FROM section_sources l WHERE l.source_id = s.id) AS link_count
       FROM sources s WHERE s.paper_id = ? ORDER BY s.created_at DESC, s.id DESC`,
    )
    .all(paperId) as (Source & { extract_count: number; link_count: number })[];
  const tags = sourceTagMap(paperId);
  return rows.map((r) => ({ ...r, tags: tags.get(r.id) ?? [] }));
}

export function getSource(id: number): SourceRow | undefined {
  const row = getDb()
    .prepare(
      `SELECT s.*,
         (SELECT COUNT(*) FROM extracts e WHERE e.source_id = s.id) AS extract_count,
         (SELECT COUNT(*) FROM section_sources l WHERE l.source_id = s.id) AS link_count
       FROM sources s WHERE s.id = ?`,
    )
    .get(id) as (Source & { extract_count: number; link_count: number }) | undefined;
  if (!row) return undefined;
  const tags = (
    getDb()
      .prepare("SELECT t.name FROM source_tags st JOIN tags t ON t.id = st.tag_id WHERE st.source_id = ? ORDER BY t.name")
      .all(id) as { name: string }[]
  ).map((t) => t.name);
  return { ...row, tags };
}

export interface SourceInput {
  type: SourceType;
  citation: string;
  short_cite: string;
  year: number | null;
  publisher: string;
  url: string;
  read_status: ReadStatus;
  relevance: string;
  tags: string;
}

export function createSource(paperId: number, input: SourceInput): number {
  const db = getDb();
  return db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO sources (paper_id, type, citation, short_cite, year, publisher, url, read_status, relevance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(paperId, input.type, input.citation, input.short_cite, input.year, input.publisher, input.url, input.read_status, input.relevance);
    const id = Number(res.lastInsertRowid);
    setSourceTags(id, paperId, input.tags);
    return id;
  })();
}

export function updateSource(id: number, input: SourceInput) {
  const db = getDb();
  const src = getSource(id);
  if (!src) return;
  db.transaction(() => {
    db.prepare(
      `UPDATE sources SET type = ?, citation = ?, short_cite = ?, year = ?, publisher = ?, url = ?, read_status = ?, relevance = ?
       WHERE id = ?`,
    ).run(input.type, input.citation, input.short_cite, input.year, input.publisher, input.url, input.read_status, input.relevance, id);
    setSourceTags(id, src.paper_id, input.tags);
  })();
}

export function setReadStatus(id: number, status: ReadStatus) {
  getDb().prepare("UPDATE sources SET read_status = ? WHERE id = ?").run(status, id);
}

// Store an uploaded PDF under papers/<slug>/sources/ and record its relative path.
export function attachPdf(sourceId: number, slug: string, fileName: string, bytes: Buffer) {
  const dir = ensureDir(sourcesDir(slug));
  const target = uniquePath(dir, fileName);
  fs.writeFileSync(target, bytes);
  const src = getSource(sourceId);
  if (src?.pdf_path) {
    try {
      fs.unlinkSync(resolveStored(src.pdf_path));
    } catch {
      /* already gone */
    }
  }
  getDb().prepare("UPDATE sources SET pdf_path = ? WHERE id = ?").run(toStored(target), sourceId);
}

export function removePdf(sourceId: number) {
  const src = getSource(sourceId);
  if (src?.pdf_path) {
    try {
      fs.unlinkSync(resolveStored(src.pdf_path));
    } catch {
      /* ignore */
    }
  }
  getDb().prepare("UPDATE sources SET pdf_path = NULL WHERE id = ?").run(sourceId);
}

// Deleting a source deletes its extracts, links, and citation log rows (cascade) and its PDF file.
export function deleteSource(id: number) {
  const src = getSource(id);
  if (!src) return;
  if (src.pdf_path) {
    try {
      fs.unlinkSync(resolveStored(src.pdf_path));
    } catch {
      /* ignore */
    }
  }
  getDb().prepare("DELETE FROM sources WHERE id = ?").run(id);
}

// Copy the source row and its PDF (and tag names) to another paper. Extracts and links are not copied.
export function copySourceToPaper(sourceId: number, targetPaperId: number): number | null {
  const db = getDb();
  const src = getSource(sourceId);
  const target = getPaperById(targetPaperId);
  if (!src || !target || src.paper_id === targetPaperId) return null;
  return db.transaction(() => {
    const res = db
      .prepare(
        `INSERT INTO sources (paper_id, type, citation, short_cite, year, publisher, url, read_status, relevance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(targetPaperId, src.type, src.citation, src.short_cite, src.year, src.publisher, src.url, src.read_status, src.relevance);
    const newId = Number(res.lastInsertRowid);
    const tagIds = ensureTags(targetPaperId, src.tags);
    const ins = db.prepare("INSERT OR IGNORE INTO source_tags (source_id, tag_id) VALUES (?, ?)");
    tagIds.forEach((t) => ins.run(newId, t));
    if (src.pdf_path) {
      try {
        const from = resolveStored(src.pdf_path);
        const dir = ensureDir(sourcesDir(target.slug));
        const to = uniquePath(dir, path.basename(from));
        fs.copyFileSync(from, to);
        db.prepare("UPDATE sources SET pdf_path = ? WHERE id = ?").run(toStored(to), newId);
      } catch {
        /* PDF missing on disk; row still copied */
      }
    }
    return newId;
  })();
}

// Section links for a source, with section heading and claim.
export interface SourceLinkRow {
  id: number;
  section_id: number;
  purpose: string;
  note: string;
  heading: string;
  claim: string;
}
export function linksForSource(sourceId: number): SourceLinkRow[] {
  return getDb()
    .prepare(
      `SELECT l.id, l.section_id, l.purpose, l.note, s.heading, s.claim
       FROM section_sources l JOIN sections s ON s.id = l.section_id
       WHERE l.source_id = ? ORDER BY l.id`,
    )
    .all(sourceId) as SourceLinkRow[];
}

// Sources with no section–source link.
export function unlinkedSources(paperId: number): Source[] {
  return getDb()
    .prepare(
      `SELECT s.* FROM sources s WHERE s.paper_id = ?
       AND NOT EXISTS (SELECT 1 FROM section_sources l WHERE l.source_id = s.id)
       ORDER BY s.created_at DESC, s.id DESC`,
    )
    .all(paperId) as Source[];
}
