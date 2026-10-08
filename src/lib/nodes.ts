// Nodes, links, sources and images: loading an outline for the editor and applying the editor's sync batches.

import type { ImageRow, Link, NodeStatus, NodeType, OutlineBundle, OutlineNode, Source, SyncRequest } from "./types.ts";
import { LINK_KINDS, NODE_STATUSES, NODE_TYPES, SOURCE_KINDS } from "./types.ts";
import { nowIso, type Db } from "./db.ts";
import { getCourse, getOutline, touchOutline } from "./courses.ts";

type NodeRow = {
  id: string;
  outline_id: string;
  parent_id: string | null;
  position: number;
  type: string;
  status: string;
  title: string;
  body: string;
  fields: string;
  tags: string;
  collapsed: number;
  pinned: number;
  flashcard: number;
  linked_note_path: string | null;
  linked_element_index: number | null;
  linked_note_hash: string | null;
  source_node_id: string | null;
  source_hash: string | null;
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function rowToNode(r: NodeRow): OutlineNode {
  const fields = parseJson<unknown>(r.fields, {});
  const tags = parseJson<unknown>(r.tags, []);
  return {
    id: r.id,
    outlineId: r.outline_id,
    parentId: r.parent_id,
    position: r.position,
    type: (NODE_TYPES as readonly string[]).includes(r.type) ? (r.type as NodeType) : "free",
    status: (NODE_STATUSES as readonly string[]).includes(r.status) ? (r.status as NodeStatus) : "empty",
    title: r.title,
    body: r.body,
    fields: isRecord(fields) ? fields : {},
    tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : [],
    collapsed: r.collapsed === 1,
    pinned: r.pinned === 1,
    flashcard: r.flashcard === 1,
    linkedNotePath: r.linked_note_path,
    linkedElementIndex: r.linked_element_index,
    linkedNoteHash: r.linked_note_hash,
    sourceNodeId: r.source_node_id,
    sourceHash: r.source_hash,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function loadNodes(db: Db, outlineId: string): OutlineNode[] {
  return (db.prepare("SELECT * FROM nodes WHERE outline_id = ? ORDER BY parent_id, position").all(outlineId) as NodeRow[]).map(rowToNode);
}

export function getNode(db: Db, id: string): OutlineNode | null {
  const row = db.prepare("SELECT * FROM nodes WHERE id = ?").get(id) as NodeRow | undefined;
  return row ? rowToNode(row) : null;
}

type LinkRow = { id: string; from_node: string; to_node: string; kind: string; note: string; created_at: string };
type SourceRow = { id: string; node_id: string; kind: string; reference: string; url: string | null; position: number };
type ImageRowDb = { id: string; node_id: string; file_path: string; caption: string; width_hint: number | null; position: number; created_at: string };

export function rowToLink(r: LinkRow): Link {
  return { id: r.id, fromNode: r.from_node, toNode: r.to_node, kind: (LINK_KINDS as readonly string[]).includes(r.kind) ? (r.kind as Link["kind"]) : "see also", note: r.note, createdAt: r.created_at };
}

export function rowToSource(r: SourceRow): Source {
  return { id: r.id, nodeId: r.node_id, kind: (SOURCE_KINDS as readonly string[]).includes(r.kind) ? (r.kind as Source["kind"]) : "other", reference: r.reference, url: r.url, position: r.position };
}

export function rowToImage(r: ImageRowDb): ImageRow {
  return { id: r.id, nodeId: r.node_id, filePath: r.file_path, caption: r.caption, widthHint: r.width_hint, position: r.position, createdAt: r.created_at };
}

export function loadLinks(db: Db, outlineId: string): Link[] {
  return (
    db
      .prepare(
        `SELECT l.* FROM links l JOIN nodes a ON a.id = l.from_node JOIN nodes b ON b.id = l.to_node
         WHERE a.outline_id = ? OR b.outline_id = ? ORDER BY l.created_at`,
      )
      .all(outlineId, outlineId) as LinkRow[]
  ).map(rowToLink);
}

export function loadSources(db: Db, outlineId: string): Source[] {
  return (db.prepare(`SELECT s.* FROM sources s JOIN nodes n ON n.id = s.node_id WHERE n.outline_id = ? ORDER BY s.node_id, s.position`).all(outlineId) as SourceRow[]).map(rowToSource);
}

export function loadImages(db: Db, outlineId: string): ImageRow[] {
  return (db.prepare(`SELECT i.* FROM images i JOIN nodes n ON n.id = i.node_id WHERE n.outline_id = ? ORDER BY i.node_id, i.position`).all(outlineId) as ImageRowDb[]).map(rowToImage);
}

/** Everything the editor needs for one outline, or null when the outline does not exist. */
export function loadBundle(db: Db, outlineId: string): OutlineBundle | null {
  const outline = getOutline(db, outlineId);
  if (!outline) return null;
  const course = getCourse(db, outline.courseId);
  if (!course) return null;
  return { course, outline, nodes: loadNodes(db, outlineId), links: loadLinks(db, outlineId), sources: loadSources(db, outlineId), images: loadImages(db, outlineId) };
}

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const optStr = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const optInt = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : null);

/** Coerce whatever the client sent into a well-formed node for `outlineId`, or null when unusable. */
export function sanitizeNode(raw: unknown, outlineId: string, now: string): OutlineNode | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  if (!id || id.length > 64) return null;
  const type = (NODE_TYPES as readonly string[]).includes(str(raw.type)) ? (raw.type as NodeType) : "free";
  const status = (NODE_STATUSES as readonly string[]).includes(str(raw.status)) ? (raw.status as NodeStatus) : "empty";
  const fields = raw.fields;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean) : [];
  return {
    id,
    outlineId,
    parentId: optStr(raw.parentId),
    position: optInt(raw.position) ?? 0,
    type,
    status,
    title: str(raw.title),
    body: str(raw.body),
    fields: isRecord(fields) ? fields : {},
    tags: Array.from(new Set(tags)),
    collapsed: raw.collapsed === true,
    pinned: raw.pinned === true,
    flashcard: raw.flashcard === true,
    linkedNotePath: optStr(raw.linkedNotePath),
    linkedElementIndex: optInt(raw.linkedElementIndex),
    linkedNoteHash: optStr(raw.linkedNoteHash),
    sourceNodeId: optStr(raw.sourceNodeId),
    sourceHash: optStr(raw.sourceHash),
    createdAt: str(raw.createdAt) || now,
    updatedAt: str(raw.updatedAt) || now,
  };
}

const UPSERT_SQL = `
INSERT INTO nodes (id, outline_id, parent_id, position, type, status, title, body, fields, tags, collapsed, pinned, flashcard,
  linked_note_path, linked_element_index, linked_note_hash, source_node_id, source_hash, created_at, updated_at)
VALUES (@id, @outline_id, @parent_id, @position, @type, @status, @title, @body, @fields, @tags, @collapsed, @pinned, @flashcard,
  @linked_note_path, @linked_element_index, @linked_note_hash, @source_node_id, @source_hash, @created_at, @updated_at)
ON CONFLICT(id) DO UPDATE SET
  parent_id = excluded.parent_id, position = excluded.position, type = excluded.type, status = excluded.status,
  title = excluded.title, body = excluded.body, fields = excluded.fields, tags = excluded.tags, collapsed = excluded.collapsed,
  pinned = excluded.pinned, flashcard = excluded.flashcard, linked_note_path = excluded.linked_note_path,
  linked_element_index = excluded.linked_element_index, linked_note_hash = excluded.linked_note_hash,
  source_node_id = excluded.source_node_id, source_hash = excluded.source_hash, updated_at = excluded.updated_at
WHERE nodes.outline_id = excluded.outline_id`;

function nodeParams(n: OutlineNode) {
  return {
    id: n.id,
    outline_id: n.outlineId,
    parent_id: n.parentId,
    position: n.position,
    type: n.type,
    status: n.status,
    title: n.title,
    body: n.body,
    fields: JSON.stringify(n.fields),
    tags: JSON.stringify(n.tags),
    collapsed: n.collapsed ? 1 : 0,
    pinned: n.pinned ? 1 : 0,
    flashcard: n.flashcard ? 1 : 0,
    linked_note_path: n.linkedNotePath,
    linked_element_index: n.linkedElementIndex,
    linked_note_hash: n.linkedNoteHash,
    source_node_id: n.sourceNodeId,
    source_hash: n.sourceHash,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
}

/** Insert or update a list of nodes (parents may come after children: foreign keys are deferred). */
export function upsertNodes(db: Db, nodes: OutlineNode[]) {
  const stmt = db.prepare(UPSERT_SQL);
  db.transaction(() => {
    db.pragma("defer_foreign_keys = ON");
    for (const n of nodes) stmt.run(nodeParams(n));
  })();
}

export function deleteNodes(db: Db, outlineId: string, ids: string[]) {
  const stmt = db.prepare("DELETE FROM nodes WHERE id = ? AND outline_id = ?");
  db.transaction(() => {
    for (const id of ids) stmt.run(id, outlineId);
  })();
}

/** Apply one sync batch from the editor. Returns the save time, or null when the outline does not exist. */
export function applySync(db: Db, outlineId: string, raw: unknown): { savedAt: string; upserted: number; deleted: number } | null {
  if (!getOutline(db, outlineId)) return null;
  const now = nowIso();
  const body = isRecord(raw) ? (raw as Partial<SyncRequest>) : {};
  const upserts = Array.isArray(body.upserts) ? body.upserts.map((n) => sanitizeNode(n, outlineId, now)).filter((n): n is OutlineNode => n !== null) : [];
  const deletes = Array.isArray(body.deletes) ? body.deletes.filter((d): d is string => typeof d === "string") : [];
  const upsertStmt = db.prepare(UPSERT_SQL);
  const deleteStmt = db.prepare("DELETE FROM nodes WHERE id = ? AND outline_id = ?");
  db.transaction(() => {
    db.pragma("defer_foreign_keys = ON");
    for (const id of deletes) deleteStmt.run(id, outlineId);
    for (const n of upserts) upsertStmt.run(nodeParams(n));
    touchOutline(db, outlineId);
  })();
  return { savedAt: now, upserted: upserts.length, deleted: deletes.length };
}
