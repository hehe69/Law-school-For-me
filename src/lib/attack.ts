// Attack outlines: generated from a full outline with options, as a separate editable outline whose lines
// remember the full-outline node they came from. Regenerating keeps edited lines where the source is
// unchanged, overwrites untouched lines, adds new sources, and flags lines whose source changed or vanished.

import crypto from "node:crypto";
import type { NodeMap, NodeStatus, Outline, OutlineNode } from "./types.ts";
import { nowIso, type Db } from "./db.ts";
import { createOutline, getOutline, updateOutline } from "./courses.ts";
import { loadNodes, upsertNodes } from "./nodes.ts";
import { makeNode } from "./nodeFactory.ts";
import { childrenOf, flatten } from "./tree.ts";

export type AttackMode = "headings" | "headings-rules";

export type AttackOptions = {
  mode: AttackMode;
  /** Keep only the top N levels (1 = top level only); null = all */
  maxDepth: number | null;
  /** Keep only nodes tagged with one of these (plus their ancestors); empty = all */
  tags: string[];
  /** Keep only nodes with status "final" (plus their ancestors) */
  onlyFinal: boolean;
};

export const DEFAULT_ATTACK_OPTIONS: AttackOptions = { mode: "headings-rules", maxDepth: null, tags: [], onlyFinal: false };

export function parseAttackOptions(raw: unknown): AttackOptions {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Partial<Record<keyof AttackOptions, unknown>>;
  return {
    mode: r.mode === "headings" ? "headings" : "headings-rules",
    maxDepth: typeof r.maxDepth === "number" && r.maxDepth >= 1 ? Math.floor(r.maxDepth) : null,
    tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string" && t.trim() !== "") : [],
    onlyFinal: r.onlyFinal === true,
  };
}

/** Hash of what the attack line copies from a source node, so a later change is detectable. */
export function contentHash(node: Pick<OutlineNode, "title" | "type" | "status" | "fields" | "body" | "tags">): string {
  return crypto.createHash("sha1").update(JSON.stringify([node.title, node.type, node.status, node.fields, node.body, node.tags])).digest("hex");
}

/** Which full-outline nodes an attack outline includes, in document order, with their depth. */
export function selectSources(full: NodeMap, options: AttackOptions): OutlineNode[] {
  const rows = flatten(full, false);
  const wanted = new Set<string>();
  const tagSet = new Set(options.tags.map((t) => t.toLowerCase()));
  const matches = (n: OutlineNode) => (!tagSet.size || n.tags.some((t) => tagSet.has(t.toLowerCase()))) && (!options.onlyFinal || n.status === "final");
  // A node is kept when it matches or any descendant matches; ancestors come along for structure.
  const keep = new Map<string, boolean>();
  const visit = (id: string): boolean => {
    const node = full[id];
    let any = matches(node);
    for (const c of childrenOf(full, id)) if (visit(c.id)) any = true;
    keep.set(id, any);
    return any;
  };
  for (const top of childrenOf(full, null)) visit(top.id);
  for (const r of rows) {
    if (options.maxDepth !== null && r.depth >= options.maxDepth) continue;
    if (!keep.get(r.node.id)) continue;
    if (r.node.parentId !== null && !wanted.has(r.node.parentId)) continue;
    wanted.add(r.node.id);
  }
  return rows.filter((r) => wanted.has(r.node.id)).map((r) => r.node);
}

/** What an attack line copies from its source. */
export function attackContent(src: OutlineNode, mode: AttackMode): Pick<OutlineNode, "title" | "type" | "status" | "fields" | "body" | "tags"> {
  const fields: Record<string, unknown> = {};
  if (mode === "headings-rules" && src.type === "rule") {
    fields.ruleStatement = src.fields.ruleStatement ?? "";
    fields.elements = src.fields.elements ?? [];
  }
  if (src.type === "flag") {
    fields.text = src.fields.text ?? "";
    fields.color = src.fields.color ?? "amber";
  }
  return { title: src.title, type: src.type, status: src.status, fields, body: "", tags: src.tags };
}

function lineFromSource(outlineId: string, src: OutlineNode, mode: AttackMode, parentId: string | null, position: number): OutlineNode {
  const content = attackContent(src, mode);
  const generated = contentHash(content);
  return makeNode(outlineId, content.type, content.status as NodeStatus, {
    ...content,
    fields: { ...content.fields, attackGeneratedHash: generated },
    parentId,
    position,
    sourceNodeId: src.id,
    sourceHash: contentHash(src),
  });
}

/** Create a new attack outline from a full outline. */
export function generateAttack(db: Db, fullOutlineId: string, options: AttackOptions, name: string): Outline | null {
  const full = getOutline(db, fullOutlineId);
  if (!full) return null;
  const outline = createOutline(db, full.courseId, { name: name.trim() || "Attack", kind: "attack", numbering: full.numbering, sourceOutlineId: fullOutlineId, options: { attack: options } });
  const map: NodeMap = {};
  for (const n of loadNodes(db, fullOutlineId)) map[n.id] = n;
  const sources = selectSources(map, options);
  const idFor = new Map<string, string>();
  const positions = new Map<string | null, number>();
  const lines: OutlineNode[] = [];
  for (const src of sources) {
    const parentId = src.parentId ? (idFor.get(src.parentId) ?? null) : null;
    const position = positions.get(parentId) ?? 0;
    positions.set(parentId, position + 1);
    const line = lineFromSource(outline.id, src, options.mode, parentId, position);
    idFor.set(src.id, line.id);
    lines.push(line);
  }
  upsertNodes(db, lines);
  return outline;
}

export type RegenerateResult = { added: number; updated: number; flaggedChanged: number; flaggedRemoved: number; kept: number };

/**
 * Bring an attack outline up to date with its source:
 *  - source unchanged: the line is left alone (edits kept);
 *  - source changed and the line was never edited: the line is rewritten from the source;
 *  - source changed and the line was edited: the line keeps the edits and is flagged "source changed";
 *  - source gone or no longer selected: flagged "source removed";
 *  - newly selected sources: lines added next to their source siblings;
 *  - lines without a source (added by hand) are kept.
 */
export function regenerateAttack(db: Db, attackOutlineId: string): RegenerateResult | null {
  const attack = getOutline(db, attackOutlineId);
  if (!attack || attack.kind !== "attack" || !attack.sourceOutlineId) return null;
  const options = parseAttackOptions(attack.options.attack);
  const full: NodeMap = {};
  for (const n of loadNodes(db, attack.sourceOutlineId)) full[n.id] = n;
  const current: NodeMap = {};
  for (const n of loadNodes(db, attackOutlineId)) current[n.id] = n;
  const sources = selectSources(full, options);
  const selected = new Set(sources.map((s) => s.id));
  const lineBySource = new Map<string, OutlineNode>();
  for (const n of Object.values(current)) if (n.sourceNodeId && !lineBySource.has(n.sourceNodeId)) lineBySource.set(n.sourceNodeId, n);

  const result: RegenerateResult = { added: 0, updated: 0, flaggedChanged: 0, flaggedRemoved: 0, kept: 0 };
  const now = nowIso();
  const changed: OutlineNode[] = [];

  // 1. Existing lines with a source.
  for (const line of Object.values(current)) {
    if (!line.sourceNodeId) continue;
    const src = full[line.sourceNodeId];
    const fields = { ...line.fields };
    if (!src || !selected.has(src.id)) {
      if (fields.attackFlag !== "source removed") {
        fields.attackFlag = "source removed";
        changed.push({ ...line, fields, updatedAt: now });
        result.flaggedRemoved++;
      } else result.kept++;
      continue;
    }
    const srcHash = contentHash(src);
    if (srcHash === line.sourceHash) {
      if (fields.attackFlag) {
        delete fields.attackFlag;
        changed.push({ ...line, fields, updatedAt: now });
      }
      result.kept++;
      continue;
    }
    const { attackGeneratedHash, attackFlag, ...own } = fields;
    void attackFlag;
    const edited = contentHash({ title: line.title, type: line.type, status: line.status, fields: own, body: line.body, tags: line.tags }) !== attackGeneratedHash;
    if (!edited) {
      const content = attackContent(src, options.mode);
      changed.push({ ...line, ...content, fields: { ...content.fields, attackGeneratedHash: contentHash(content) }, sourceHash: srcHash, updatedAt: now });
      result.updated++;
    } else {
      changed.push({ ...line, fields: { ...fields, attackFlag: "source changed" }, updatedAt: now });
      result.flaggedChanged++;
    }
  }
  upsertNodes(db, changed);
  for (const c of changed) current[c.id] = c;

  // 2. New sources, placed after the line of the previous selected sibling (or first under the parent's line).
  const added: OutlineNode[] = [];
  const idFor = new Map<string, string>();
  for (const [srcId, line] of lineBySource) idFor.set(srcId, line.id);
  for (const src of sources) {
    if (idFor.has(src.id)) continue;
    const parentLineId = src.parentId ? (idFor.get(src.parentId) ?? null) : null;
    if (src.parentId && parentLineId === null) continue; // parent not represented; skip
    const siblings = childrenOf(current, parentLineId);
    const fullSiblings = childrenOf(full, src.parentId).filter((s) => selected.has(s.id));
    const myIndex = fullSiblings.findIndex((s) => s.id === src.id);
    let insertAt = 0;
    for (let i = myIndex - 1; i >= 0; i--) {
      const prevLineId = idFor.get(fullSiblings[i].id);
      const at = prevLineId ? siblings.findIndex((s) => s.id === prevLineId) : -1;
      if (at >= 0) {
        insertAt = at + 1;
        break;
      }
    }
    const line = lineFromSource(attackOutlineId, src, options.mode, parentLineId, insertAt);
    // Shift later siblings down.
    const shifted: OutlineNode[] = [];
    siblings.forEach((s, i) => {
      const pos = i >= insertAt ? i + 1 : i;
      if (pos !== s.position) shifted.push({ ...s, position: pos });
    });
    for (const s of shifted) current[s.id] = s;
    current[line.id] = line;
    idFor.set(src.id, line.id);
    added.push(line, ...shifted);
    result.added++;
  }
  if (added.length) upsertNodes(db, added);
  updateOutline(db, attackOutlineId, {});
  return result;
}

/** Overwrite one attack line from its current source and clear its flag. */
export function refreshAttackLine(db: Db, nodeId: string): OutlineNode | null {
  const lines = loadNodes(db, (db.prepare("SELECT outline_id FROM nodes WHERE id = ?").get(nodeId) as { outline_id: string } | undefined)?.outline_id ?? "");
  const line = lines.find((n) => n.id === nodeId);
  if (!line || !line.sourceNodeId) return null;
  const attack = getOutline(db, line.outlineId);
  if (!attack || !attack.sourceOutlineId) return null;
  const src = loadNodes(db, attack.sourceOutlineId).find((n) => n.id === line.sourceNodeId);
  if (!src) return null;
  const options = parseAttackOptions(attack.options.attack);
  const content = attackContent(src, options.mode);
  const updated: OutlineNode = { ...line, ...content, fields: { ...content.fields, attackGeneratedHash: contentHash(content) }, sourceHash: contentHash(src), updatedAt: nowIso() };
  upsertNodes(db, [updated]);
  return updated;
}
