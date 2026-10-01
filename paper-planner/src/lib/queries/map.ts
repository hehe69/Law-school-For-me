import { getDb } from "../db";
import { outlineTree } from "./outline";
import type { Paper } from "../types";

// Everything the argument map needs, in one plain object for the client.
export interface MapNode {
  id: string; // "thesis", "sec-1", "src-2", "ext-3"
  kind: "thesis" | "section" | "source" | "extract";
  label: string;
  title?: string; // longer hover text
  dbId: number;
  role?: string;
  readStatus?: string;
  unsupported?: boolean;
  staging?: boolean;
  depth?: number;
  parentSection?: number | null;
  href: string;
}
export interface MapEdge {
  id: string;
  source: string;
  target: string;
  kind: "tree" | "source" | "extract" | "responds";
}
export interface MapData {
  nodes: MapNode[];
  edges: MapEdge[];
  sections: { id: number; heading: string; path: string }[];
}

export function mapData(paper: Paper): MapData {
  const db = getDb();
  const base = `/papers/${paper.slug}`;
  const nodes: MapNode[] = [];
  const edges: MapEdge[] = [];
  nodes.push({
    id: "thesis",
    kind: "thesis",
    label: paper.thesis.trim() ? paper.thesis : "(no thesis yet)",
    title: paper.thesis,
    dbId: paper.id,
    href: base,
  });
  const tree = outlineTree(paper.id);
  for (const s of tree) {
    nodes.push({
      id: `sec-${s.id}`,
      kind: "section",
      label: s.heading,
      title: s.claim ? `${s.heading}\n${s.claim}` : s.heading,
      dbId: s.id,
      role: s.role,
      unsupported: s.support === 0,
      depth: s.depth,
      parentSection: s.parent_id,
      href: `${base}/outline#section-${s.id}`,
    });
    edges.push({
      id: `tree-${s.id}`,
      source: s.parent_id ? `sec-${s.parent_id}` : "thesis",
      target: `sec-${s.id}`,
      kind: "tree",
    });
    if (s.role === "response" && s.responds_to) {
      edges.push({ id: `resp-${s.id}`, source: `sec-${s.responds_to}`, target: `sec-${s.id}`, kind: "responds" });
    }
  }
  const sources = db
    .prepare("SELECT id, short_cite, citation, read_status FROM sources WHERE paper_id = ? ORDER BY id")
    .all(paper.id) as { id: number; short_cite: string; citation: string; read_status: string }[];
  const links = db
    .prepare(
      `SELECT l.section_id, l.source_id FROM section_sources l JOIN sources s ON s.id = l.source_id WHERE s.paper_id = ?`,
    )
    .all(paper.id) as { section_id: number; source_id: number }[];
  const linkedSources = new Set(links.map((l) => l.source_id));
  for (const src of sources) {
    nodes.push({
      id: `src-${src.id}`,
      kind: "source",
      label: src.short_cite,
      title: src.citation,
      dbId: src.id,
      readStatus: src.read_status,
      staging: !linkedSources.has(src.id),
      href: `${base}/sources/${src.id}`,
    });
  }
  for (const l of links) {
    edges.push({ id: `link-${l.section_id}-${l.source_id}`, source: `sec-${l.section_id}`, target: `src-${l.source_id}`, kind: "source" });
  }
  const extracts = db
    .prepare(
      `SELECT e.id, e.pin_cite, e.text, e.kind, s.short_cite FROM extracts e JOIN sources s ON s.id = e.source_id WHERE s.paper_id = ? ORDER BY e.id`,
    )
    .all(paper.id) as { id: number; pin_cite: string; text: string; kind: string; short_cite: string }[];
  const exLinks = db
    .prepare(
      `SELECT x.extract_id, x.section_id FROM extract_sections x JOIN sections sec ON sec.id = x.section_id WHERE sec.paper_id = ?`,
    )
    .all(paper.id) as { extract_id: number; section_id: number }[];
  const linkedExtracts = new Set(exLinks.map((l) => l.extract_id));
  for (const ex of extracts) {
    nodes.push({
      id: `ext-${ex.id}`,
      kind: "extract",
      label: `${ex.short_cite} ${ex.pin_cite}`.trim(),
      title: ex.text,
      dbId: ex.id,
      staging: !linkedExtracts.has(ex.id),
      href: `${base}/quotes?extract=${ex.id}`,
    });
  }
  for (const l of exLinks) {
    edges.push({ id: `xlink-${l.section_id}-${l.extract_id}`, source: `sec-${l.section_id}`, target: `ext-${l.extract_id}`, kind: "extract" });
  }
  return { nodes, edges, sections: tree.map((s) => ({ id: s.id, heading: s.heading, path: s.path })) };
}
