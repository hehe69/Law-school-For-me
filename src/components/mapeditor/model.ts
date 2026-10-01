// Conversion between the map file (absolute coordinates, groups by member list) and React Flow nodes/edges
// (group parents with relative child positions), plus the shared data types the editor components use.

import type { Edge, Node } from "@xyflow/react";
import { EDGE_DEFAULTS, KIND_DEFAULTS, PALETTE, type Arrowheads, type EdgeKind, type EdgeStyle, type MapEdgeFile, type MapFile, type MapGroupFile, type MapNodeFile, type NodeKind, type Shape } from "@/lib/content/mapschema";
import type { Mastery } from "@/lib/mastery";

export type BoxData = {
  kind: NodeKind;
  label: string;
  shape: Shape;
  colour: string;
  definition: string;
  linkedNote?: string;
  linkedElement?: number;
  collapsed: boolean;
  annotation?: string;
  topics?: string[];
  flashcard?: boolean;
  /** Display-only, derived each render */
  displayColour?: string;
  highlight?: boolean;
  dim?: boolean;
  hiddenCount?: number;
  linkMissing?: boolean;
  [key: string]: unknown;
};

export type GroupData = { label: string; colour: string; collapsed: boolean; expandedWidth: number; expandedHeight: number; memberCount: number; [key: string]: unknown };

export type EdgeData = { kind: EdgeKind; label?: string; style: EdgeStyle; arrowheads: Arrowheads; editing?: boolean; [key: string]: unknown };

export type BoxNode = Node<BoxData, "box">;
export type GroupNode = Node<GroupData, "group">;
export type AnyNode = BoxNode | GroupNode;
export type MapEdge = Edge<EdgeData, "labeled">;

/** Note information the editor needs for "Add from notes", linked definitions, and sync. */
export type NoteInfo = {
  path: string;
  kind: "rule" | "case" | "class";
  title: string;
  unitSlug: string;
  unitTitle: string;
  href: string;
  draft: boolean;
  /** Read-only text shown for a linked box */
  definition: string;
  elements?: { index: number; text: string; definition: string; exceptions: string[] }[];
};

export const COLLAPSED_GROUP = { width: 220, height: 48 };

export function colourHex(colour: string): string {
  if (colour.startsWith("#")) return colour;
  return PALETTE.find((p) => p.key === colour)?.hex ?? "#ffffff";
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makeBox(kind: NodeKind, label: string, x: number, y: number, extra: Partial<BoxData> = {}): BoxNode {
  const d = KIND_DEFAULTS[kind];
  return {
    id: newId("n"),
    type: "box",
    position: { x, y },
    width: d.width,
    height: d.height,
    data: { kind, label, shape: d.shape, colour: d.colour, definition: "", collapsed: false, ...extra },
  };
}

export function makeEdge(from: string, to: string, kind: EdgeKind = "plain"): MapEdge {
  const d = EDGE_DEFAULTS[kind];
  return { id: newId("e"), source: from, target: to, type: "labeled", data: { kind, style: d.style, arrowheads: d.arrowheads } };
}

export function isGroup(n: AnyNode): n is GroupNode {
  return n.type === "group";
}

/** File -> React Flow. Members of a group get a parentId and positions relative to it. */
export function fromFile(file: MapFile): { nodes: AnyNode[]; edges: MapEdge[] } {
  const nodes: AnyNode[] = [];
  const memberOf = new Map<string, MapGroupFile>();
  for (const g of file.groups) for (const m of g.members) memberOf.set(m, g);
  for (const g of file.groups) {
    const members = file.nodes.filter((n) => g.members.includes(n.id));
    const x = g.x ?? (members.length ? Math.min(...members.map((m) => m.x)) - 24 : 0);
    const y = g.y ?? (members.length ? Math.min(...members.map((m) => m.y)) - 40 : 0);
    const width = g.width ?? (members.length ? Math.max(...members.map((m) => m.x + m.width)) - x + 24 : 300);
    const height = g.height ?? (members.length ? Math.max(...members.map((m) => m.y + m.height)) - y + 24 : 200);
    const collapsed = g.collapsed === true;
    nodes.push({
      id: g.id,
      type: "group",
      position: { x, y },
      width: collapsed ? COLLAPSED_GROUP.width : width,
      height: collapsed ? COLLAPSED_GROUP.height : height,
      data: { label: g.label, colour: g.colour, collapsed, expandedWidth: width, expandedHeight: height, memberCount: members.length },
      zIndex: -1,
    });
  }
  for (const n of file.nodes) {
    const g = memberOf.get(n.id);
    const parent = g ? nodes.find((p) => p.id === g.id) : undefined;
    nodes.push({
      id: n.id,
      type: "box",
      position: parent ? { x: n.x - parent.position.x, y: n.y - parent.position.y } : { x: n.x, y: n.y },
      width: n.width,
      height: n.height,
      parentId: parent?.id,
      hidden: g?.collapsed === true,
      data: {
        kind: n.kind,
        label: n.label,
        shape: n.shape,
        colour: n.colour,
        definition: n.definition,
        linkedNote: n.linkedNote,
        linkedElement: n.linkedElement,
        collapsed: n.collapsed,
        annotation: n.annotation,
        topics: n.topics,
        flashcard: n.flashcard,
      },
    });
  }
  const edges: MapEdge[] = file.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    type: "labeled",
    data: { kind: e.kind, label: e.label, style: e.style, arrowheads: e.arrowheads },
  }));
  return { nodes, edges };
}

/** React Flow -> file. Positions become absolute again. */
export function toFile(nodes: AnyNode[], edges: MapEdge[]): MapFile {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const abs = (n: AnyNode): { x: number; y: number } => {
    const p = n.parentId ? byId.get(n.parentId) : undefined;
    return p ? { x: p.position.x + n.position.x, y: p.position.y + n.position.y } : n.position;
  };
  const fileNodes: MapNodeFile[] = [];
  const groups: MapGroupFile[] = [];
  for (const n of nodes) {
    if (isGroup(n)) {
      groups.push({
        id: n.id,
        label: n.data.label,
        colour: n.data.colour,
        members: nodes.filter((m) => m.parentId === n.id).map((m) => m.id),
        collapsed: n.data.collapsed || undefined,
        x: n.position.x,
        y: n.position.y,
        width: n.data.collapsed ? n.data.expandedWidth : (n.width ?? n.data.expandedWidth),
        height: n.data.collapsed ? n.data.expandedHeight : (n.height ?? n.data.expandedHeight),
      });
      continue;
    }
    const { x, y } = abs(n);
    const d = n.data;
    fileNodes.push({
      id: n.id,
      kind: d.kind,
      label: d.label,
      shape: d.shape,
      colour: d.colour,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(n.width ?? KIND_DEFAULTS[d.kind].width),
      height: Math.round(n.height ?? KIND_DEFAULTS[d.kind].height),
      definition: d.definition,
      linkedNote: d.linkedNote,
      linkedElement: d.linkedElement,
      collapsed: d.collapsed,
      annotation: d.annotation || undefined,
      topics: d.topics && d.topics.length ? d.topics : undefined,
      flashcard: d.flashcard === false ? false : undefined,
    });
  }
  const fileEdges: MapEdgeFile[] = edges.map((e) => ({
    id: e.id,
    from: e.source,
    to: e.target,
    kind: e.data?.kind ?? "plain",
    label: e.data?.label,
    style: e.data?.style ?? "solid",
    arrowheads: e.data?.arrowheads ?? "one",
  }));
  return { version: 1, nodes: fileNodes, edges: fileEdges, groups };
}

/** Text a linked box shows read-only, pulled from the note. */
export function linkedDefinition(note: NoteInfo | undefined, elementIndex: number | undefined): string | null {
  if (!note) return null;
  if (elementIndex && note.elements) {
    const el = note.elements.find((e) => e.index === elementIndex);
    return el ? el.definition || el.text : null;
  }
  return note.definition;
}

/** Mastery colour for a linked box, if the toggle is on. */
export function masteryFor(data: BoxData, mastery: Record<string, Mastery>): Mastery | undefined {
  if (!data.linkedNote) return undefined;
  if (data.kind !== "rule" && data.kind !== "element" && data.kind !== "sub-element") return undefined;
  return mastery[data.linkedNote];
}
