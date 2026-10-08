// A node's typed fields as display blocks. The document renderer (reading mode, exam mode, print) and the
// exporters (docx, markdown) all go through this so every view shows the same content.

import type { OutlineNode } from "./types.ts";
import { asElements, asExceptions, asList, asTable, fieldString } from "./fields.ts";

export type Block =
  | { kind: "text"; label?: string; text: string }
  | { kind: "list"; label: string; items: { text: string; sub?: string }[]; ordered: boolean }
  | { kind: "quote"; label?: string; text: string }
  | { kind: "table"; columns: string[]; rows: string[][] }
  | { kind: "hidden"; label: string; text: string }
  | { kind: "chip"; text: string; color: string }
  | { kind: "ref"; label: string; nodeId: string; title: string };

const text = (label: string | undefined, value: string): Block | null => (value.trim() ? { kind: "text", label, text: value } : null);

/** Blocks for one node's fields (not its title, body, images or sources). */
export function nodeBlocks(node: OutlineNode, titleOf: (id: string) => string | null): Block[] {
  const f = (key: string) => fieldString(node, key);
  const blocks: (Block | null)[] = [];
  switch (node.type) {
    case "rule": {
      blocks.push(text(undefined, f("ruleStatement")));
      const elements = asElements(node.fields.elements).filter((e) => e.text.trim());
      if (elements.length) blocks.push({ kind: "list", label: "Elements", ordered: true, items: elements.map((e) => ({ text: e.text, sub: e.definition || undefined })) });
      const exceptions = asExceptions(node.fields.exceptions).filter((e) => e.text.trim());
      if (exceptions.length)
        blocks.push({
          kind: "list",
          label: "Exceptions",
          ordered: false,
          items: exceptions.map((e) => ({ text: e.text, sub: e.element ? `defeats element ${e.element}${elements[e.element - 1] ? `: ${elements[e.element - 1].text}` : ""}` : undefined })),
        });
      blocks.push(text("Wisconsin / local variation", f("localVariation")));
      blocks.push(text("Majority / Restatement", f("majorityPosition")));
      blocks.push(text("Burden", f("burden")));
      break;
    }
    case "element": {
      blocks.push(text(undefined, f("text")));
      blocks.push(text("Definition", f("definition")));
      const factors = asList(node.fields.factors).filter((s) => s.trim());
      if (factors.length) blocks.push({ kind: "list", label: "Test or factors", ordered: false, items: factors.map((t) => ({ text: t })) });
      blocks.push(text("Satisfied when", f("satisfiedWhen")));
      break;
    }
    case "exception":
      blocks.push(text(undefined, f("text")));
      blocks.push(text("Defeats", f("defeatsElement")));
      blocks.push(text("Source", f("source")));
      break;
    case "case":
      blocks.push(text("Court and year", f("courtYear")));
      blocks.push(text("Facts", f("facts")));
      blocks.push(text("Holding", f("holding")));
      blocks.push(text("Why it is here", f("whyHere")));
      blocks.push(text("How the professor used it", f("professorUse")));
      blocks.push(text("Disposition", f("disposition")));
      break;
    case "statute": {
      blocks.push(text("Cite", f("cite")));
      const quoted = f("quotedText");
      if (quoted.trim()) blocks.push({ kind: "quote", text: quoted });
      blocks.push(text("What it changes", f("changes")));
      blocks.push(text("Effective", f("effectiveNote")));
      break;
    }
    case "policy":
      blocks.push(text("Argument", f("argument")));
      blocks.push(text("Who makes it", f("whoMakesIt")));
      blocks.push(text("Counter", f("counter")));
      break;
    case "hypo": {
      blocks.push(text("Facts", f("facts")));
      blocks.push(text("Question", f("question")));
      const answer = f("answer");
      if (answer.trim()) blocks.push({ kind: "hidden", label: "Answer", text: answer });
      blocks.push(text("Turns on", f("turnsOn")));
      break;
    }
    case "professor-note": {
      blocks.push(text("Date", f("date")));
      blocks.push(text(undefined, f("said")));
      const ref = node.fields.modifiesRule;
      if (typeof ref === "string" && ref) {
        const title = titleOf(ref);
        if (title) blocks.push({ kind: "ref", label: "Modifies", nodeId: ref, title });
      }
      break;
    }
    case "definition":
      blocks.push(text(undefined, f("definition")));
      break;
    case "table": {
      const t = asTable(node.fields.grid);
      if (t.columns.some((c) => c.trim()) || t.rows.length) blocks.push({ kind: "table", columns: t.columns, rows: t.rows });
      break;
    }
    case "flag":
      blocks.push({ kind: "chip", text: f("text") || node.title, color: f("color") || "amber" });
      break;
    case "image":
      // The attached image carries its own caption; the field is only a fallback when no file is attached.
      break;
    default:
      break;
  }
  return blocks.filter((b): b is Block => b !== null);
}

/** Plain-text rendering of blocks, for page estimates and exports that cannot show structure. */
export function blocksToText(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "text":
        case "quote":
        case "hidden":
          return (b.label ? `${b.label}: ` : "") + b.text;
        case "list":
          return `${b.label}:\n` + b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : "-"} ${it.text}${it.sub ? ` (${it.sub})` : ""}`).join("\n");
        case "table":
          return [b.columns.join(" | "), ...b.rows.map((r) => r.join(" | "))].join("\n");
        case "chip":
          return b.text;
        case "ref":
          return `${b.label}: ${b.title}`;
      }
    })
    .join("\n");
}
