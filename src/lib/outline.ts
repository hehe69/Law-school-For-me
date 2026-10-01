// Course outline: every unit in order, its rule notes then its case notes, text verbatim.
// One builder feeds both the outline page and the markdown export.

import os from "node:os";
import path from "node:path";
import type { Course, Note } from "./content/types";

export const OUTLINE_DIR = path.join(os.homedir(), "Documents", "law-school-outlines");

export type OutlineEntry = { label: string; text?: string; items?: string[] };
export type OutlineNote = { slug: string; unitSlug: string; kind: "rule" | "case"; title: string; draft: boolean; entries: OutlineEntry[] };
export type OutlineUnit = { slug: string; order: number; title: string; rules: OutlineNote[]; cases: OutlineNote[] };

function noteEntries(note: Note): OutlineNote | null {
  const fm = note.frontmatter;
  const base = { slug: note.slug, unitSlug: "", draft: note.status === "draft" };
  if (fm.type === "rule") {
    return {
      ...base,
      kind: "rule",
      title: fm.name || "(untitled)",
      entries: [
        { label: "Rule statement", text: fm.ruleStatement },
        { label: "Elements", items: fm.elements },
        { label: "Exceptions", items: fm.exceptions },
        { label: "Wisconsin variation", text: fm.wisconsinVariation },
      ],
    };
  }
  if (fm.type === "case") {
    return { ...base, kind: "case", title: fm.name || "(untitled)", entries: [{ label: "Rule", text: fm.rule }, { label: "Holding", text: fm.holding }] };
  }
  return null;
}

export function buildOutline(course: Course): OutlineUnit[] {
  return course.units.map((unit) => {
    const notes = unit.notes.map(noteEntries).filter((n): n is OutlineNote => n !== null).map((n) => ({ ...n, unitSlug: unit.slug }));
    return { slug: unit.slug, order: unit.order, title: unit.title, rules: notes.filter((n) => n.kind === "rule"), cases: notes.filter((n) => n.kind === "case") };
  });
}

/** The outline as markdown. Field text is copied as written; nothing is summarised or rewritten. */
export function outlineMarkdown(course: Course, units: OutlineUnit[], generatedOn: string): string {
  const lines: string[] = [`# ${course.title}`, "", `Outline exported ${generatedOn}.`, ""];
  const note = (n: OutlineNote) => {
    lines.push(`### ${n.title}${n.draft ? " (draft)" : ""}`, "");
    for (const e of n.entries) {
      if (e.items) {
        lines.push(`**${e.label}**`, "");
        if (e.items.length === 0) lines.push("- (none)");
        for (const it of e.items) lines.push(`- ${it}`);
        lines.push("");
      } else {
        lines.push(`**${e.label}:** ${e.text?.trim() ? e.text : "(empty)"}`, "");
      }
    }
  };
  for (const u of units) {
    lines.push(`## Unit ${u.order}: ${u.title}`, "");
    if (u.rules.length === 0 && u.cases.length === 0) lines.push("_No rule or case notes yet._", "");
    for (const r of u.rules) note(r);
    for (const c of u.cases) note(c);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
