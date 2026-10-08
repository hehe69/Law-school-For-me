// Definition nodes make the glossary; their terms get hover tooltips wherever the outline is rendered as a
// document. Tooltips are added by turning occurrences into links of the form [term](#term:N), which the
// Markdown component renders as a span with a title.

import type { OutlineNode } from "./types.ts";

export type Term = { term: string; definition: string; nodeId: string; outlineId: string };

export function termsFromNodes(nodes: OutlineNode[]): Term[] {
  const out: Term[] = [];
  for (const n of nodes) {
    if (n.type !== "definition" || !n.title.trim()) continue;
    const definition = typeof n.fields.definition === "string" && n.fields.definition.trim() ? n.fields.definition.trim() : n.body.trim();
    if (!definition) continue;
    out.push({ term: n.title.trim(), definition, nodeId: n.id, outlineId: n.outlineId });
  }
  return out.sort((a, b) => a.term.localeCompare(b.term, undefined, { sensitivity: "base" }));
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wrap occurrences of glossary terms in `[term](#term:N)` links (N = index into `terms`). Longer terms win
 * over shorter ones; matches are whole words, case-insensitive; text inside existing links, code spans and
 * the term's own definition is left alone.
 */
export function markTerms(text: string, terms: Term[], skipNodeId?: string): string {
  const usable = terms.map((t, i) => ({ ...t, index: i })).filter((t) => t.nodeId !== skipNodeId && t.term.length >= 2);
  if (!usable.length || !text) return text;
  usable.sort((a, b) => b.term.length - a.term.length);
  const pattern = new RegExp(`(\`[^\`]*\`|\\[[^\\]]*\\]\\([^)]*\\))|\\b(${usable.map((t) => escapeRegExp(t.term)).join("|")})\\b`, "gi");
  const byLower = new Map(usable.map((t) => [t.term.toLowerCase(), t.index]));
  return text.replace(pattern, (m, protectedPart: string | undefined, term: string | undefined) => {
    if (protectedPart) return protectedPart;
    if (!term) return m;
    const index = byLower.get(term.toLowerCase());
    return index === undefined ? m : `[${term}](#term:${index})`;
  });
}
