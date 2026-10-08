// Flowchart model and layout for a rule branch: rule -> elements (one after the other) -> exceptions that
// defeat an element -> the Wisconsin variation, with hypos hanging off the element they test. Pure functions;
// the component only draws boxes and edges.

import type { Link, NodeMap, OutlineNode } from "./types.ts";
import { asElements, asExceptions, fieldString } from "./fields.ts";
import { childrenOf, descendantIds } from "./tree.ts";

export type FlowHypo = { id: string; title: string; question: string };
export type FlowElement = { index: number; text: string; definition: string; exceptions: string[]; hypos: FlowHypo[]; nodeId: string | null };
export type FlowRule = {
  id: string;
  title: string;
  statement: string;
  elements: FlowElement[];
  generalExceptions: string[];
  generalHypos: FlowHypo[];
  variation: string;
  variationElement: number | null;
};

/** Rules in the branch under `rootId` (the root itself when it is a rule), each with its elements, exceptions and hypos. */
export function buildFlow(nodes: NodeMap, links: Link[], rootId: string): FlowRule[] {
  const root = nodes[rootId];
  if (!root) return [];
  const ids = [rootId, ...descendantIds(nodes, rootId)];
  const rules = ids.map((id) => nodes[id]).filter((n) => n.type === "rule");
  return rules.map((rule) => buildRule(nodes, links, rule));
}

function buildRule(nodes: NodeMap, links: Link[], rule: OutlineNode): FlowRule {
  const subtree = new Set(descendantIds(nodes, rule.id));
  const elementNodes = childrenOf(nodes, rule.id).filter((c) => c.type === "element");
  const fieldElements = asElements(rule.fields.elements).filter((e) => e.text.trim());
  // Elements come from the fields; element child nodes with a matching number or title add their own details.
  const elements: FlowElement[] = fieldElements.map((e, i) => {
    const child = elementNodes.find((c) => c.linkedElementIndex === i + 1) ?? elementNodes.find((c) => c.title.trim().toLowerCase() === e.text.trim().toLowerCase());
    return { index: i + 1, text: e.text, definition: e.definition || (child ? fieldString(child, "definition") : ""), exceptions: [], hypos: [], nodeId: child?.id ?? null };
  });
  // Element nodes without a matching field entry still count as elements.
  elementNodes.forEach((c) => {
    if (!elements.some((e) => e.nodeId === c.id)) elements.push({ index: elements.length + 1, text: c.title || fieldString(c, "text"), definition: fieldString(c, "definition"), exceptions: [], hypos: [], nodeId: c.id });
  });
  const generalExceptions: string[] = [];
  for (const ex of asExceptions(rule.fields.exceptions)) {
    if (!ex.text.trim()) continue;
    const target = ex.element ? elements[ex.element - 1] : undefined;
    if (target) target.exceptions.push(ex.text);
    else generalExceptions.push(ex.text);
  }
  for (const id of subtree) {
    const n = nodes[id];
    if (n.type === "exception") {
      const parentEl = elements.find((e) => e.nodeId === n.parentId);
      const defeats = fieldString(n, "defeatsElement");
      const byNumber = /^(\d+)/.exec(defeats.trim());
      const target = parentEl ?? (byNumber ? elements[Number(byNumber[1]) - 1] : undefined) ?? elements.find((e) => defeats && e.text.toLowerCase().includes(defeats.toLowerCase()));
      const text = fieldString(n, "text") || n.title;
      if (target) target.exceptions.push(text);
      else generalExceptions.push(text);
    }
  }
  const generalHypos: FlowHypo[] = [];
  for (const id of subtree) {
    const n = nodes[id];
    if (n.type !== "hypo") continue;
    const hypo: FlowHypo = { id: n.id, title: n.title, question: fieldString(n, "question") };
    const parentEl = elements.find((e) => e.nodeId === n.parentId);
    const linked = links.filter((l) => l.fromNode === n.id || l.toNode === n.id).map((l) => (l.fromNode === n.id ? l.toNode : l.fromNode));
    const viaLink = elements.find((e) => e.nodeId && linked.includes(e.nodeId));
    const turnsOn = fieldString(n, "turnsOn").toLowerCase();
    const viaText = turnsOn ? elements.find((e) => turnsOn.includes(e.text.toLowerCase().split(/[\/(]/)[0].trim())) : undefined;
    const target = parentEl ?? viaLink ?? viaText;
    if (target) target.hypos.push(hypo);
    else generalHypos.push(hypo);
  }
  const variation = fieldString(rule, "localVariation");
  const m = /\(Changes element (\d+)\.\)/.exec(variation);
  return {
    id: rule.id,
    title: rule.title,
    statement: fieldString(rule, "ruleStatement"),
    elements,
    generalExceptions,
    generalHypos,
    variation: variation.replace(/\n*\(Changes element \d+\.\)/, "").trim(),
    variationElement: m ? Number(m[1]) : null,
  };
}

// ---- layout ---------------------------------------------------------------------------------------------

export type FlowBox = { id: string; kind: "rule" | "element" | "exception" | "hypo" | "variation" | "end" | "fail"; x: number; y: number; w: number; h: number; lines: string[]; nodeId?: string };
export type FlowEdge = { from: string; to: string; label?: string; dashed?: boolean };
export type FlowLayout = { width: number; height: number; boxes: FlowBox[]; edges: FlowEdge[] };

const CHAR_W = 6.6; // average character width at 12px
const LINE_H = 16;
const PAD = 10;

/** Greedy word wrap for SVG text at a given box width. */
export function wrapText(text: string, width: number, maxLines = 6): string[] {
  const maxChars = Math.max(8, Math.floor((width - 2 * PAD) / CHAR_W));
  const lines: string[] = [];
  let line = "";
  for (const word of text.replace(/\s+/g, " ").trim().split(" ")) {
    if (!word) continue;
    if ((line + " " + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) return [...lines.slice(0, maxLines - 1), lines[maxLines - 1].slice(0, Math.max(0, maxChars - 1)) + "…"];
  return lines;
}

/** Place the rule's boxes: the chain of elements down the left, exceptions and hypos to the right of their element. */
export function layoutRule(rule: FlowRule, opts: { colWidth?: number; sideWidth?: number } = {}): FlowLayout {
  const colWidth = opts.colWidth ?? 260;
  const sideWidth = opts.sideWidth ?? 220;
  const gapX = 40;
  const gapY = 36;
  const x0 = 20;
  const boxes: FlowBox[] = [];
  const edges: FlowEdge[] = [];
  const box = (id: string, kind: FlowBox["kind"], x: number, y: number, w: number, text: string[], nodeId?: string): FlowBox => {
    const lines = text.flatMap((t, i) => (i === 0 ? wrapText(t, w, 8) : wrapText(t, w, 4)));
    const b: FlowBox = { id, kind, x, y, w, h: Math.max(LINE_H + 2 * PAD, lines.length * LINE_H + 2 * PAD), lines, nodeId };
    boxes.push(b);
    return b;
  };
  let y = 20;
  const ruleBox = box(`rule`, "rule", x0, y, colWidth, [rule.title, rule.statement].filter(Boolean), rule.id);
  y += ruleBox.h + gapY;
  let prev: FlowBox = ruleBox;
  let maxRight = x0 + colWidth;
  const failX = x0 + colWidth + gapX;
  const sideX = failX + sideWidth + gapX;
  const hypoX = sideX + sideWidth + gapX;

  rule.elements.forEach((el, i) => {
    const text = [`${el.index}. ${el.text}`];
    if (el.definition) text.push(el.definition);
    const eb = box(`el-${i}`, "element", x0, y, colWidth, text, el.nodeId ?? undefined);
    edges.push({ from: prev.id, to: eb.id, label: i === 0 ? "" : "yes" });
    let rowBottom = eb.y + eb.h;
    // "no" branch: fails.
    const fb = box(`fail-${i}`, "fail", failX, y, sideWidth, [`Element ${el.index} not met: no liability / no title`]);
    edges.push({ from: eb.id, to: fb.id, label: "no", dashed: true });
    rowBottom = Math.max(rowBottom, fb.y + fb.h);
    // Exceptions for this element stack under the fail box's column.
    let ey = rowBottom + 12;
    el.exceptions.forEach((ex, j) => {
      const xb = box(`ex-${i}-${j}`, "exception", failX, ey, sideWidth, [`Exception: ${ex}`]);
      edges.push({ from: eb.id, to: xb.id, label: "unless", dashed: true });
      ey = xb.y + xb.h + 8;
      rowBottom = Math.max(rowBottom, xb.y + xb.h);
    });
    // Hypos hang to the right.
    let hy = y;
    el.hypos.forEach((h, j) => {
      const hb = box(`hypo-${i}-${j}`, "hypo", hypoX, hy, sideWidth, [`Hypo: ${h.title}`, h.question].filter(Boolean), h.id);
      edges.push({ from: eb.id, to: hb.id, dashed: true, label: "tests" });
      hy = hb.y + hb.h + 8;
      rowBottom = Math.max(rowBottom, hb.y + hb.h);
      maxRight = Math.max(maxRight, hypoX + sideWidth);
    });
    if (el.exceptions.length) maxRight = Math.max(maxRight, failX + sideWidth);
    maxRight = Math.max(maxRight, failX + sideWidth);
    if (rule.variationElement === el.index && rule.variation) {
      const vb = box(`var`, "variation", sideX, y, sideWidth, [`Wisconsin: ${rule.variation}`]);
      edges.push({ from: eb.id, to: vb.id, label: "WI", dashed: true });
      rowBottom = Math.max(rowBottom, vb.y + vb.h);
      maxRight = Math.max(maxRight, sideX + sideWidth);
    }
    y = rowBottom + gapY;
    prev = eb;
  });

  const endBox = box("end", "end", x0, y, colWidth, [rule.elements.length ? "All elements met: rule applies" : "Rule applies"]);
  edges.push({ from: prev.id, to: endBox.id, label: rule.elements.length ? "yes" : "" });
  let bottom = endBox.y + endBox.h;
  let sy = y;
  if (rule.generalExceptions.length) {
    rule.generalExceptions.forEach((ex, j) => {
      const xb = box(`gex-${j}`, "exception", failX, sy, sideWidth, [`Exception: ${ex}`]);
      edges.push({ from: endBox.id, to: xb.id, label: "unless", dashed: true });
      sy = xb.y + xb.h + 8;
      bottom = Math.max(bottom, xb.y + xb.h);
    });
  }
  if (rule.variation && rule.variationElement === null) {
    const vb = box("var", "variation", sideX, y, sideWidth, [`Wisconsin: ${rule.variation}`]);
    edges.push({ from: endBox.id, to: vb.id, label: "WI", dashed: true });
    bottom = Math.max(bottom, vb.y + vb.h);
    maxRight = Math.max(maxRight, sideX + sideWidth);
  }
  let hy = y;
  rule.generalHypos.forEach((h, j) => {
    const hb = box(`ghypo-${j}`, "hypo", hypoX, hy, sideWidth, [`Hypo: ${h.title}`, h.question].filter(Boolean), h.id);
    edges.push({ from: endBox.id, to: hb.id, dashed: true, label: "tests" });
    hy = hb.y + hb.h + 8;
    bottom = Math.max(bottom, hb.y + hb.h);
    maxRight = Math.max(maxRight, hypoX + sideWidth);
  });
  return { width: maxRight + 20, height: bottom + 20, boxes, edges };
}
