import { getDb } from "../db";
import type { Tag } from "../types";

export function listTags(paperId: number): Tag[] {
  return getDb().prepare("SELECT * FROM tags WHERE paper_id = ? ORDER BY name").all(paperId) as Tag[];
}

// Parse "a, b, c" into distinct trimmed names.
export function parseTagNames(raw: string): string[] {
  const names = raw
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);
  return Array.from(new Set(names.map((n) => n.toLowerCase()))).map((lower) => names.find((n) => n.toLowerCase() === lower)!);
}

export function ensureTags(paperId: number, names: string[]): number[] {
  const db = getDb();
  const ids: number[] = [];
  for (const name of names) {
    const existing = db.prepare("SELECT id FROM tags WHERE paper_id = ? AND name = ? COLLATE NOCASE").get(paperId, name) as
      | { id: number }
      | undefined;
    if (existing) ids.push(existing.id);
    else ids.push(Number(db.prepare("INSERT INTO tags (paper_id, name) VALUES (?, ?)").run(paperId, name).lastInsertRowid));
  }
  return ids;
}

export function setSourceTags(sourceId: number, paperId: number, raw: string) {
  const db = getDb();
  const ids = ensureTags(paperId, parseTagNames(raw));
  db.transaction(() => {
    db.prepare("DELETE FROM source_tags WHERE source_id = ?").run(sourceId);
    const ins = db.prepare("INSERT OR IGNORE INTO source_tags (source_id, tag_id) VALUES (?, ?)");
    ids.forEach((t) => ins.run(sourceId, t));
  })();
}

export function setExtractTags(extractId: number, paperId: number, raw: string) {
  const db = getDb();
  const ids = ensureTags(paperId, parseTagNames(raw));
  db.transaction(() => {
    db.prepare("DELETE FROM extract_tags WHERE extract_id = ?").run(extractId);
    const ins = db.prepare("INSERT OR IGNORE INTO extract_tags (extract_id, tag_id) VALUES (?, ?)");
    ids.forEach((t) => ins.run(extractId, t));
  })();
}

export function sourceTagMap(paperId: number): Map<number, string[]> {
  const rows = getDb()
    .prepare(
      `SELECT st.source_id, t.name FROM source_tags st JOIN tags t ON t.id = st.tag_id
       WHERE t.paper_id = ? ORDER BY t.name`,
    )
    .all(paperId) as { source_id: number; name: string }[];
  const map = new Map<number, string[]>();
  for (const r of rows) map.set(r.source_id, [...(map.get(r.source_id) ?? []), r.name]);
  return map;
}

export function extractTagMap(paperId: number): Map<number, string[]> {
  const rows = getDb()
    .prepare(
      `SELECT et.extract_id, t.name FROM extract_tags et JOIN tags t ON t.id = et.tag_id
       WHERE t.paper_id = ? ORDER BY t.name`,
    )
    .all(paperId) as { extract_id: number; name: string }[];
  const map = new Map<number, string[]>();
  for (const r of rows) map.set(r.extract_id, [...(map.get(r.extract_id) ?? []), r.name]);
  return map;
}
