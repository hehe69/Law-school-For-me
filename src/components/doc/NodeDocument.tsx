"use client";

// Renders a branch (or a whole outline) as a clean document: numbering, titles, typed fields, notes, images
// and sources. Used by reading mode, exam mode and the print views.

import { Fragment, useMemo } from "react";
import type { ImageRow, NodeMap, NumberingStyle, OutlineNode, Source } from "@/lib/types";
import { flatten, descendantIds } from "@/lib/tree";
import { numberingLabel } from "@/lib/numbering";
import { nodeBlocks, type Block } from "@/lib/document";
import { typeDef } from "@/lib/fields";
import type { Term } from "@/lib/glossary";
import { Markdown } from "@/components/Markdown";

export type SourcesMode = "inline" | "footnotes" | "none";

type Props = {
  nodes: OutlineNode[];
  images: ImageRow[];
  sources: Source[];
  numbering: NumberingStyle;
  /** Render only this node and its descendants; null = everything */
  rootId: string | null;
  terms?: Term[];
  sourcesMode?: SourcesMode;
  /** Larger type for exam mode and reading */
  large?: boolean;
  /** Hypo answers open by default (print) */
  revealAnswers?: boolean;
  /** Extra content rendered after each top-level section's heading (exam mode buttons) */
  sectionTools?: (node: OutlineNode) => React.ReactNode;
};

const FLAG_CLASS: Record<string, string> = {
  red: "bg-red-100 text-red-800 border-red-300",
  amber: "bg-amber-100 text-amber-800 border-amber-300",
  green: "bg-green-100 text-green-800 border-green-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300",
  purple: "bg-purple-100 text-purple-800 border-purple-300",
  grey: "bg-gray-100 text-gray-700 border-gray-300",
};

function BlockView({ block, terms, skipNodeId, revealAnswers }: { block: Block; terms?: Term[]; skipNodeId: string; revealAnswers?: boolean }) {
  switch (block.kind) {
    case "text":
      return (
        <div className="doc-block">
          {block.label && <span className="doc-label">{block.label}. </span>}
          <Markdown text={block.text} className="inline-md" terms={terms} skipNodeId={skipNodeId} />
        </div>
      );
    case "list":
      return (
        <div className="doc-block">
          <span className="doc-label">{block.label}</span>
          {block.ordered ? (
            <ol className="list-decimal pl-5">
              {block.items.map((it, i) => (
                <li key={i}>
                  <Markdown text={it.text} className="inline-md" terms={terms} skipNodeId={skipNodeId} />
                  {it.sub && <span className="doc-sub"> — {it.sub}</span>}
                </li>
              ))}
            </ol>
          ) : (
            <ul className="list-disc pl-5">
              {block.items.map((it, i) => (
                <li key={i}>
                  <Markdown text={it.text} className="inline-md" terms={terms} skipNodeId={skipNodeId} />
                  {it.sub && <span className="doc-sub"> — {it.sub}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    case "quote":
      return (
        <blockquote className="doc-block border-l-2 border-gray-300 pl-3 text-gray-700">
          {block.label && <span className="doc-label">{block.label}. </span>}
          <Markdown text={block.text} terms={terms} skipNodeId={skipNodeId} />
        </blockquote>
      );
    case "hidden":
      return (
        <details className="doc-block" open={revealAnswers}>
          <summary className="cursor-pointer text-gray-600">{block.label} (click to reveal)</summary>
          <Markdown text={block.text} terms={terms} skipNodeId={skipNodeId} />
        </details>
      );
    case "table":
      return (
        <table className="doc-block doc-table">
          <thead>
            <tr>
              {block.columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case "chip":
      return <span className={`doc-block inline-block rounded border px-2 py-0.5 text-sm ${FLAG_CLASS[block.color] ?? FLAG_CLASS.amber}`}>⚑ {block.text}</span>;
    case "ref":
      return (
        <div className="doc-block">
          <span className="doc-label">{block.label}. </span>
          <a href={`#node-${block.nodeId}`} className="text-blue-700 underline">
            {block.title}
          </a>
        </div>
      );
  }
}

export function NodeDocument({ nodes, images, sources, numbering, rootId, terms, sourcesMode = "inline", large, revealAnswers, sectionTools }: Props) {
  const { rows, footnotes } = useMemo(() => {
    const map: NodeMap = {};
    for (const n of nodes) map[n.id] = n;
    const all = flatten(map, false);
    const keep = rootId ? new Set([rootId, ...descendantIds(map, rootId)]) : null;
    const rows = all.filter((r) => !keep || keep.has(r.node.id));
    const baseDepth = rootId ? (rows[0]?.depth ?? 0) : 0;
    const footnotes: Source[] = [];
    if (sourcesMode === "footnotes") for (const r of rows) for (const s of sources.filter((s) => s.nodeId === r.node.id)) footnotes.push(s);
    return { rows: rows.map((r) => ({ ...r, depth: r.depth - baseDepth })), footnotes };
  }, [nodes, rootId, sources, sourcesMode]);
  const titleOf = (id: string) => nodes.find((n) => n.id === id)?.title ?? null;
  const imagesOf = (id: string) => images.filter((i) => i.nodeId === id);
  const sourcesOf = (id: string) => sources.filter((s) => s.nodeId === id);

  return (
    <div className={`doc ${large ? "doc-large" : ""}`}>
      {rows.map((r) => {
        const node = r.node;
        const label = numberingLabel(numbering, r.path);
        const blocks = nodeBlocks(node, titleOf);
        const imgs = imagesOf(node.id);
        const srcs = sourcesOf(node.id);
        const level = Math.min(6, r.depth + 1);
        const HeadingTag = `h${level}` as "h1";
        return (
          <section key={node.id} id={`node-${node.id}`} className={`doc-node doc-depth-${Math.min(r.depth, 5)}`} style={{ marginLeft: r.depth * 18 }}>
            <HeadingTag className="doc-title">
              <span className="doc-num">{label}</span> {node.title || <span className="text-gray-400">(untitled)</span>}
              {node.type !== "heading" && node.type !== "free" && <span className="doc-type">{typeDef(node.type).label}</span>}
              {sourcesMode === "footnotes" && srcs.length > 0 && (
                <sup className="ml-1 text-xs text-gray-500">{srcs.map((s) => footnotes.indexOf(s) + 1).join(",")}</sup>
              )}
              {sectionTools && r.depth === 0 && <span className="doc-tools">{sectionTools(node)}</span>}
            </HeadingTag>
            {blocks.map((b, i) => (
              <BlockView key={i} block={b} terms={terms} skipNodeId={node.id} revealAnswers={revealAnswers} />
            ))}
            {node.body.trim() && <Markdown text={node.body} className="doc-body" terms={terms} skipNodeId={node.id} />}
            {imgs.map((img) => (
              <figure key={img.id} className="doc-figure">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/files/${img.filePath}`} alt={img.caption} style={{ width: img.widthHint ?? undefined, maxWidth: "100%" }} />
                {img.caption && <figcaption>{img.caption}</figcaption>}
              </figure>
            ))}
            {sourcesMode === "inline" && srcs.length > 0 && (
              <div className="doc-sources">
                {srcs.map((s, i) => (
                  <Fragment key={s.id}>
                    {i > 0 && "; "}
                    <span className="capitalize">{s.kind}</span>
                    {s.reference ? `: ${s.reference}` : ""}
                    {s.url && (
                      <>
                        {" "}
                        <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                          link
                        </a>
                      </>
                    )}
                  </Fragment>
                ))}
              </div>
            )}
          </section>
        );
      })}
      {sourcesMode === "footnotes" && footnotes.length > 0 && (
        <ol className="doc-footnotes">
          {footnotes.map((s) => (
            <li key={s.id}>
              <span className="capitalize">{s.kind}</span>
              {s.reference ? `: ${s.reference}` : ""}
              {s.url ? ` (${s.url})` : ""}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
