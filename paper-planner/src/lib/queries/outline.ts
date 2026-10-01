import { getDb } from "../db";
import type { OutlineNode, Section, SectionRole, SectionStatus } from "../types";

export function listSections(paperId: number): Section[] {
  return getDb().prepare("SELECT * FROM sections WHERE paper_id = ? ORDER BY parent_id, sort_order, id").all(paperId) as Section[];
}

export function getSection(id: number): Section | undefined {
  return getDb().prepare("SELECT * FROM sections WHERE id = ?").get(id) as Section | undefined;
}

export function supportCounts(paperId: number): Map<number, number> {
  const rows = getDb()
    .prepare(
      `SELECT sec.id,
         (SELECT COUNT(*) FROM section_sources l WHERE l.section_id = sec.id) +
         (SELECT COUNT(*) FROM extract_sections x WHERE x.section_id = sec.id) AS support
       FROM sections sec WHERE sec.paper_id = ?`,
    )
    .all(paperId) as { id: number; support: number }[];
  return new Map(rows.map((r) => [r.id, r.support]));
}

// Depth-first outline order with depth, numbering path, and support count.
export function outlineTree(paperId: number): OutlineNode[] {
  const sections = listSections(paperId);
  const support = supportCounts(paperId);
  const byParent = new Map<number | null, Section[]>();
  for (const s of sections) {
    const list = byParent.get(s.parent_id) ?? [];
    list.push(s);
    byParent.set(s.parent_id, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const out: OutlineNode[] = [];
  const walk = (parent: number | null, depth: number, prefix: string, seen: Set<number>) => {
    const kids = byParent.get(parent) ?? [];
    kids.forEach((s, i) => {
      if (seen.has(s.id)) return; // guard against cycles
      seen.add(s.id);
      const path = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      out.push({ ...s, depth, support: support.get(s.id) ?? 0, path });
      walk(s.id, depth + 1, path, seen);
    });
  };
  walk(null, 0, "", new Set());
  return out;
}

export function createSection(input: {
  paper_id: number;
  parent_id: number | null;
  heading: string;
  claim?: string;
  role?: SectionRole;
  responds_to?: number | null;
  word_target?: number | null;
}): Section {
  const db = getDb();
  const max = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM sections WHERE paper_id = ? AND parent_id IS ?")
    .get(input.paper_id, input.parent_id) as { m: number };
  const role = input.role ?? "argument";
  const respondsTo = role === "response" ? validResponseTarget(input.paper_id, input.responds_to ?? null) : null;
  const res = db
    .prepare(
      `INSERT INTO sections (paper_id, parent_id, sort_order, heading, claim, role, responds_to, word_target)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.paper_id, input.parent_id, max.m + 1, input.heading, input.claim ?? "", role, respondsTo, input.word_target ?? null);
  return getSection(Number(res.lastInsertRowid))!;
}

// responds_to may only point at a counterargument section in the same paper.
function validResponseTarget(paperId: number, target: number | null): number | null {
  if (!target) return null;
  const row = getDb().prepare("SELECT role, paper_id FROM sections WHERE id = ?").get(target) as
    | { role: string; paper_id: number }
    | undefined;
  if (!row || row.paper_id !== paperId || row.role !== "counterargument") return null;
  return target;
}

export function updateSection(
  id: number,
  input: Partial<{
    heading: string;
    claim: string;
    status: SectionStatus;
    word_target: number | null;
    role: SectionRole;
    responds_to: number | null;
  }>,
) {
  const db = getDb();
  const current = getSection(id);
  if (!current) return;
  const next = { ...current, ...input };
  if (next.role !== "response") next.responds_to = null;
  else next.responds_to = validResponseTarget(current.paper_id, next.responds_to);
  db.prepare(
    `UPDATE sections SET heading = ?, claim = ?, status = ?, word_target = ?, role = ?, responds_to = ? WHERE id = ?`,
  ).run(next.heading, next.claim, next.status, next.word_target, next.role, next.responds_to, id);
  // A section that stops being a counterargument can no longer be answered.
  if (current.role === "counterargument" && next.role !== "counterargument") {
    db.prepare("UPDATE sections SET responds_to = NULL WHERE responds_to = ?").run(id);
  }
}

function isDescendant(candidate: number, ancestor: number): boolean {
  const db = getDb();
  let cur: number | null = candidate;
  const seen = new Set<number>();
  while (cur !== null && !seen.has(cur)) {
    if (cur === ancestor) return true;
    seen.add(cur);
    const row = db.prepare("SELECT parent_id FROM sections WHERE id = ?").get(cur) as { parent_id: number | null } | undefined;
    cur = row?.parent_id ?? null;
  }
  return false;
}

// Move a section to a new parent at a given index among its new siblings. Re-parenting into a
// descendant is refused. Sort orders are renumbered for both the old and new sibling lists.
export function moveSection(id: number, newParentId: number | null, index: number) {
  const db = getDb();
  const sec = getSection(id);
  if (!sec) return;
  if (newParentId !== null) {
    const parent = getSection(newParentId);
    if (!parent || parent.paper_id !== sec.paper_id) return;
    if (newParentId === id || isDescendant(newParentId, id)) return;
  }
  db.transaction(() => {
    const siblings = (
      db
        .prepare("SELECT id FROM sections WHERE paper_id = ? AND parent_id IS ? AND id != ? ORDER BY sort_order, id")
        .all(sec.paper_id, newParentId, id) as { id: number }[]
    ).map((r) => r.id);
    const at = Math.max(0, Math.min(index, siblings.length));
    siblings.splice(at, 0, id);
    const upd = db.prepare("UPDATE sections SET parent_id = ?, sort_order = ? WHERE id = ?");
    siblings.forEach((sid, i) => upd.run(newParentId, i, sid));
    if (sec.parent_id !== newParentId) renumber(sec.paper_id, sec.parent_id);
  })();
}

function renumber(paperId: number, parentId: number | null) {
  const db = getDb();
  const rows = db
    .prepare("SELECT id FROM sections WHERE paper_id = ? AND parent_id IS ? ORDER BY sort_order, id")
    .all(paperId, parentId) as { id: number }[];
  const upd = db.prepare("UPDATE sections SET sort_order = ? WHERE id = ?");
  rows.forEach((r, i) => upd.run(i, r.id));
}

// Deleting a section moves its children up to its parent (keeping their relative order, placed where
// the deleted section was).
export function deleteSection(id: number) {
  const db = getDb();
  const sec = getSection(id);
  if (!sec) return;
  db.transaction(() => {
    const kids = db
      .prepare("SELECT id FROM sections WHERE parent_id = ? ORDER BY sort_order, id")
      .all(id) as { id: number }[];
    const siblings = (
      db
        .prepare("SELECT id FROM sections WHERE paper_id = ? AND parent_id IS ? ORDER BY sort_order, id")
        .all(sec.paper_id, sec.parent_id) as { id: number }[]
    ).map((r) => r.id);
    const pos = siblings.indexOf(id);
    const merged = [...siblings.slice(0, pos), ...kids.map((k) => k.id), ...siblings.slice(pos + 1)];
    const upd = db.prepare("UPDATE sections SET parent_id = ?, sort_order = ? WHERE id = ?");
    merged.forEach((sid, i) => upd.run(sec.parent_id, i, sid));
    db.prepare("DELETE FROM sections WHERE id = ?").run(id);
  })();
}

export function counterargumentSections(paperId: number): Section[] {
  return getDb()
    .prepare("SELECT * FROM sections WHERE paper_id = ? AND role = 'counterargument' ORDER BY sort_order, id")
    .all(paperId) as Section[];
}
