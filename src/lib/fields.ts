// Node types: labels, the typed fields each one carries, and how a node summarises itself on one line.
// The field specs drive the side panel form, the seed, the print views and the exports, so there is one
// place to change when a type gains a field.

import type { NodeStatus, NodeType, OutlineNode } from "./types.ts";

export type FieldKind =
  | "text" // one line
  | "textarea" // markdown, several lines
  | "date" // YYYY-MM-DD
  | "list" // string[]
  | "elements" // { text: string; definition: string }[]
  | "exceptions" // { text: string; element: number | null }[]   element is 1-based, into the rule's elements
  | "node" // id of another node in the outline
  | "table" // { columns: string[]; rows: string[][] }
  | "color"; // one of FLAG_COLORS

export type FieldSpec = {
  key: string;
  label: string;
  kind: FieldKind;
  /** Shown under the field in the panel */
  hint?: string;
  /** For "textarea": the field is folded away until clicked (hypo answers) */
  hiddenByDefault?: boolean;
};

export type NodeTypeDef = {
  type: NodeType;
  label: string;
  /** What the title field is called for this type */
  titleLabel: string;
  /** Short letter badge shown in the tree */
  badge: string;
  fields: FieldSpec[];
  /** One-line summary shown next to the title in the tree and in attack outlines */
  summary: (node: OutlineNode) => string;
};

export const FLAG_COLORS = ["red", "amber", "green", "blue", "purple", "grey"] as const;
export type FlagColor = (typeof FLAG_COLORS)[number];

export type ElementField = { text: string; definition: string };
export type ExceptionField = { text: string; element: number | null };
export type TableField = { columns: string[]; rows: string[][] };

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const firstLine = (s: string): string => s.split("\n").find((l) => l.trim())?.trim() ?? "";

export function asElements(v: unknown): ElementField[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => {
      if (typeof e === "string") return { text: e, definition: "" };
      if (e && typeof e === "object") return { text: str((e as ElementField).text), definition: str((e as ElementField).definition) };
      return null;
    })
    .filter((e): e is ElementField => e !== null);
}

export function asExceptions(v: unknown): ExceptionField[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((e) => {
      if (typeof e === "string") return { text: e, element: null };
      if (e && typeof e === "object") {
        const el = (e as ExceptionField).element;
        return { text: str((e as ExceptionField).text), element: typeof el === "number" && el >= 1 ? Math.floor(el) : null };
      }
      return null;
    })
    .filter((e): e is ExceptionField => e !== null);
}

export function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function asTable(v: unknown): TableField {
  if (v && typeof v === "object") {
    const t = v as Partial<TableField>;
    const columns = asList(t.columns);
    const rows = Array.isArray(t.rows) ? t.rows.map((r) => asList(r)) : [];
    return { columns, rows };
  }
  return { columns: [], rows: [] };
}

export function fieldString(node: OutlineNode, key: string): string {
  return str(node.fields[key]);
}

const def = (
  type: NodeType,
  label: string,
  titleLabel: string,
  badge: string,
  fields: FieldSpec[],
  summary: (node: OutlineNode) => string,
): NodeTypeDef => ({ type, label, titleLabel, badge, fields, summary });

const bodySummary = (node: OutlineNode) => firstLine(node.body);

export const NODE_TYPE_DEFS: Record<NodeType, NodeTypeDef> = {
  heading: def("heading", "Heading", "Title", "H", [], bodySummary),
  rule: def(
    "rule",
    "Rule",
    "Rule name",
    "R",
    [
      { key: "ruleStatement", label: "Rule statement", kind: "textarea" },
      { key: "elements", label: "Elements", kind: "elements", hint: "In order. Each may carry a definition." },
      { key: "exceptions", label: "Exceptions", kind: "exceptions", hint: "Each may be tied to the element it defeats." },
      { key: "localVariation", label: "Wisconsin / local variation", kind: "textarea" },
      { key: "majorityPosition", label: "Majority / Restatement position", kind: "textarea" },
      { key: "burden", label: "Who bears the burden", kind: "text" },
    ],
    (n) => firstLine(fieldString(n, "ruleStatement")) || bodySummary(n),
  ),
  element: def(
    "element",
    "Element",
    "Element",
    "E",
    [
      { key: "text", label: "Text", kind: "textarea" },
      { key: "definition", label: "Definition", kind: "textarea" },
      { key: "factors", label: "Test or factors", kind: "list" },
      { key: "satisfiedWhen", label: "Satisfied when", kind: "textarea" },
    ],
    (n) => firstLine(fieldString(n, "text")) || firstLine(fieldString(n, "definition")) || bodySummary(n),
  ),
  exception: def(
    "exception",
    "Exception",
    "Exception",
    "X",
    [
      { key: "text", label: "Text", kind: "textarea" },
      { key: "defeatsElement", label: "Defeats which element", kind: "text" },
      { key: "source", label: "Source", kind: "text" },
    ],
    (n) => firstLine(fieldString(n, "text")) || bodySummary(n),
  ),
  case: def(
    "case",
    "Case",
    "Case name",
    "C",
    [
      { key: "courtYear", label: "Court and year", kind: "text" },
      { key: "facts", label: "One-line facts", kind: "textarea" },
      { key: "holding", label: "Holding", kind: "textarea" },
      { key: "whyHere", label: "Why it is in the outline", kind: "textarea" },
      { key: "professorUse", label: "How the professor used it", kind: "textarea" },
      { key: "disposition", label: "Disposition", kind: "text" },
    ],
    (n) => firstLine(fieldString(n, "holding")) || firstLine(fieldString(n, "facts")) || bodySummary(n),
  ),
  statute: def(
    "statute",
    "Statute",
    "Statute name",
    "§",
    [
      { key: "cite", label: "Cite", kind: "text" },
      { key: "quotedText", label: "Quoted text", kind: "textarea", hint: "Shown as a block quote." },
      { key: "changes", label: "What it changes", kind: "textarea" },
      { key: "effectiveNote", label: "Effective note", kind: "text" },
    ],
    (n) => fieldString(n, "cite") || firstLine(fieldString(n, "changes")) || bodySummary(n),
  ),
  policy: def(
    "policy",
    "Policy",
    "Policy",
    "P",
    [
      { key: "argument", label: "The argument", kind: "textarea" },
      { key: "whoMakesIt", label: "Who makes it", kind: "text" },
      { key: "counter", label: "Counter", kind: "textarea" },
    ],
    (n) => firstLine(fieldString(n, "argument")) || bodySummary(n),
  ),
  hypo: def(
    "hypo",
    "Hypo",
    "Hypo title",
    "?",
    [
      { key: "facts", label: "Facts", kind: "textarea" },
      { key: "question", label: "Question", kind: "textarea" },
      { key: "answer", label: "Answer", kind: "textarea", hiddenByDefault: true },
      { key: "turnsOn", label: "What it turns on", kind: "textarea" },
    ],
    (n) => firstLine(fieldString(n, "question")) || firstLine(fieldString(n, "facts")) || bodySummary(n),
  ),
  "professor-note": def(
    "professor-note",
    "Professor note",
    "Topic",
    "N",
    [
      { key: "date", label: "Date", kind: "date" },
      { key: "said", label: "What he said", kind: "textarea" },
      { key: "modifiesRule", label: "Which rule it modifies", kind: "node" },
    ],
    (n) => firstLine(fieldString(n, "said")) || bodySummary(n),
  ),
  definition: def(
    "definition",
    "Definition",
    "Term",
    "D",
    [{ key: "definition", label: "Definition", kind: "textarea" }],
    (n) => firstLine(fieldString(n, "definition")) || bodySummary(n),
  ),
  table: def("table", "Table", "Table title", "T", [{ key: "grid", label: "Grid", kind: "table" }], (n) => {
    const t = asTable(n.fields.grid);
    return t.columns.length ? `${t.columns.join(" · ")} (${t.rows.length} rows)` : bodySummary(n);
  }),
  flag: def(
    "flag",
    "Flag",
    "Flag",
    "!",
    [
      { key: "text", label: "Short text", kind: "text" },
      { key: "color", label: "Colour", kind: "color" },
    ],
    (n) => fieldString(n, "text") || bodySummary(n),
  ),
  image: def("image", "Image", "Image title", "I", [{ key: "caption", label: "Caption", kind: "text" }], (n) => fieldString(n, "caption") || bodySummary(n)),
  free: def("free", "Free", "Title", "F", [], bodySummary),
};

export function typeDef(type: NodeType): NodeTypeDef {
  return NODE_TYPE_DEFS[type] ?? NODE_TYPE_DEFS.free;
}

export function nodeSummary(node: OutlineNode): string {
  const s = typeDef(node.type).summary(node);
  return s.length > 160 ? s.slice(0, 157) + "…" : s;
}

/** Empty typed fields for a type, so a fresh node has every key its form shows. */
export function emptyFields(type: NodeType): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of typeDef(type).fields) {
    switch (f.kind) {
      case "list":
      case "elements":
      case "exceptions":
        out[f.key] = [];
        break;
      case "table":
        out[f.key] = { columns: ["", ""], rows: [["", ""]] };
        break;
      case "node":
        out[f.key] = null;
        break;
      case "color":
        out[f.key] = "amber";
        break;
      default:
        out[f.key] = "";
    }
  }
  return out;
}

/** True when the node carries no content beyond its title (used by the status-by-content heuristics and gaps). */
export function fieldsAreEmpty(node: OutlineNode): boolean {
  if (node.body.trim()) return false;
  for (const f of typeDef(node.type).fields) {
    const v = node.fields[f.key];
    if (typeof v === "string" && v.trim()) return false;
    if (Array.isArray(v) && v.length) {
      if (f.kind === "elements" && asElements(v).some((e) => e.text.trim())) return false;
      if (f.kind === "exceptions" && asExceptions(v).some((e) => e.text.trim())) return false;
      if (f.kind === "list" && asList(v).some((s) => s.trim())) return false;
    }
    if (f.kind === "table") {
      const t = asTable(v);
      if (t.columns.some((c) => c.trim()) || t.rows.some((r) => r.some((c) => c.trim()))) return false;
    }
    if (f.kind === "node" && typeof v === "string" && v) return false;
  }
  return true;
}

export const STATUS_LABELS: Record<NodeStatus, string> = {
  empty: "Empty",
  skeleton: "Skeleton",
  drafted: "Drafted",
  final: "Final",
};

/** Tailwind classes for the status dot. */
export const STATUS_DOT_CLASS: Record<NodeStatus, string> = {
  empty: "bg-gray-300",
  skeleton: "bg-white border border-gray-500",
  drafted: "bg-blue-500",
  final: "bg-green-600",
};

/** Plain text of everything the node says, for word counts and search. */
export function nodeText(node: OutlineNode): string {
  const parts: string[] = [node.title, node.body];
  for (const f of typeDef(node.type).fields) {
    const v = node.fields[f.key];
    switch (f.kind) {
      case "text":
      case "textarea":
      case "date":
        parts.push(str(v));
        break;
      case "list":
        parts.push(asList(v).join("\n"));
        break;
      case "elements":
        parts.push(asElements(v).map((e) => `${e.text} ${e.definition}`).join("\n"));
        break;
      case "exceptions":
        parts.push(asExceptions(v).map((e) => e.text).join("\n"));
        break;
      case "table": {
        const t = asTable(v);
        parts.push([t.columns.join(" "), ...t.rows.map((r) => r.join(" "))].join("\n"));
        break;
      }
      default:
        break;
    }
  }
  return parts.filter(Boolean).join("\n");
}

export function countWords(text: string): number {
  const m = text.match(/[A-Za-z0-9§'’-]+/g);
  return m ? m.length : 0;
}
