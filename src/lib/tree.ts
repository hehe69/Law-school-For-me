// Pure operations on the outline tree. A tree is a NodeMap (id -> node); parent links and positions live on the
// nodes. Every function returns a new map (structural sharing, untouched nodes keep their identity) or null when
// the operation is not possible, and never mutates its input. No imports beyond types, so the editor, the
// server and the tests all share this file.

import type { NodeMap, OutlineNode } from "./types.ts";

export type Row = {
  node: OutlineNode;
  depth: number;
  /** 0-based sibling index of each ancestor, then the node's own index */
  path: number[];
  hasChildren: boolean;
};

function compareSiblings(a: OutlineNode, b: OutlineNode): number {
  return a.position - b.position || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

/** parentId -> children in order. Children of a missing parent are attached to the root so nothing disappears. */
export function childIndex(nodes: NodeMap): Map<string | null, OutlineNode[]> {
  const index = new Map<string | null, OutlineNode[]>();
  for (const node of Object.values(nodes)) {
    const parent = node.parentId !== null && nodes[node.parentId] ? node.parentId : null;
    let list = index.get(parent);
    if (!list) {
      list = [];
      index.set(parent, list);
    }
    list.push(node);
  }
  for (const list of index.values()) list.sort(compareSiblings);
  return index;
}

export function childrenOf(nodes: NodeMap, parentId: string | null): OutlineNode[] {
  return childIndex(nodes).get(parentId) ?? [];
}

/** Depth-first rows. With `respectCollapsed`, the descendants of collapsed nodes are left out. */
export function flatten(nodes: NodeMap, respectCollapsed = true, rootId: string | null = null): Row[] {
  const index = childIndex(nodes);
  const rows: Row[] = [];
  const walk = (parentId: string | null, depth: number, prefix: number[]) => {
    const kids = index.get(parentId) ?? [];
    kids.forEach((node, i) => {
      const path = [...prefix, i];
      const hasChildren = (index.get(node.id)?.length ?? 0) > 0;
      rows.push({ node, depth, path, hasChildren });
      if (!respectCollapsed || !node.collapsed) walk(node.id, depth + 1, path);
    });
  };
  if (rootId === null) walk(null, 0, []);
  else {
    const root = nodes[rootId];
    if (root) {
      rows.push({ node: root, depth: 0, path: [0], hasChildren: (index.get(rootId)?.length ?? 0) > 0 });
      if (!respectCollapsed || !root.collapsed) walk(rootId, 1, [0]);
    }
  }
  return rows;
}

/** Ids of every descendant of `id`, depth first. */
export function descendantIds(nodes: NodeMap, id: string): string[] {
  const index = childIndex(nodes);
  const out: string[] = [];
  const walk = (parent: string) => {
    for (const child of index.get(parent) ?? []) {
      out.push(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

export function ancestorIds(nodes: NodeMap, id: string): string[] {
  const out: string[] = [];
  let cur = nodes[id]?.parentId ?? null;
  const seen = new Set<string>();
  while (cur !== null && nodes[cur] && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = nodes[cur].parentId;
  }
  return out;
}

export function depthOf(nodes: NodeMap, id: string): number {
  return ancestorIds(nodes, id).length;
}

export function isDescendantOf(nodes: NodeMap, id: string, ancestor: string): boolean {
  return ancestorIds(nodes, id).includes(ancestor);
}

/**
 * Give `siblings` positions 0..n-1 in the order given, under `parentId`. Only changed nodes are copied. The
 * sibling objects may be stale (taken before an earlier step), so the current node is always read from the map.
 */
function assignPositions(nodes: NodeMap, parentId: string | null, siblings: OutlineNode[], now: string, moved: Set<string>): NodeMap {
  const out: NodeMap = { ...nodes };
  siblings.forEach((s, i) => {
    const node = out[s.id] ?? s;
    if (node.position !== i || node.parentId !== parentId || moved.has(node.id)) {
      out[node.id] = { ...node, position: i, parentId, updatedAt: moved.has(node.id) ? now : node.updatedAt };
    }
  });
  return out;
}

function stamp(now?: string): string {
  return now ?? new Date().toISOString();
}

/** Insert a new node under `parentId` at `index` (clamped). Siblings after it shift down. */
export function insertNode(nodes: NodeMap, node: OutlineNode, parentId: string | null, index: number, now?: string): NodeMap {
  const t = stamp(now);
  const siblings = childrenOf(nodes, parentId).filter((n) => n.id !== node.id);
  const at = Math.max(0, Math.min(index, siblings.length));
  const placed: OutlineNode = { ...node, parentId, updatedAt: t };
  siblings.splice(at, 0, placed);
  const base: NodeMap = { ...nodes, [node.id]: placed };
  return assignPositions(base, parentId, siblings, t, new Set([node.id]));
}

/** Remove a node and everything under it. */
export function removeSubtree(nodes: NodeMap, id: string, now?: string): { nodes: NodeMap; removed: string[] } {
  const target = nodes[id];
  if (!target) return { nodes, removed: [] };
  const removed = [id, ...descendantIds(nodes, id)];
  const out: NodeMap = { ...nodes };
  for (const r of removed) delete out[r];
  const siblings = childrenOf(out, target.parentId);
  return { nodes: assignPositions(out, target.parentId, siblings, stamp(now), new Set()), removed };
}

/** Move a node with its subtree under `newParentId` at `newIndex`. Null when it would move into itself. */
export function moveSubtree(nodes: NodeMap, id: string, newParentId: string | null, newIndex: number, now?: string): NodeMap | null {
  const node = nodes[id];
  if (!node) return null;
  if (newParentId === id) return null;
  if (newParentId !== null && (!nodes[newParentId] || isDescendantOf(nodes, newParentId, id))) return null;
  const t = stamp(now);
  // Take it out of its old sibling list first, then slot it into the new one (which may be the same list).
  const oldSiblings = childrenOf(nodes, node.parentId).filter((n) => n.id !== id);
  let out = assignPositions(nodes, node.parentId, oldSiblings, t, new Set());
  const newSiblings = (node.parentId === newParentId ? oldSiblings : childrenOf(out, newParentId)).filter((n) => n.id !== id);
  const at = Math.max(0, Math.min(newIndex, newSiblings.length));
  const moved: OutlineNode = { ...out[id], parentId: newParentId, updatedAt: t };
  newSiblings.splice(at, 0, moved);
  out = { ...out, [id]: moved };
  return assignPositions(out, newParentId, newSiblings, t, new Set([id]));
}

/** Tab: the node becomes the last child of its previous sibling. Null when it has none. */
export function indentNode(nodes: NodeMap, id: string, now?: string): NodeMap | null {
  const node = nodes[id];
  if (!node) return null;
  const siblings = childrenOf(nodes, node.parentId);
  const i = siblings.findIndex((n) => n.id === id);
  if (i <= 0) return null;
  const prev = siblings[i - 1];
  const out = moveSubtree(nodes, id, prev.id, childrenOf(nodes, prev.id).length, now);
  if (!out) return null;
  // Indenting into a collapsed sibling would hide the node; open it.
  if (out[prev.id].collapsed) out[prev.id] = { ...out[prev.id], collapsed: false };
  return out;
}

/** Shift-Tab: the node moves out to sit right after its parent. Null at the top level. */
export function outdentNode(nodes: NodeMap, id: string, now?: string): NodeMap | null {
  const node = nodes[id];
  if (!node || node.parentId === null) return null;
  const parent = nodes[node.parentId];
  if (!parent) return null;
  const parentSiblings = childrenOf(nodes, parent.parentId);
  const parentIndex = parentSiblings.findIndex((n) => n.id === parent.id);
  return moveSubtree(nodes, id, parent.parentId, parentIndex + 1, now);
}

/** The node's children take its place among its siblings (used by "move without children"). */
export function promoteChildren(nodes: NodeMap, id: string, now?: string): NodeMap {
  const node = nodes[id];
  if (!node) return nodes;
  const kids = childrenOf(nodes, id);
  if (kids.length === 0) return nodes;
  const t = stamp(now);
  const siblings = childrenOf(nodes, node.parentId);
  const i = siblings.findIndex((n) => n.id === id);
  const reordered = [...siblings.slice(0, i + 1), ...kids, ...siblings.slice(i + 1)];
  const moved = new Set(kids.map((k) => k.id));
  const base: NodeMap = { ...nodes };
  for (const k of kids) base[k.id] = { ...k, parentId: node.parentId };
  return assignPositions(base, node.parentId, reordered, t, moved);
}

/**
 * Cmd-Up / Cmd-Down. With `withChildren` (or when the node is collapsed) the whole subtree swaps places with
 * the neighbouring sibling. Without, the children stay where they are (they are promoted into the node's old
 * place) and only the node itself moves. Null when there is no neighbour in that direction.
 */
export function moveAmongSiblings(nodes: NodeMap, id: string, delta: -1 | 1, withChildren: boolean, now?: string): NodeMap | null {
  const node = nodes[id];
  if (!node) return null;
  const carry = withChildren || node.collapsed;
  const base = carry ? nodes : promoteChildren(nodes, id, now);
  const siblings = childrenOf(base, node.parentId);
  const i = siblings.findIndex((n) => n.id === id);
  const target = i + delta;
  if (target < 0 || target >= siblings.length) {
    // Nothing to swap with. If the children were promoted, keep that result only when something else moved.
    return carry ? null : base === nodes ? null : base;
  }
  // When moving down past promoted children they sit right after the node, so skip over them as a block.
  let insertAt = target;
  if (!carry && delta === 1) {
    const kids = childrenOf(nodes, id).length;
    insertAt = Math.min(siblings.length - 1, i + kids + 1);
  }
  return moveSubtree(base, id, node.parentId, insertAt, now);
}

/** Collapse everything deeper than `level` (1 = only top-level rows visible). Level 0 or less expands all. */
export function collapseToLevel(nodes: NodeMap, level: number): NodeMap {
  const out: NodeMap = { ...nodes };
  for (const row of flatten(nodes, false)) {
    const shouldCollapse = level > 0 && row.hasChildren && row.depth >= level - 1;
    if (row.node.collapsed !== shouldCollapse) out[row.node.id] = { ...row.node, collapsed: shouldCollapse };
  }
  return out;
}

/** Expand every ancestor of `id` so it is visible. */
export function revealNode(nodes: NodeMap, id: string): NodeMap {
  const out: NodeMap = { ...nodes };
  for (const a of ancestorIds(nodes, id)) if (out[a].collapsed) out[a] = { ...out[a], collapsed: false };
  return out;
}

/** The deepest level present (1 for a flat list, 0 for an empty tree). */
export function maxDepth(nodes: NodeMap): number {
  let max = 0;
  for (const row of flatten(nodes, false)) max = Math.max(max, row.depth + 1);
  return max;
}

/** Which nodes differ between two maps: ids to upsert (new or changed) and ids to delete. */
export function diffNodes(before: NodeMap, after: NodeMap): { upserts: OutlineNode[]; deletes: string[] } {
  const upserts: OutlineNode[] = [];
  const deletes: string[] = [];
  for (const [id, node] of Object.entries(after)) {
    const prev = before[id];
    if (!prev || !sameNode(prev, node)) upserts.push(node);
  }
  for (const id of Object.keys(before)) if (!after[id]) deletes.push(id);
  return { upserts, deletes };
}

export function sameNode(a: OutlineNode, b: OutlineNode): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.outlineId === b.outlineId &&
    a.parentId === b.parentId &&
    a.position === b.position &&
    a.type === b.type &&
    a.status === b.status &&
    a.title === b.title &&
    a.body === b.body &&
    a.collapsed === b.collapsed &&
    a.pinned === b.pinned &&
    a.flashcard === b.flashcard &&
    a.linkedNotePath === b.linkedNotePath &&
    a.linkedElementIndex === b.linkedElementIndex &&
    a.linkedNoteHash === b.linkedNoteHash &&
    a.sourceNodeId === b.sourceNodeId &&
    a.sourceHash === b.sourceHash &&
    a.updatedAt === b.updatedAt &&
    a.tags.length === b.tags.length &&
    a.tags.every((t, i) => t === b.tags[i]) &&
    JSON.stringify(a.fields) === JSON.stringify(b.fields)
  );
}
