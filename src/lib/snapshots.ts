// Snapshots: the whole outline (nodes, links, sources, images) as JSON, with a word count. Manual ones carry a
// label; an automatic one is taken once a day when the outline changed. Phase 6 adds the diff and restore.

import type { ImageRow, Link, OutlineNode, Snapshot, Source } from "./types.ts";
import { nowIso, type Db } from "./db.ts";
import { getOutline } from "./courses.ts";
import { loadImages, loadLinks, loadNodes, loadSources } from "./nodes.ts";
import { countWords, nodeText } from "./fields.ts";
import { newId } from "./ids.ts";

export type SnapshotTree = { nodes: OutlineNode[]; links: Link[]; sources: Source[]; images: ImageRow[] };

export function wordCountOf(nodes: OutlineNode[]): number {
  return nodes.reduce((n, node) => n + countWords(nodeText(node)), 0);
}

type Row = { id: string; outline_id: string; created_at: string; label: string; automatic: number; word_count: number };

function rowToSnapshot(r: Row): Snapshot {
  return { id: r.id, outlineId: r.outline_id, createdAt: r.created_at, label: r.label, automatic: r.automatic === 1, wordCount: r.word_count };
}

export function listSnapshots(db: Db, outlineId: string): Snapshot[] {
  return (db.prepare("SELECT id, outline_id, created_at, label, automatic, word_count FROM snapshots WHERE outline_id = ? ORDER BY created_at").all(outlineId) as Row[]).map(rowToSnapshot);
}

export function getSnapshotTree(db: Db, id: string): { snapshot: Snapshot; tree: SnapshotTree } | null {
  const row = db.prepare("SELECT * FROM snapshots WHERE id = ?").get(id) as (Row & { tree_json: string }) | undefined;
  if (!row) return null;
  let tree: SnapshotTree;
  try {
    const parsed = JSON.parse(row.tree_json) as Partial<SnapshotTree>;
    tree = { nodes: parsed.nodes ?? [], links: parsed.links ?? [], sources: parsed.sources ?? [], images: parsed.images ?? [] };
  } catch {
    tree = { nodes: [], links: [], sources: [], images: [] };
  }
  return { snapshot: rowToSnapshot(row), tree };
}

export function takeSnapshot(db: Db, outlineId: string, label: string, automatic = false): Snapshot | null {
  if (!getOutline(db, outlineId)) return null;
  const tree: SnapshotTree = { nodes: loadNodes(db, outlineId), links: loadLinks(db, outlineId), sources: loadSources(db, outlineId), images: loadImages(db, outlineId) };
  const id = newId();
  const now = nowIso();
  const words = wordCountOf(tree.nodes);
  db.prepare("INSERT INTO snapshots (id, outline_id, created_at, label, automatic, tree_json, word_count) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, outlineId, now, label, automatic ? 1 : 0, JSON.stringify(tree), words);
  return { id, outlineId, createdAt: now, label, automatic, wordCount: words };
}

export function deleteSnapshot(db: Db, id: string) {
  db.prepare("DELETE FROM snapshots WHERE id = ?").run(id);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Take an automatic snapshot when the last one is over a day old and the outline changed since. */
export function ensureDailySnapshot(db: Db, outlineId: string, now = new Date()): Snapshot | null {
  const outline = getOutline(db, outlineId);
  if (!outline) return null;
  const last = db.prepare("SELECT created_at FROM snapshots WHERE outline_id = ? ORDER BY created_at DESC LIMIT 1").get(outlineId) as { created_at: string } | undefined;
  if (last) {
    if (now.getTime() - new Date(last.created_at).getTime() < DAY_MS) return null;
    if (outline.updatedAt <= last.created_at) return null;
  }
  if (!last && loadNodes(db, outlineId).length === 0) return null;
  return takeSnapshot(db, outlineId, "", true);
}
