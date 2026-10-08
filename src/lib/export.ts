// Exports: Word (.docx with real heading styles), PDF (pdfkit, with a table of contents, page numbers and
// images) and markdown. Files go to ~/Documents/law-outlines-export/<course>-<outline>-<date>.<ext>.

import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import {
  AlignmentType,
  Document,
  Footer,
  FootnoteReferenceRun,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  WidthType,
  type IParagraphOptions,
} from "docx";
import type { ImageRow, NodeMap, Outline, Source } from "./types.ts";
import type { Db } from "./db.ts";
import { loadBundle } from "./nodes.ts";
import { descendantIds, flatten, type Row } from "./tree.ts";
import { numberingLabel } from "./numbering.ts";
import { nodeBlocks, type Block } from "./document.ts";
import { typeDef } from "./fields.ts";
import { EXPORT_DIR, UPLOADS_DIR } from "./paths.ts";
import { slugify } from "./slug.ts";
import { imageSize } from "./imagesize.ts";

export type ExportFormat = "docx" | "pdf" | "md";
export type ExportOptions = {
  format: ExportFormat;
  /** Export only this node and its descendants */
  sectionId: string | null;
  sources: "inline" | "footnotes" | "none";
  revealAnswers: boolean;
};

export type ExportResult = { path: string; bytes: number; file: string };

function dateStamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function exportFileName(courseSlug: string, outline: Outline, format: ExportFormat, sectionTitle?: string | null): string {
  const base = `${courseSlug}-${slugify(outline.name)}${sectionTitle ? `-${slugify(sectionTitle).slice(0, 40)}` : ""}-${dateStamp()}`;
  return `${base}.${format}`;
}

// ---- shared document model ------------------------------------------------------------------------------

type DocRow = Row & { label: string; blocks: Block[]; images: ImageRow[]; sources: Source[] };

function buildRows(db: Db, outlineId: string, sectionId: string | null): { rows: DocRow[]; outline: Outline; courseSlug: string; courseTitle: string; title: string } | null {
  const bundle = loadBundle(db, outlineId);
  if (!bundle) return null;
  const map: NodeMap = {};
  for (const n of bundle.nodes) map[n.id] = n;
  const all = flatten(map, false);
  const keep = sectionId && map[sectionId] ? new Set([sectionId, ...descendantIds(map, sectionId)]) : null;
  const titleOf = (id: string) => map[id]?.title ?? null;
  const baseDepth = keep ? (all.find((r) => r.node.id === sectionId)?.depth ?? 0) : 0;
  const rows: DocRow[] = all
    .filter((r) => !keep || keep.has(r.node.id))
    .map((r) => ({
      ...r,
      depth: r.depth - baseDepth,
      label: numberingLabel(bundle.outline.numbering, r.path),
      blocks: nodeBlocks(r.node, titleOf),
      images: bundle.images.filter((i) => i.nodeId === r.node.id),
      sources: bundle.sources.filter((s) => s.nodeId === r.node.id),
    }));
  return { rows, outline: bundle.outline, courseSlug: bundle.course.slug, courseTitle: bundle.course.title, title: keep ? map[sectionId!].title : bundle.outline.name };
}

function sourceText(s: Source): string {
  return `${s.kind}${s.reference ? `: ${s.reference}` : ""}${s.url ? ` (${s.url})` : ""}`;
}

/** Markdown with the inline marks and links stripped, for the PDF. */
function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, ""))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .trim();
}

/** pdfkit's standard fonts only know WinAnsi; swap the few symbols the app uses that are outside it. */
function winAnsi(s: string): string {
  return s.replace(/→/g, "->").replace(/←/g, "<-").replace(/⇄/g, "<->").replace(/⚑/g, "*").replace(/✓/g, "v").replace(/…/g, "...").replace(/[^\x00-\xff–—‘’“”•…€]/g, "?");
}

// ---- markdown ---------------------------------------------------------------------------------------------

export function renderMarkdown(rows: DocRow[], title: string, courseTitle: string, opts: ExportOptions, imageDir: string | null): string {
  const out: string[] = [`# ${title}`, "", `${courseTitle} · exported ${dateStamp()}`, ""];
  const footnotes: Source[] = [];
  for (const r of rows) {
    const level = Math.min(6, r.depth + 2);
    const heading = `${"#".repeat(level)} ${r.label} ${r.node.title || "(untitled)"}${r.node.type !== "heading" && r.node.type !== "free" ? ` _(${typeDef(r.node.type).label.toLowerCase()})_` : ""}`;
    let refs = "";
    if (opts.sources === "footnotes" && r.sources.length) {
      refs = r.sources
        .map((s) => {
          footnotes.push(s);
          return `[^${footnotes.length}]`;
        })
        .join("");
    }
    out.push(heading + refs, "");
    for (const b of r.blocks) {
      switch (b.kind) {
        case "text":
          out.push(b.label ? `**${b.label}.** ${b.text}` : b.text, "");
          break;
        case "quote":
          out.push(...b.text.split("\n").map((l) => `> ${l}`), "");
          break;
        case "list":
          out.push(`**${b.label}**`, "");
          b.items.forEach((it, i) => out.push(`${b.ordered ? `${i + 1}.` : "-"} ${it.text}${it.sub ? ` — _${it.sub}_` : ""}`));
          out.push("");
          break;
        case "hidden":
          if (opts.revealAnswers) out.push(`**${b.label}.** ${b.text}`, "");
          else out.push(`<details><summary>${b.label}</summary>\n\n${b.text}\n\n</details>`, "");
          break;
        case "table":
          out.push(`| ${b.columns.join(" | ")} |`, `| ${b.columns.map(() => "---").join(" | ")} |`, ...b.rows.map((row) => `| ${row.join(" | ")} |`), "");
          break;
        case "chip":
          out.push(`⚑ **${b.text}**`, "");
          break;
        case "ref":
          out.push(`**${b.label}.** ${b.title}`, "");
          break;
      }
    }
    if (r.node.body.trim()) out.push(r.node.body.trim(), "");
    for (const img of r.images) {
      const file = path.basename(img.filePath);
      out.push(`![${img.caption}](${imageDir ? `${imageDir}/${file}` : path.join(UPLOADS_DIR, img.filePath)})`, "");
      if (img.caption) out.push(`_${img.caption}_`, "");
    }
    if (opts.sources === "inline" && r.sources.length) out.push(`_Sources: ${r.sources.map(sourceText).join("; ")}_`, "");
  }
  if (footnotes.length) {
    out.push("");
    footnotes.forEach((s, i) => out.push(`[^${i + 1}]: ${sourceText(s)}`));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

// ---- docx ---------------------------------------------------------------------------------------------------

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

/** Inline markdown (bold, italic, code, links) into runs. */
function runs(text: string, base: { bold?: boolean; italics?: boolean; size?: number } = {}): TextRun[] {
  const out: TextRun[] = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)([^*_]+?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    if (m[2] !== undefined) out.push(new TextRun({ text: m[2], ...base, bold: true }));
    else if (m[4] !== undefined) out.push(new TextRun({ text: m[4], ...base, italics: true }));
    else if (m[5] !== undefined) out.push(new TextRun({ text: m[5], ...base, font: "Courier New" }));
    else if (m[6] !== undefined) out.push(new TextRun({ text: m[6], ...base, underline: {} }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out.length ? out : [new TextRun({ text, ...base })];
}

/** Markdown body into paragraphs: headings become bold lines, lists keep their bullets, quotes go italic. */
function bodyParagraphs(md: string, indentLeft: number): Paragraph[] {
  const paras: Paragraph[] = [];
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) paras.push(new Paragraph({ children: runs(buffer.join(" ")), indent: { left: indentLeft }, spacing: { after: 80 } }));
    buffer = [];
  };
  for (const raw of md.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    const li = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (li) {
      flush();
      const level = Math.min(2, Math.floor(li[1].length / 2));
      paras.push(new Paragraph({ children: runs(li[2]), numbering: { reference: "bullets", level }, indent: { left: indentLeft + 360 * (level + 1), hanging: 260 }, spacing: { after: 40 } }));
      continue;
    }
    const h = /^#{1,6}\s+(.*)$/.exec(line);
    if (h) {
      flush();
      paras.push(new Paragraph({ children: runs(h[1], { bold: true }), indent: { left: indentLeft }, spacing: { before: 80, after: 40 } }));
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      flush();
      paras.push(new Paragraph({ children: runs(q[1], { italics: true }), indent: { left: indentLeft + 360 }, spacing: { after: 60 } }));
      continue;
    }
    buffer.push(line.trim());
  }
  flush();
  return paras;
}

export async function renderDocx(rows: DocRow[], title: string, courseTitle: string, opts: ExportOptions): Promise<Buffer> {
  const children: (Paragraph | Table | TableOfContents)[] = [];
  const footnotes: Record<number, { children: Paragraph[] }> = {};
  let footnoteId = 0;
  children.push(new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 40 })], spacing: { after: 120 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: `${courseTitle} · exported ${dateStamp()}`, color: "666666", size: 18 })], spacing: { after: 240 } }));
  if (!opts.sectionId && rows.length > 3) {
    children.push(new Paragraph({ children: [new TextRun({ text: "Contents", bold: true })], spacing: { after: 80 } }));
    children.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }));
    children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  }
  for (const r of rows) {
    const level = Math.min(5, r.depth);
    const indent = Math.max(0, r.depth - 5) * 360;
    const headingRuns = [new TextRun({ text: `${r.label} ` }), new TextRun({ text: r.node.title || "(untitled)" })];
    if (r.node.type !== "heading" && r.node.type !== "free") headingRuns.push(new TextRun({ text: `  ${typeDef(r.node.type).label}`, size: 16, color: "888888" }));
    if (opts.sources === "footnotes") {
      for (const s of r.sources) {
        footnoteId++;
        footnotes[footnoteId] = { children: [new Paragraph(sourceText(s))] };
        headingRuns.push(new FootnoteReferenceRun(footnoteId));
      }
    }
    const headingOptions: IParagraphOptions = { children: headingRuns, heading: HEADINGS[level], indent: { left: indent }, spacing: { before: 160, after: 60 } };
    children.push(new Paragraph(headingOptions));
    const left = indent + 360;
    for (const b of r.blocks) {
      switch (b.kind) {
        case "text":
          children.push(new Paragraph({ children: [...(b.label ? [new TextRun({ text: `${b.label}. `, bold: true })] : []), ...runs(b.text)], indent: { left }, spacing: { after: 80 } }));
          break;
        case "quote":
          children.push(new Paragraph({ children: runs(b.text, { italics: true }), indent: { left: left + 360 }, spacing: { after: 80 } }));
          break;
        case "list":
          children.push(new Paragraph({ children: [new TextRun({ text: b.label, bold: true })], indent: { left }, spacing: { after: 40 } }));
          b.items.forEach((it, i) => {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: b.ordered ? `${i + 1}. ` : "• " }), ...runs(it.text), ...(it.sub ? [new TextRun({ text: ` — ${it.sub}`, italics: true, color: "555555" })] : [])],
                indent: { left: left + 360, hanging: 260 },
                spacing: { after: 40 },
              }),
            );
          });
          break;
        case "hidden":
          if (opts.revealAnswers) children.push(new Paragraph({ children: [new TextRun({ text: `${b.label}. `, bold: true }), ...runs(b.text)], indent: { left }, spacing: { after: 80 } }));
          break;
        case "table":
          children.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({ children: b.columns.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })] })) }),
                ...b.rows.map((row) => new TableRow({ children: b.columns.map((_, j) => new TableCell({ children: [new Paragraph({ children: runs(row[j] ?? "") })] })) })),
              ],
            }),
          );
          children.push(new Paragraph({ spacing: { after: 80 } }));
          break;
        case "chip":
          children.push(new Paragraph({ children: [new TextRun({ text: `⚑ ${b.text}`, bold: true })], indent: { left }, spacing: { after: 80 } }));
          break;
        case "ref":
          children.push(new Paragraph({ children: [new TextRun({ text: `${b.label}. `, bold: true }), new TextRun({ text: b.title })], indent: { left }, spacing: { after: 80 } }));
          break;
      }
    }
    if (r.node.body.trim()) children.push(...bodyParagraphs(r.node.body, left));
    for (const img of r.images) {
      const file = path.join(UPLOADS_DIR, img.filePath);
      if (!fs.existsSync(file)) continue;
      const data = fs.readFileSync(file);
      const size = imageSize(data);
      if (!size) {
        children.push(new Paragraph({ children: [new TextRun({ text: `[image: ${img.caption || path.basename(img.filePath)}]`, italics: true, color: "666666" })], indent: { left } }));
        continue;
      }
      const maxW = 440;
      const w = Math.min(maxW, img.widthHint ?? size.width * 0.75);
      const h = (size.height / size.width) * w;
      children.push(new Paragraph({ children: [new ImageRun({ type: size.type, data, transformation: { width: Math.round(w), height: Math.round(h) } })], indent: { left }, spacing: { before: 80, after: 40 } }));
      if (img.caption) children.push(new Paragraph({ children: [new TextRun({ text: img.caption, italics: true, size: 18, color: "555555" })], indent: { left }, spacing: { after: 100 } }));
    }
    if (opts.sources === "inline" && r.sources.length) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Sources: ${r.sources.map(sourceText).join("; ")}`, size: 16, color: "666666" })], indent: { left }, spacing: { after: 120 } }));
    }
  }
  const doc = new Document({
    creator: "Law Outlines",
    title,
    features: { updateFields: true },
    footnotes: Object.keys(footnotes).length ? footnotes : undefined,
    numbering: {
      config: [{ reference: "bullets", levels: [0, 1, 2].map((level) => ({ level, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 260 } } } })) }],
    },
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true }, paragraph: { spacing: { before: 240, after: 80 } } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true }, paragraph: { spacing: { before: 200, after: 60 } } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true } },
        { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true } },
        { id: "Heading5", name: "Heading 5", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, italics: true } },
        { id: "Heading6", name: "Heading 6", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, italics: true } },
      ],
    },
    sections: [
      {
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "666666" })] })] }) },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

// ---- pdf ------------------------------------------------------------------------------------------------------

export function renderPdf(rows: DocRow[], title: string, courseTitle: string, opts: ExportOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margins: { top: 60, bottom: 60, left: 60, right: 60 }, bufferPages: true, info: { Title: title, Author: "Law Outlines" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    let pageIndex = 0;
    doc.on("pageAdded", () => {
      pageIndex++;
    });
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const t = (s: string) => winAnsi(s);

    doc.font("Helvetica-Bold").fontSize(20).text(t(title), { width });
    doc.font("Helvetica").fontSize(9).fillColor("#666666").text(t(`${courseTitle} · exported ${dateStamp()}`), { width });
    doc.fillColor("#000000").moveDown(1);

    // Table of contents: entries now, page numbers after the body is laid out.
    const tocEntries: { page: number; y: number; row: DocRow }[] = [];
    const tocRows = opts.sectionId ? [] : rows.filter((r) => r.depth <= 1);
    const numbersAt = new Map<string, number>();
    if (tocRows.length) {
      doc.font("Helvetica-Bold").fontSize(12).text("Contents", { width });
      doc.moveDown(0.3);
      for (const r of tocRows) {
        doc.font("Helvetica").fontSize(10);
        const line = t(`${r.label} ${r.node.title || "(untitled)"}`);
        const x = doc.page.margins.left + r.depth * 14;
        if (doc.y + 14 > doc.page.height - doc.page.margins.bottom) doc.addPage();
        tocEntries.push({ page: pageIndex, y: doc.y, row: r });
        doc.text(line, x, doc.y, { width: width - r.depth * 14 - 40, lineBreak: false, ellipsis: true });
        doc.moveDown(0.25);
      }
      doc.addPage();
    }

    const footnotes: Source[] = [];
    for (const r of rows) {
      const size = r.depth === 0 ? 15 : r.depth === 1 ? 13 : r.depth === 2 ? 11.5 : 10.5;
      const x = doc.page.margins.left + Math.min(r.depth, 6) * 14;
      const w = width - Math.min(r.depth, 6) * 14;
      if (doc.y + size * 3 > doc.page.height - doc.page.margins.bottom) doc.addPage();
      if (r.depth === 0 && rows.indexOf(r) > 0) doc.moveDown(0.6);
      numbersAt.set(r.node.id, pageIndex);
      let heading = t(`${r.label} ${r.node.title || "(untitled)"}`);
      if (opts.sources === "footnotes" && r.sources.length) {
        const refs = r.sources.map((s) => {
          footnotes.push(s);
          return footnotes.length;
        });
        heading += ` [${refs.join(",")}]`;
      }
      doc.font("Helvetica-Bold").fontSize(size).fillColor("#000000").text(heading, x, doc.y, { width: w });
      if (r.node.type !== "heading" && r.node.type !== "free") doc.font("Helvetica").fontSize(7.5).fillColor("#777777").text(typeDef(r.node.type).label.toUpperCase(), x, doc.y, { width: w });
      doc.fillColor("#000000").font("Helvetica").fontSize(10);
      const bx = x + 14;
      const bw = w - 14;
      const para = (text: string, label?: string, italic = false) => {
        if (label) {
          doc.font("Helvetica-Bold").text(t(`${label}. `), bx, doc.y, { width: bw, continued: true });
          doc.font(italic ? "Helvetica-Oblique" : "Helvetica").text(t(text), { width: bw });
        } else doc.font(italic ? "Helvetica-Oblique" : "Helvetica").text(t(text), bx, doc.y, { width: bw });
        doc.moveDown(0.2);
      };
      for (const b of r.blocks) {
        switch (b.kind) {
          case "text":
            para(plainText(b.text), b.label);
            break;
          case "quote":
            para(plainText(b.text), b.label, true);
            break;
          case "list":
            doc.font("Helvetica-Bold").text(t(b.label), bx, doc.y, { width: bw });
            b.items.forEach((it, i) => {
              doc.font("Helvetica").text(t(`${b.ordered ? `${i + 1}.` : "•"} ${plainText(it.text)}${it.sub ? ` — ${it.sub}` : ""}`), bx + 12, doc.y, { width: bw - 12 });
            });
            doc.moveDown(0.2);
            break;
          case "hidden":
            if (opts.revealAnswers) para(plainText(b.text), b.label);
            else para("(hidden)", b.label, true);
            break;
          case "table": {
            const cols = Math.max(1, b.columns.length);
            const cw = bw / cols;
            const rowsAll = [b.columns, ...b.rows];
            for (const [ri, row] of rowsAll.entries()) {
              const y0 = doc.y;
              let maxH = 0;
              row.forEach((cell, ci) => {
                doc.font(ri === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(9);
                const h = doc.heightOfString(t(cell), { width: cw - 6 });
                doc.text(t(cell), bx + ci * cw + 3, y0 + 2, { width: cw - 6 });
                maxH = Math.max(maxH, h + 4);
              });
              doc.rect(bx, y0, cw * cols, maxH).strokeColor("#bbbbbb").stroke();
              doc.y = y0 + maxH;
            }
            doc.fontSize(10).moveDown(0.3);
            break;
          }
          case "chip":
            para(`* ${b.text}`, undefined);
            break;
          case "ref":
            para(b.title, b.label);
            break;
        }
      }
      if (r.node.body.trim()) para(plainText(r.node.body));
      for (const img of r.images) {
        const file = path.join(UPLOADS_DIR, img.filePath);
        if (!fs.existsSync(file)) continue;
        const data = fs.readFileSync(file);
        const size = imageSize(data);
        if (!size) {
          para(`[image: ${img.caption || path.basename(img.filePath)}]`, undefined, true);
          continue;
        }
        const iw = Math.min(bw, img.widthHint ?? size.width * 0.75, 400);
        const ih = (size.height / size.width) * iw;
        if (doc.y + ih + 20 > doc.page.height - doc.page.margins.bottom) doc.addPage();
        try {
          doc.image(data, bx, doc.y, { width: iw });
          doc.y += ih + 4;
        } catch {
          para(`[image: ${img.caption || path.basename(img.filePath)}]`, undefined, true);
        }
        if (img.caption) para(img.caption, undefined, true);
      }
      if (opts.sources === "inline" && r.sources.length) {
        doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#666666").text(t(`Sources: ${r.sources.map(sourceText).join("; ")}`), bx, doc.y, { width: bw });
        doc.fillColor("#000000").fontSize(10).moveDown(0.2);
      }
    }
    if (footnotes.length) {
      doc.addPage();
      doc.font("Helvetica-Bold").fontSize(12).text("Sources", { width });
      doc.moveDown(0.3);
      footnotes.forEach((s, i) => doc.font("Helvetica").fontSize(9).text(t(`${i + 1}. ${sourceText(s)}`), doc.page.margins.left, doc.y, { width }));
    }

    // Page numbers, then the table of contents numbers.
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor("#666666").text(String(i + 1), doc.page.margins.left, doc.page.height - doc.page.margins.bottom + 20, { width, align: "right", lineBreak: false });
    }
    for (const e of tocEntries) {
      const n = numbersAt.get(e.row.node.id);
      if (n === undefined) continue;
      doc.switchToPage(e.page);
      doc.font("Helvetica").fontSize(10).fillColor("#000000").text(String(n + 1), doc.page.margins.left, e.y, { width, align: "right", lineBreak: false });
    }
    doc.end();
  });
}

// ---- entry point --------------------------------------------------------------------------------------------

export async function exportOutline(db: Db, outlineId: string, opts: ExportOptions, exportDir = EXPORT_DIR): Promise<ExportResult | null> {
  const built = buildRows(db, outlineId, opts.sectionId);
  if (!built) return null;
  const { rows, outline, courseSlug, courseTitle, title } = built;
  fs.mkdirSync(exportDir, { recursive: true });
  const file = exportFileName(courseSlug, outline, opts.format, opts.sectionId ? title : null);
  const target = path.join(exportDir, file);
  let data: Buffer;
  if (opts.format === "md") {
    // Images are copied next to the markdown so the file stands on its own.
    const imageDirName = `${file.replace(/\.md$/, "")}-images`;
    const used = rows.flatMap((r) => r.images);
    if (used.length) {
      fs.mkdirSync(path.join(exportDir, imageDirName), { recursive: true });
      for (const img of used) {
        const src = path.join(UPLOADS_DIR, img.filePath);
        if (fs.existsSync(src)) fs.copyFileSync(src, path.join(exportDir, imageDirName, path.basename(img.filePath)));
      }
    }
    data = Buffer.from(renderMarkdown(rows, title, courseTitle, opts, used.length ? imageDirName : null), "utf8");
  } else if (opts.format === "docx") data = await renderDocx(rows, title, courseTitle, opts);
  else data = await renderPdf(rows, title, courseTitle, opts);
  fs.writeFileSync(target, data);
  return { path: target, bytes: data.length, file };
}
