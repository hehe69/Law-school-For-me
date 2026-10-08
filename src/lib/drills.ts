// Hypo and recite drills: what to drill in a branch, storing right / wrong, and the colour each node earns
// from its recent recite results ("know it cold" / "shaky" / "untested").

import type { DrillResult, NodeMap, OutlineNode } from "./types.ts";
import { nowIso, type Db } from "./db.ts";
import { descendantIds } from "./tree.ts";

export type DrillMode = "recite" | "hypo";
export type Mastery = "cold" | "shaky";

/** Nodes of `type` in the branch under `rootId` (the root included), in document order. */
export function drillTargets(nodes: NodeMap, rootId: string | null, type: OutlineNode["type"]): OutlineNode[] {
  const ids = rootId ? [rootId, ...descendantIds(nodes, rootId)] : Object.keys(nodes);
  const picked = ids.map((id) => nodes[id]).filter((n) => n && n.type === type);
  if (rootId) return picked;
  // Whole outline: document order.
  return picked.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function recordDrill(db: Db, nodeId: string, mode: DrillMode, correct: boolean): DrillResult {
  const now = nowIso();
  const r = db.prepare("INSERT INTO drill_results (node_id, mode, correct, created_at) VALUES (?, ?, ?, ?)").run(nodeId, mode, correct ? 1 : 0, now);
  return { id: Number(r.lastInsertRowid), nodeId, mode, correct, createdAt: now };
}

type Row = { id: number; node_id: string; mode: DrillMode; correct: number; created_at: string };

export function drillHistory(db: Db, nodeId: string, mode?: DrillMode): DrillResult[] {
  const rows = (mode
    ? db.prepare("SELECT * FROM drill_results WHERE node_id = ? AND mode = ? ORDER BY created_at DESC").all(nodeId, mode)
    : db.prepare("SELECT * FROM drill_results WHERE node_id = ? ORDER BY created_at DESC").all(nodeId)) as Row[];
  return rows.map((r) => ({ id: r.id, nodeId: r.node_id, mode: r.mode, correct: r.correct === 1, createdAt: r.created_at }));
}

/** From the latest results (newest first): cold = at least two tries and the last three all right; shaky = any wrong among the last three. */
export function masteryOf(results: { correct: boolean }[]): Mastery | null {
  const recent = results.slice(0, 3);
  if (recent.length === 0) return null;
  if (recent.some((r) => !r.correct)) return "shaky";
  return recent.length >= 2 ? "cold" : "shaky";
}

export type MasteryMap = Record<string, { mastery: Mastery; right: number; wrong: number; last: string }>;

/** Mastery for every node of an outline that has drill results of `mode`. */
export function masteryForOutline(db: Db, outlineId: string, mode: DrillMode = "recite"): MasteryMap {
  const rows = db
    .prepare(`SELECT d.* FROM drill_results d JOIN nodes n ON n.id = d.node_id WHERE n.outline_id = ? AND d.mode = ? ORDER BY d.created_at DESC`)
    .all(outlineId, mode) as Row[];
  const byNode = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byNode.get(r.node_id) ?? [];
    list.push(r);
    byNode.set(r.node_id, list);
  }
  const out: MasteryMap = {};
  for (const [nodeId, list] of byNode) {
    const mastery = masteryOf(list.map((r) => ({ correct: r.correct === 1 })));
    if (!mastery) continue;
    out[nodeId] = { mastery, right: list.filter((r) => r.correct === 1).length, wrong: list.filter((r) => r.correct === 0).length, last: list[0].created_at };
  }
  return out;
}
