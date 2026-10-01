import fs from "node:fs";
import path from "node:path";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { EXPORTS_DIR, ensureDir } from "./paths";
import { todayISO } from "./format";
import { outlineTree } from "./queries/outline";
import { linksForSection } from "./queries/citations";
import { extractsForSection } from "./queries/extracts";
import { listSources } from "./queries/sources";
import { listOpenQuestions } from "./queries/papers";
import type { Paper } from "./types";

// A flat, format-neutral description of the export. Both writers consume this so the
// content and order are identical in .docx and .md.
type Block =
  | { t: "title"; text: string }
  | { t: "h"; level: 1 | 2 | 3; text: string }
  | { t: "p"; text: string; italic?: boolean }
  | { t: "label"; label: string; text: string }
  | { t: "quote"; text: string }
  | { t: "li"; text: string };

function paperBlocks(paper: Paper): Block[] {
  const blocks: Block[] = [];
  blocks.push({ t: "title", text: paper.title });
  if (paper.venue) blocks.push({ t: "p", text: paper.venue, italic: true });
  blocks.push({ t: "h", level: 1, text: "Thesis" });
  blocks.push({ t: "p", text: paper.thesis || "(no thesis yet)" });
  blocks.push({ t: "h", level: 1, text: "Outline" });
  for (const s of outlineTree(paper.id)) {
    const level = Math.min(3, 2 + s.depth) as 2 | 3;
    const roleTag = s.role === "argument" ? "" : ` [${s.role}]`;
    blocks.push({ t: "h", level, text: `${s.path} ${s.heading}${roleTag}` });
    if (s.claim) blocks.push({ t: "p", text: s.claim });
    const links = linksForSection(s.id);
    for (const l of links) blocks.push({ t: "label", label: `${l.short_cite} (${l.purpose})`, text: l.note });
    for (const e of extractsForSection(s.id)) {
      blocks.push({ t: "quote", text: `${e.short_cite}, ${e.pin_cite}: ${e.text}` });
      if (e.note) blocks.push({ t: "p", text: `Note: ${e.note}` });
    }
  }
  const questions = listOpenQuestions(paper.id);
  blocks.push({ t: "h", level: 1, text: "Open questions" });
  if (questions.length === 0) blocks.push({ t: "p", text: "(none)" });
  for (const q of questions) {
    blocks.push({ t: "li", text: `${q.resolved ? "[resolved] " : ""}${q.text}${q.section_heading ? ` (${q.section_heading})` : ""}` });
  }
  blocks.push({ t: "h", level: 1, text: "Sources" });
  for (const s of listSources(paper.id)) blocks.push({ t: "li", text: s.citation });
  return blocks;
}

function sourceListBlocks(paper: Paper): Block[] {
  const blocks: Block[] = [{ t: "title", text: `${paper.title} — sources` }];
  for (const s of listSources(paper.id)) blocks.push({ t: "li", text: s.citation });
  return blocks;
}

function toMarkdown(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case "title":
        out.push(`# ${b.text}`, "");
        break;
      case "h":
        out.push(`${"#".repeat(b.level + 1)} ${b.text}`, "");
        break;
      case "p":
        out.push(b.italic ? `*${b.text}*` : b.text, "");
        break;
      case "label":
        out.push(`- **${b.label}** — ${b.text}`, "");
        break;
      case "quote":
        out.push(...b.text.split("\n").map((l) => `> ${l}`), "");
        break;
      case "li":
        out.push(`- ${b.text}`);
        break;
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

async function toDocx(blocks: Block[]): Promise<Buffer> {
  const paragraphs: Paragraph[] = [];
  for (const b of blocks) {
    switch (b.t) {
      case "title":
        paragraphs.push(new Paragraph({ text: b.text, heading: HeadingLevel.TITLE }));
        break;
      case "h":
        paragraphs.push(
          new Paragraph({
            text: b.text,
            heading: b.level === 1 ? HeadingLevel.HEADING_1 : b.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          }),
        );
        break;
      case "p":
        paragraphs.push(new Paragraph({ children: [new TextRun({ text: b.text, italics: b.italic })] }));
        break;
      case "label":
        paragraphs.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun({ text: b.label + " — ", bold: true }), new TextRun(b.text)],
          }),
        );
        break;
      case "quote":
        paragraphs.push(new Paragraph({ indent: { left: 720 }, children: [new TextRun({ text: b.text, italics: true })] }));
        break;
      case "li":
        paragraphs.push(new Paragraph({ text: b.text, bullet: { level: 0 } }));
        break;
    }
  }
  const doc = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBuffer(doc);
}

function targetPath(slug: string, ext: string, suffix = "") {
  ensureDir(EXPORTS_DIR);
  const base = `${slug}${suffix}-${todayISO()}`;
  let candidate = path.join(EXPORTS_DIR, `${base}${ext}`);
  let n = 2;
  while (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
    candidate = path.join(EXPORTS_DIR, `${base}-${n}${ext}`);
    n += 1;
  }
  return candidate;
}

export async function exportPaper(paper: Paper, format: "docx" | "md"): Promise<string> {
  const blocks = paperBlocks(paper);
  const target = targetPath(paper.slug, `.${format}`);
  if (format === "md") fs.writeFileSync(target, toMarkdown(blocks), "utf8");
  else fs.writeFileSync(target, await toDocx(blocks));
  return target;
}

export async function exportSourceList(paper: Paper, format: "docx" | "md"): Promise<string> {
  const blocks = sourceListBlocks(paper);
  const target = targetPath(paper.slug, `.${format}`, "-sources");
  if (format === "md") fs.writeFileSync(target, toMarkdown(blocks), "utf8");
  else fs.writeFileSync(target, await toDocx(blocks));
  return target;
}
