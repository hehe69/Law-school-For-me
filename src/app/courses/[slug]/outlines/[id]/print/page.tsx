import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { termsFromNodes } from "@/lib/glossary";
import { childrenOf, descendantIds, flatten } from "@/lib/tree";
import { numberingLabel } from "@/lib/numbering";
import type { NodeMap } from "@/lib/types";
import { NodeDocument, type SourcesMode } from "@/components/doc/NodeDocument";
import { PrintButton } from "@/components/views/PrintButton";
import { SectionSelect } from "@/components/views/SectionSelect";

/**
 * Print view: the full outline (or an attack outline, or one section) with a table of contents and page
 * numbers (via CSS @page). Options in the URL: section=<nodeId>, sources=inline|footnotes|none, answers=1.
 */
export default async function PrintPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug, id } = await params;
  const q = await searchParams;
  const bundle = loadBundle(getDb(), id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  const map: NodeMap = {};
  for (const n of bundle.nodes) map[n.id] = n;
  const sectionId = typeof q.section === "string" && map[q.section] ? q.section : null;
  const sources: SourcesMode = q.sources === "footnotes" ? "footnotes" : q.sources === "none" ? "none" : "inline";
  const answers = q.answers === "1";
  const title = sectionId ? map[sectionId].title : bundle.outline.name;
  const tocRows = sectionId ? [] : flatten(map, false).filter((r) => r.depth <= 1);
  const base = `/courses/${slug}/outlines/${id}/print`;
  const opt = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const current: Record<string, string | null> = { section: sectionId, sources, answers: answers ? "1" : null, ...patch };
    for (const [k, v] of Object.entries(current)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };
  const nodeCount = sectionId ? 1 + descendantIds(map, sectionId).length : bundle.nodes.length;

  return (
    <div className="print-doc mx-auto w-full max-w-4xl px-8 py-6">
      <div className="print-hidden mb-6 flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
        <span className="font-medium">Print</span>
        <span className="text-gray-500">{nodeCount} nodes</span>
        <SectionSelect
          label="Section"
          value={sectionId ?? ""}
          options={[
            { value: "", href: opt({ section: null }), text: "Whole outline" },
            ...childrenOf(map, null).map((n, i) => ({ value: n.id, href: opt({ section: n.id }), text: `${numberingLabel(bundle.outline.numbering, [i])} ${n.title || "(untitled)"}` })),
          ]}
        />
        <span className="ml-2 text-gray-500">Sources:</span>
        {(["inline", "footnotes", "none"] as const).map((m) => (
          <Link key={m} href={opt({ sources: m })} className={`btn py-0 text-xs ${sources === m ? "border-gray-900" : ""}`}>
            {m}
          </Link>
        ))}
        <Link href={opt({ answers: answers ? null : "1" })} className={`btn py-0 text-xs ${answers ? "border-gray-900" : ""}`}>
          {answers ? "Hypo answers shown" : "Hypo answers hidden"}
        </Link>
        <span className="ml-auto" />
        <Link href={`/courses/${slug}/outlines/${id}/export`} className="btn">
          Export file…
        </Link>
        <Link href={`/courses/${slug}/outlines/${id}`} className="btn">
          Editor
        </Link>
        <PrintButton />
      </div>

      <header className="print-header">
        <div className="text-xs uppercase tracking-wide text-gray-500">{bundle.course.title}</div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="text-xs text-gray-500">
          {bundle.outline.kind === "attack" ? "Attack outline" : sectionId ? "Section" : "Full outline"} · {new Date().toLocaleDateString()}
          {bundle.course.examDate ? ` · exam ${bundle.course.examDate}` : ""}
        </div>
      </header>

      {tocRows.length > 0 && (
        <nav className="print-toc mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Contents</h2>
          <ol className="mt-2 text-sm">
            {tocRows.map((r) => (
              <li key={r.node.id} style={{ paddingLeft: r.depth * 16 }} className="py-0.5">
                <a href={`#node-${r.node.id}`} className="text-gray-800">
                  <span className="font-mono text-gray-500">{numberingLabel(bundle.outline.numbering, r.path)}</span> {r.node.title || "(untitled)"}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="mt-6">
        <NodeDocument nodes={bundle.nodes} images={bundle.images} sources={bundle.sources} numbering={bundle.outline.numbering} rootId={sectionId} terms={termsFromNodes(bundle.nodes)} sourcesMode={sources} revealAnswers={answers} />
      </div>
    </div>
  );
}
