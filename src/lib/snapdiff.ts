// Comparing two snapshots and restoring one as a new outline (never over the current one).

import type { NodeMap, Outline, OutlineNode } from "./types.ts";
import type { Db } from "./db.ts";
import { nowIso } from "./db.ts";
import { createOutline, getOutline } from "./courses.ts";
import { upsertNodes } from "./nodes.ts";
import { newId } from "./ids.ts";
import { getSnapshotTree, type SnapshotTree } from "./snapshots.ts";
import { flatten } from "./tree.ts";

export type DiffStatus = "added" | "removed" | "changed" | "moved" | "same";
export type DiffEntry = { id: string; status: DiffStatus; before: OutlineNode | null; after: OutlineNode | null; changedFields: string[] };
export type SnapshotDiff = { entries: Record<string, DiffEntry>; added: number; removed: number; changed: number; moved: number };

function fieldsChanged(a: OutlineNode, b: OutlineNode): string[] {
  const out: string[] = [];
  if (a.title !== b.title) out.push("title");
  if (a.type !== b.type) out.push("type");
  if (a.status !== b.status) out.push("status");
  if (a.body !== b.body) out.push("notes");
  if (JSON.stringify(a.tags) !== JSON.stringify(b.tags)) out.push("tags");
  const keys = new Set([...Object.keys(a.fields), ...Object.keys(b.fields)]);
  for (const k of keys) if (JSON.stringify(a.fields[k]) !== JSON.stringify(b.fields[k])) out.push(k);
  return out;
}

/** Node-by-node comparison of two trees, by node id. */
export function diffTrees(a: SnapshotTree, b: SnapshotTree): SnapshotDiff {
  const am: NodeMap = {};
  for (const n of a.nodes) am[n.id] = n;
  const bm: NodeMap = {};
  for (const n of b.nodes) bm[n.id] = n;
  const entries: Record<string, DiffEntry> = {};
  let added = 0;
  let removed = 0;
  let changed = 0;
  let moved = 0;
  for (const n of a.nodes) {
    const after = bm[n.id];
    if (!after) {
      entries[n.id] = { id: n.id, status: "removed", before: n, after: null, changedFields: [] };
      removed++;
      continue;
    }
    const fields = fieldsChanged(n, after);
    const relocated = n.parentId !== after.parentId || n.position !== after.position;
    if (fields.length) {
      entries[n.id] = { id: n.id, status: "changed", before: n, after, changedFields: fields };
      changed++;
    } else if (relocated) {
      entries[n.id] = { id: n.id, status: "moved", before: n, after, changedFields: [] };
      moved++;
    } else entries[n.id] = { id: n.id, status: "same", before: n, after, changedFields: [] };
  }
  for (const n of b.nodes) {
    if (!am[n.id]) {
      entries[n.id] = { id: n.id, status: "added", before: null, after: n, changedFields: [] };
      added++;
    }
  }
  return { entries, added, removed, changed, moved };
}

/** Rows of a tree in document order, for the side-by-side view. */
export function treeRows(tree: SnapshotTree) {
  const map: NodeMap = {};
  for (const n of tree.nodes) map[n.id] = n;
  return flatten(map, false);
}

/** A new outline with the snapshot's content. Every id is fresh, so links and attack sources are remapped. */
export function restoreSnapshotAsOutline(db: Db, snapshotId: string, name: string): Outline | null {
  const found = getSnapshotTree(db, snapshotId);
  if (!found) return null;
  const source = getOutline(db, found.snapshot.outlineId);
  if (!source) return null;
  const outline = createOutline(db, source.courseId, { name: name.trim() || `${source.name} (restored)`, kind: source.kind === "scratch" ? "full" : source.kind, numbering: source.numbering });
  const idMap = new Map<string, string>();
  for (const n of found.tree.nodes) idMap.set(n.id, newId());
  const now = nowIso();
  const nodes: OutlineNode[] = found.tree.nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    outlineId: outline.id,
    parentId: n.parentId ? (idMap.get(n.parentId) ?? null) : null,
    fields: typeof n.fields.modifiesRule === "string" && idMap.has(n.fields.modifiesRule) ? { ...n.fields, modifiesRule: idMap.get(n.fields.modifiesRule) } : n.fields,
    updatedAt: now,
  }));
  upsertNodes(db, nodes);
  const link = db.prepare("INSERT INTO links (id, from_node, to_node, kind, note, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  const src = db.prepare("INSERT INTO sources (id, node_id, kind, reference, url, position) VALUES (?, ?, ?, ?, ?, ?)");
  const img = db.prepare("INSERT INTO images (id, node_id, file_path, caption, width_hint, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  db.transaction(() => {
    for (const l of found.tree.links) {
      const from = idMap.get(l.fromNode);
      const to = idMap.get(l.toNode);
      if (from && to) link.run(newId(), from, to, l.kind, l.note, now);
    }
    for (const s of found.tree.sources) {
      const node = idMap.get(s.nodeId);
      if (node) src.run(newId(), node, s.kind, s.reference, s.url, s.position);
    }
    for (const i of found.tree.images) {
      const node = idMap.get(i.nodeId);
      if (node) img.run(newId(), node, i.filePath, i.caption, i.widthHint, i.position, now);
    }
  })();
  return outline;
}
