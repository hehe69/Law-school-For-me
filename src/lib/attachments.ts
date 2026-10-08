// Links, sources, images, captures and cross-outline moves: the parts of a node the side panel edits directly
// (outside the tree sync) and the inbox.

import fs from "node:fs";
import path from "node:path";
import type { Capture, ImageRow, Link, LinkKind, Source, SourceKind } from "./types.ts";
import { LINK_KINDS, SOURCE_KINDS } from "./types.ts";
import { nowIso, type Db } from "./db.ts";
import { newId } from "./ids.ts";
import { getNode, rowToImage, rowToLink, rowToSource } from "./nodes.ts";
import { getOutline } from "./courses.ts";
import { UPLOADS_DIR } from "./paths.ts";
import { slugify } from "./slug.ts";

// ---- links ----------------------------------------------------------------------------------------------

export function createLink(db: Db, fromNode: string, toNode: string, kind: string, note = ""): Link | null {
  if (!getNode(db, fromNode) || !getNode(db, toNode) || fromNode === toNode) return null;
  const k: LinkKind = (LINK_KINDS as readonly string[]).includes(kind) ? (kind as LinkKind) : "see also";
  const id = newId();
  db.prepare("INSERT INTO links (id, from_node, to_node, kind, note, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(id, fromNode, toNode, k, note, nowIso());
  return getLink(db, id);
}

export function getLink(db: Db, id: string): Link | null {
  const row = db.prepare("SELECT * FROM links WHERE id = ?").get(id) as Parameters<typeof rowToLink>[0] | undefined;
  return row ? rowToLink(row) : null;
}

export function updateLink(db: Db, id: string, patch: { kind?: string; note?: string }): Link | null {
  const current = getLink(db, id);
  if (!current) return null;
  const kind = patch.kind && (LINK_KINDS as readonly string[]).includes(patch.kind) ? patch.kind : current.kind;
  db.prepare("UPDATE links SET kind = ?, note = ? WHERE id = ?").run(kind, patch.note ?? current.note, id);
  return getLink(db, id);
}

export function deleteLink(db: Db, id: string) {
  db.prepare("DELETE FROM links WHERE id = ?").run(id);
}

/** Links touching a node, either direction. */
export function linksForNode(db: Db, nodeId: string): Link[] {
  return (db.prepare("SELECT * FROM links WHERE from_node = ? OR to_node = ? ORDER BY created_at").all(nodeId, nodeId) as Parameters<typeof rowToLink>[0][]).map(rowToLink);
}

// ---- sources --------------------------------------------------------------------------------------------

export function createSource(db: Db, nodeId: string, kind: string, reference: string, url: string | null): Source | null {
  if (!getNode(db, nodeId)) return null;
  const k: SourceKind = (SOURCE_KINDS as readonly string[]).includes(kind) ? (kind as SourceKind) : "other";
  const id = newId();
  const position = (db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM sources WHERE node_id = ?").get(nodeId) as { n: number }).n;
  db.prepare("INSERT INTO sources (id, node_id, kind, reference, url, position) VALUES (?, ?, ?, ?, ?, ?)").run(id, nodeId, k, reference, url || null, position);
  return getSource(db, id);
}

export function getSource(db: Db, id: string): Source | null {
  const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as Parameters<typeof rowToSource>[0] | undefined;
  return row ? rowToSource(row) : null;
}

export function updateSource(db: Db, id: string, patch: { kind?: string; reference?: string; url?: string | null }): Source | null {
  const current = getSource(db, id);
  if (!current) return null;
  const kind = patch.kind && (SOURCE_KINDS as readonly string[]).includes(patch.kind) ? patch.kind : current.kind;
  db.prepare("UPDATE sources SET kind = ?, reference = ?, url = ? WHERE id = ?").run(kind, patch.reference ?? current.reference, patch.url !== undefined ? patch.url || null : current.url, id);
  return getSource(db, id);
}

export function deleteSource(db: Db, id: string) {
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
}

export function sourcesForNode(db: Db, nodeId: string): Source[] {
  return (db.prepare("SELECT * FROM sources WHERE node_id = ? ORDER BY position").all(nodeId) as Parameters<typeof rowToSource>[0][]).map(rowToSource);
}

// ---- images ---------------------------------------------------------------------------------------------

export const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"]);
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export function imageContentType(file: string): string {
  switch (path.extname(file).toLowerCase()) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

/** Save an uploaded image under uploads/<course-slug>/ and attach it to the node. */
export function saveImage(db: Db, nodeId: string, courseSlug: string, originalName: string, data: Buffer, caption = ""): ImageRow | null {
  if (!getNode(db, nodeId)) return null;
  let ext = path.extname(originalName || "").toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) ext = ".png";
  const base = slugify(path.basename(originalName || "image", path.extname(originalName || "")).slice(0, 40)) || "image";
  const dir = path.join(UPLOADS_DIR, courseSlug);
  fs.mkdirSync(dir, { recursive: true });
  const file = `${Date.now()}-${base}${ext}`;
  fs.writeFileSync(path.join(dir, file), data);
  const id = newId();
  const position = (db.prepare("SELECT COALESCE(MAX(position), -1) + 1 AS n FROM images WHERE node_id = ?").get(nodeId) as { n: number }).n;
  db.prepare("INSERT INTO images (id, node_id, file_path, caption, width_hint, position, created_at) VALUES (?, ?, ?, ?, NULL, ?, ?)").run(id, nodeId, `${courseSlug}/${file}`, caption, position, nowIso());
  return getImage(db, id);
}

export function getImage(db: Db, id: string): ImageRow | null {
  const row = db.prepare("SELECT * FROM images WHERE id = ?").get(id) as Parameters<typeof rowToImage>[0] | undefined;
  return row ? rowToImage(row) : null;
}

export function updateImage(db: Db, id: string, patch: { caption?: string; widthHint?: number | null; position?: number }): ImageRow | null {
  const current = getImage(db, id);
  if (!current) return null;
  const width = patch.widthHint !== undefined ? (typeof patch.widthHint === "number" && patch.widthHint > 0 ? Math.round(patch.widthHint) : null) : current.widthHint;
  db.prepare("UPDATE images SET caption = ?, width_hint = ?, position = ? WHERE id = ?").run(patch.caption ?? current.caption, width, patch.position ?? current.position, id);
  return getImage(db, id);
}

/** Remove the row and the file (if no other row still points at it). */
export function deleteImage(db: Db, id: string) {
  const current = getImage(db, id);
  if (!current) return;
  db.prepare("DELETE FROM images WHERE id = ?").run(id);
  const still = db.prepare("SELECT COUNT(*) AS n FROM images WHERE file_path = ?").get(current.filePath) as { n: number };
  if (still.n === 0) fs.rmSync(path.join(UPLOADS_DIR, current.filePath), { force: true });
}

export function imagesForNode(db: Db, nodeId: string): ImageRow[] {
  return (db.prepare("SELECT * FROM images WHERE node_id = ? ORDER BY position").all(nodeId) as Parameters<typeof rowToImage>[0][]).map(rowToImage);
}

/** Resolve a /files/<path> request to a file inside the uploads folder, or null when it escapes it. */
export function resolveUpload(segments: string[]): string | null {
  const rel = segments.join("/");
  if (!rel || rel.includes("\0")) return null;
  const full = path.resolve(UPLOADS_DIR, rel);
  if (full !== UPLOADS_DIR && !full.startsWith(UPLOADS_DIR + path.sep)) return null;
  return full;
}

// ---- moving a subtree to another outline ----------------------------------------------------------------

export type MoveResult = { ok: true; nodeId: string; outlineId: string } | { ok: false; error: string };

/**
 * Move `nodeId` with its subtree into `targetOutlineId` under `targetParentId` (null = top level) at `position`
 * (null = last). Used by the scratch outline's "move to" and by the inbox.
 */
export function moveSubtreeToOutline(db: Db, nodeId: string, targetOutlineId: string, targetParentId: string | null, position: number | null): MoveResult {
  const node = getNode(db, nodeId);
  if (!node) return { ok: false, error: "node not found" };
  const target = getOutline(db, targetOutlineId);
  if (!target) return { ok: false, error: "target outline not found" };
  const descendants = db
    .prepare(
      `WITH RECURSIVE sub(id) AS (SELECT id FROM nodes WHERE parent_id = ? UNION ALL SELECT n.id FROM nodes n JOIN sub ON n.parent_id = sub.id)
       SELECT id FROM sub`,
    )
    .all(nodeId) as { id: string }[];
  const subtree = new Set([nodeId, ...descendants.map((d) => d.id)]);
  if (targetParentId !== null) {
    const parent = getNode(db, targetParentId);
    if (!parent || parent.outlineId !== targetOutlineId) return { ok: false, error: "target parent is not in the target outline" };
    if (subtree.has(targetParentId)) return { ok: false, error: "cannot move a node inside itself" };
  }
  const now = nowIso();
  db.transaction(() => {
    const siblings = db
      .prepare(`SELECT id FROM nodes WHERE outline_id = ? AND parent_id IS ? AND id != ? ORDER BY position, created_at`)
      .all(targetOutlineId, targetParentId, nodeId) as { id: string }[];
    const at = position === null ? siblings.length : Math.max(0, Math.min(position, siblings.length));
    const order = [...siblings.slice(0, at), { id: nodeId }, ...siblings.slice(at)];
    const setPos = db.prepare("UPDATE nodes SET position = ? WHERE id = ?");
    order.forEach((s, i) => setPos.run(i, s.id));
    db.prepare("UPDATE nodes SET outline_id = ?, parent_id = ?, updated_at = ? WHERE id = ?").run(targetOutlineId, targetParentId, now, nodeId);
    const setOutline = db.prepare("UPDATE nodes SET outline_id = ? WHERE id = ?");
    for (const d of descendants) setOutline.run(targetOutlineId, d.id);
    // Compact the positions the node left behind.
    const old = db
      .prepare(`SELECT id FROM nodes WHERE outline_id = ? AND parent_id IS ? ORDER BY position, created_at`)
      .all(node.outlineId, node.parentId) as { id: string }[];
    old.forEach((s, i) => setPos.run(i, s.id));
    db.prepare("UPDATE outlines SET updated_at = ? WHERE id IN (?, ?)").run(now, node.outlineId, targetOutlineId);
  })();
  return { ok: true, nodeId, outlineId: targetOutlineId };
}

// ---- captures (inbox) -----------------------------------------------------------------------------------

type CaptureRow = { id: number; course_id: number; text: string; created_at: string; filed: number; filed_node_id: string | null };

function rowToCapture(r: CaptureRow): Capture {
  return { id: r.id, courseId: r.course_id, text: r.text, createdAt: r.created_at, filed: r.filed === 1, filedNodeId: r.filed_node_id };
}

export function addCapture(db: Db, courseId: number, text: string): Capture {
  const result = db.prepare("INSERT INTO captures (course_id, text, created_at, filed) VALUES (?, ?, ?, 0)").run(courseId, text.trim(), nowIso());
  return getCapture(db, Number(result.lastInsertRowid))!;
}

export function getCapture(db: Db, id: number): Capture | null {
  const row = db.prepare("SELECT * FROM captures WHERE id = ?").get(id) as CaptureRow | undefined;
  return row ? rowToCapture(row) : null;
}

export function listCaptures(db: Db, courseId: number): Capture[] {
  return (db.prepare("SELECT * FROM captures WHERE course_id = ? ORDER BY filed, created_at DESC").all(courseId) as CaptureRow[]).map(rowToCapture);
}

export function countUnfiled(db: Db): Record<number, number> {
  const rows = db.prepare("SELECT course_id, COUNT(*) AS n FROM captures WHERE filed = 0 GROUP BY course_id").all() as { course_id: number; n: number }[];
  return Object.fromEntries(rows.map((r) => [r.course_id, r.n]));
}

export function markCaptureFiled(db: Db, id: number, nodeId: string | null) {
  db.prepare("UPDATE captures SET filed = 1, filed_node_id = ? WHERE id = ?").run(nodeId, id);
}

export function deleteCapture(db: Db, id: number) {
  db.prepare("DELETE FROM captures WHERE id = ?").run(id);
}
