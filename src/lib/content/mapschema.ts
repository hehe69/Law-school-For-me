// Schema, defaults, and normalisation for map.json. Pure: safe to import from client components.
// Coordinates in the file are absolute canvas coordinates; groups list their members by id.


export const NODE_KINDS = ["rule", "element", "sub-element", "exception", "trigger", "test", "factor", "case", "statute", "amendment", "free"] as const;
export type NodeKind = (typeof NODE_KINDS)[number];
export const SHAPES = ["rectangle", "rounded", "diamond", "circle", "hexagon", "note-card"] as const;
export type Shape = (typeof SHAPES)[number];
export const EDGE_KINDS = ["contains", "triggers", "requires", "defeats", "modifies", "conflicts with", "burden shifts to", "leads to", "see also", "plain"] as const;
export type EdgeKind = (typeof EDGE_KINDS)[number];
export const EDGE_STYLES = ["solid", "dashed", "dotted"] as const;
export type EdgeStyle = (typeof EDGE_STYLES)[number];
export const ARROWHEADS = ["one", "both", "none"] as const;
export type Arrowheads = (typeof ARROWHEADS)[number];

/** Ten named colours plus any hex. Keys are what the file stores. */
export const PALETTE: { key: string; hex: string; label: string }[] = [
  { key: "white", hex: "#ffffff", label: "White" },
  { key: "grey", hex: "#e5e7eb", label: "Grey" },
  { key: "red", hex: "#fecaca", label: "Red" },
  { key: "orange", hex: "#fed7aa", label: "Orange" },
  { key: "yellow", hex: "#fef08a", label: "Yellow" },
  { key: "green", hex: "#bbf7d0", label: "Green" },
  { key: "teal", hex: "#99f6e4", label: "Teal" },
  { key: "blue", hex: "#bfdbfe", label: "Blue" },
  { key: "purple", hex: "#ddd6fe", label: "Purple" },
  { key: "pink", hex: "#fbcfe8", label: "Pink" },
];

export const KIND_DEFAULTS: Record<NodeKind, { shape: Shape; colour: string; width: number; height: number }> = {
  rule: { shape: "rounded", colour: "blue", width: 220, height: 70 },
  element: { shape: "rectangle", colour: "green", width: 180, height: 56 },
  "sub-element": { shape: "rectangle", colour: "teal", width: 160, height: 50 },
  exception: { shape: "diamond", colour: "red", width: 170, height: 80 },
  trigger: { shape: "hexagon", colour: "orange", width: 170, height: 70 },
  test: { shape: "rounded", colour: "purple", width: 200, height: 64 },
  factor: { shape: "circle", colour: "teal", width: 120, height: 120 },
  case: { shape: "note-card", colour: "yellow", width: 200, height: 64 },
  statute: { shape: "rectangle", colour: "grey", width: 200, height: 60 },
  amendment: { shape: "rectangle", colour: "pink", width: 200, height: 60 },
  free: { shape: "note-card", colour: "white", width: 200, height: 80 },
};

export const EDGE_DEFAULTS: Record<EdgeKind, { label: string; style: EdgeStyle; arrowheads: Arrowheads; colour: string }> = {
  contains: { label: "", style: "solid", arrowheads: "none", colour: "#6b7280" },
  triggers: { label: "triggers", style: "solid", arrowheads: "one", colour: "#c2410c" },
  requires: { label: "requires", style: "solid", arrowheads: "one", colour: "#1d4ed8" },
  defeats: { label: "defeats", style: "dashed", arrowheads: "one", colour: "#b91c1c" },
  modifies: { label: "modifies", style: "dashed", arrowheads: "one", colour: "#6d28d9" },
  "conflicts with": { label: "conflicts with", style: "dotted", arrowheads: "both", colour: "#b91c1c" },
  "burden shifts to": { label: "burden shifts to", style: "solid", arrowheads: "one", colour: "#0f766e" },
  "leads to": { label: "leads to", style: "solid", arrowheads: "one", colour: "#374151" },
  "see also": { label: "see also", style: "dotted", arrowheads: "none", colour: "#6b7280" },
  plain: { label: "", style: "solid", arrowheads: "one", colour: "#374151" },
};

export type MapNodeFile = {
  id: string;
  kind: NodeKind;
  label: string;
  shape: Shape;
  colour: string; // palette key or #hex
  x: number;
  y: number;
  width: number;
  height: number;
  definition: string; // markdown
  linkedNote?: string; // content-relative note path
  linkedElement?: number; // 1-based element index within that note
  collapsed: boolean;
  /** For linked boxes: the user's own annotation (the note stays read-only) */
  annotation?: string;
  topics?: string[];
  /** false opts the box out of flashcards */
  flashcard?: boolean;
};

export type MapEdgeFile = {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  label?: string;
  style: EdgeStyle;
  arrowheads: Arrowheads;
};

export type MapGroupFile = {
  id: string;
  label: string;
  colour: string;
  members: string[];
  collapsed?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

export type MapFile = { version: 1; nodes: MapNodeFile[]; edges: MapEdgeFile[]; groups: MapGroupFile[] };

export const EMPTY_MAP: MapFile = { version: 1, nodes: [], edges: [], groups: [] };


function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const oneOf = <T extends readonly string[]>(v: unknown, list: T, d: T[number]): T[number] => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T[number]) : d);

/** Normalise a parsed map file, dropping entries that cannot be repaired. Problems are returned, never thrown. */
export function normaliseMap(raw: unknown): { map: MapFile; problems: string[] } {
  const problems: string[] = [];
  if (!isRecord(raw)) return { map: { ...EMPTY_MAP }, problems: ["map.json must be an object"] };
  const nodes: MapNodeFile[] = [];
  const ids = new Set<string>();
  for (const [i, n] of (Array.isArray(raw.nodes) ? raw.nodes : []).entries()) {
    if (!isRecord(n) || typeof n.id !== "string" || !n.id || ids.has(n.id)) {
      problems.push(`node ${i}: missing or duplicate id, skipped`);
      continue;
    }
    const kind = oneOf(n.kind, NODE_KINDS, "free");
    const d = KIND_DEFAULTS[kind];
    ids.add(n.id);
    nodes.push({
      id: n.id,
      kind,
      label: str(n.label, "(untitled)"),
      shape: oneOf(n.shape, SHAPES, d.shape),
      colour: str(n.colour, d.colour) || d.colour,
      x: num(n.x, 0),
      y: num(n.y, 0),
      width: Math.max(40, num(n.width, d.width)),
      height: Math.max(30, num(n.height, d.height)),
      definition: str(n.definition),
      linkedNote: typeof n.linkedNote === "string" && n.linkedNote ? n.linkedNote : undefined,
      linkedElement: Number.isInteger(n.linkedElement) && (n.linkedElement as number) >= 1 ? (n.linkedElement as number) : undefined,
      collapsed: n.collapsed === true,
      annotation: typeof n.annotation === "string" && n.annotation ? n.annotation : undefined,
      topics: Array.isArray(n.topics) ? (n.topics as unknown[]).filter((t): t is string => typeof t === "string" && t.trim() !== "") : undefined,
      flashcard: n.flashcard === false ? false : undefined,
    });
  }
  const edges: MapEdgeFile[] = [];
  const edgeIds = new Set<string>();
  for (const [i, e] of (Array.isArray(raw.edges) ? raw.edges : []).entries()) {
    if (!isRecord(e) || typeof e.id !== "string" || !e.id || edgeIds.has(e.id) || typeof e.from !== "string" || typeof e.to !== "string" || !ids.has(e.from) || !ids.has(e.to)) {
      problems.push(`edge ${i}: missing id or endpoint, skipped`);
      continue;
    }
    const kind = oneOf(e.kind, EDGE_KINDS, "plain");
    edgeIds.add(e.id);
    edges.push({
      id: e.id,
      from: e.from,
      to: e.to,
      kind,
      label: typeof e.label === "string" ? e.label : undefined,
      style: oneOf(e.style, EDGE_STYLES, EDGE_DEFAULTS[kind].style),
      arrowheads: oneOf(e.arrowheads, ARROWHEADS, EDGE_DEFAULTS[kind].arrowheads),
    });
  }
  const groups: MapGroupFile[] = [];
  for (const [i, g] of (Array.isArray(raw.groups) ? raw.groups : []).entries()) {
    if (!isRecord(g) || typeof g.id !== "string" || !g.id) {
      problems.push(`group ${i}: missing id, skipped`);
      continue;
    }
    groups.push({
      id: g.id,
      label: str(g.label, "Group"),
      colour: str(g.colour, "grey") || "grey",
      members: Array.isArray(g.members) ? (g.members as unknown[]).filter((m): m is string => typeof m === "string" && ids.has(m)) : [],
      collapsed: g.collapsed === true,
      x: typeof g.x === "number" ? g.x : undefined,
      y: typeof g.y === "number" ? g.y : undefined,
      width: typeof g.width === "number" ? g.width : undefined,
      height: typeof g.height === "number" ? g.height : undefined,
    });
  }
  return { map: { version: 1, nodes, edges, groups }, problems };
}

