// Importing an existing outline from a .md or .docx file: headings and list indentation become the hierarchy.
// The same parser feeds the "friend's outline" comparison pane, which never touches the database.

import mammoth from "mammoth";
import type { OutlineNode } from "./types.ts";
import type { Db } from "./db.ts";
import { createOutline } from "./courses.ts";
import { upsertNodes } from "./nodes.ts";
import { makeNode } from "./nodeFactory.ts";

/** A parsed outline, independent of the database. */
export type ImportedNode = { title: string; body: string; children: ImportedNode[] };

type Block = { kind: "heading"; level: number; text: string } | { kind: "item"; depth: number; text: string } | { kind: "para"; text: string };

/** Strip markdown emphasis and links from a title. */
function cleanTitle(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|\s)\*(\S.*?)\*(?=\s|$)/g, "$1$2")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1")
    .trim();
}

/** Markdown -> blocks. Headings keep their level; list items get a depth from their indentation. */
export function markdownToBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let inFence = false;
  let indentUnit = 0;
  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\t/g, "    ");
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      const last = blocks[blocks.length - 1];
      if (last && last.kind === "para") last.text += "\n" + line;
      else blocks.push({ kind: "para", text: line });
      continue;
    }
    if (!line.trim()) continue;
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: cleanTitle(heading[2]) });
      continue;
    }
    const item = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      const indent = item[1].length;
      if (indent > 0 && indentUnit === 0) indentUnit = indent;
      const depth = indentUnit ? Math.round(indent / indentUnit) : 0;
      blocks.push({ kind: "item", depth, text: item[2].trim() });
      continue;
    }
    // A line indented under a list item continues that item.
    const last = blocks[blocks.length - 1];
    if (last && last.kind === "item" && /^\s{2,}/.test(line)) {
      last.text += "\n" + line.trim();
      continue;
    }
    if (last && last.kind === "para") last.text += "\n" + line.trim();
    else blocks.push({ kind: "para", text: line.trim() });
  }
  return blocks;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/**
 * The HTML mammoth produces for a .docx (h1-h6, p, ul/ol/li, strong, em, a, br, table) -> blocks. Nested
 * lists give items a depth; bold and italics become markdown in the text.
 */
export function htmlToBlocks(html: string): Block[] {
  const blocks: Block[] = [];
  const re = /<\/?([a-zA-Z0-9]+)([^>]*)>|([^<]+)/g;
  let listDepth = 0;
  let heading: number | null = null;
  let buffer = "";
  let itemDepth: number | null = null;
  let inTable = false;
  const flush = () => {
    const text = buffer.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
    buffer = "";
    if (!text) return;
    if (heading !== null) blocks.push({ kind: "heading", level: heading, text: cleanTitle(text) });
    else if (itemDepth !== null) blocks.push({ kind: "item", depth: itemDepth, text });
    else blocks.push({ kind: "para", text });
  };
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[3] !== undefined) {
      buffer += decodeEntities(m[3]);
      continue;
    }
    const closing = m[0].startsWith("</");
    const tag = m[1].toLowerCase();
    const hLevel = /^h([1-6])$/.exec(tag);
    if (hLevel) {
      if (closing) {
        flush();
        heading = null;
      } else {
        flush();
        heading = Number(hLevel[1]);
      }
    } else if (tag === "ul" || tag === "ol") {
      if (closing) {
        flush();
        listDepth = Math.max(0, listDepth - 1);
        itemDepth = listDepth > 0 ? listDepth - 1 : null;
      } else {
        flush();
        listDepth++;
      }
    } else if (tag === "li") {
      flush();
      itemDepth = closing ? (listDepth > 0 ? listDepth - 1 : null) : listDepth - 1;
      if (closing) itemDepth = null;
    } else if (tag === "p") {
      if (itemDepth !== null && !closing) buffer += buffer ? "\n" : "";
      else flush();
    } else if (tag === "br") {
      buffer += "\n";
    } else if (tag === "strong" || tag === "b") {
      buffer += "**";
    } else if (tag === "em" || tag === "i") {
      buffer += "*";
    } else if (tag === "a") {
      if (!closing) {
        const href = /href="([^"]*)"/.exec(m[2] ?? "");
        buffer += "[";
        if (href) buffer += `\u0000${href[1]}\u0000`;
      } else {
        const marker = /\[\u0000([^\u0000]*)\u0000(.*)$/s.exec(buffer);
        if (marker) buffer = buffer.slice(0, marker.index) + `[${marker[2]}](${marker[1]})`;
        else buffer += "]";
      }
    } else if (tag === "table") {
      flush();
      inTable = !closing;
    } else if (tag === "tr") {
      if (closing) buffer += "\n";
    } else if (tag === "td" || tag === "th") {
      if (closing) buffer += " | ";
    } else if (tag === "img") {
      buffer += "(image)";
    }
  }
  flush();
  if (inTable) flush();
  return blocks;
}

/** Blocks -> tree. List items hang off the nearest heading; paragraphs go into the body of the current node. */
export function blocksToTree(blocks: Block[]): ImportedNode[] {
  const root: ImportedNode = { title: "", body: "", children: [] };
  // Stack of (level, node). Headings use their level 1-6; items use (deepest heading level or 0) + 1 + depth.
  const stack: { level: number; node: ImportedNode }[] = [{ level: 0, node: root }];
  let headingLevel = 0;
  let current: ImportedNode = root;
  for (const b of blocks) {
    if (b.kind === "para") {
      current.body = current.body ? `${current.body}\n\n${b.text}` : b.text;
      continue;
    }
    let level: number;
    let title: string;
    let body = "";
    if (b.kind === "heading") {
      level = b.level;
      headingLevel = b.level;
      title = b.text;
    } else {
      level = headingLevel + 1 + b.depth;
      const [first, ...rest] = b.text.split("\n");
      if (first.length > 120) {
        const cut = first.slice(0, 117);
        title = cut.slice(0, cut.lastIndexOf(" ") > 60 ? cut.lastIndexOf(" ") : 117) + "…";
        body = b.text;
      } else {
        title = cleanTitle(first);
        body = rest.join("\n").trim();
      }
    }
    while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
    const node: ImportedNode = { title, body, children: [] };
    stack[stack.length - 1].node.children.push(node);
    stack.push({ level, node });
    current = node;
  }
  // Text before the first heading becomes a note at the top.
  if (root.body) root.children.unshift({ title: "Introduction", body: root.body, children: [] });
  return root.children;
}

export function parseMarkdownOutline(markdown: string): ImportedNode[] {
  return blocksToTree(markdownToBlocks(markdown));
}

export async function parseDocxOutline(buffer: Buffer): Promise<ImportedNode[]> {
  const result = await mammoth.convertToHtml({ buffer });
  return blocksToTree(htmlToBlocks(result.value));
}

/** Parse by file name: .md / .markdown / .txt as markdown, .docx through mammoth. */
export async function parseOutlineFile(name: string, buffer: Buffer): Promise<ImportedNode[]> {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "docx") return parseDocxOutline(buffer);
  if (ext === "md" || ext === "markdown" || ext === "txt") return parseMarkdownOutline(buffer.toString("utf8"));
  throw new Error("Only .docx and .md files can be imported");
}

export function countImported(tree: ImportedNode[]): number {
  return tree.reduce((n, node) => n + 1 + countImported(node.children), 0);
}

/** Create a new full outline from a parsed tree. Nodes are headings, "drafted" when they carry text. */
export function createOutlineFromTree(db: Db, courseId: number, name: string, tree: ImportedNode[]): { outlineId: string; count: number } {
  const outline = createOutline(db, courseId, { name, kind: "full" });
  const nodes: OutlineNode[] = [];
  const walk = (list: ImportedNode[], parentId: string | null) => {
    list.forEach((item, i) => {
      const node = makeNode(outline.id, "heading", item.body ? "drafted" : "skeleton", { parentId, position: i, title: item.title, body: item.body });
      nodes.push(node);
      walk(item.children, node.id);
    });
  };
  walk(tree, null);
  upsertNodes(db, nodes);
  return { outlineId: outline.id, count: nodes.length };
}
