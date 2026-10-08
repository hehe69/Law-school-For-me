import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { termsFromNodes } from "@/lib/glossary";
import { childrenOf } from "@/lib/tree";
import { numberingLabel } from "@/lib/numbering";
import type { NodeMap } from "@/lib/types";
import { NodeDocument } from "@/components/doc/NodeDocument";

/** Reading mode: one branch at a time as a clean document, with the sections of the outline on the side. */
export default async function ReadPage({ params }: { params: Promise<{ slug: string; id: string; nodeId: string }> }) {
  const { slug, id, nodeId } = await params;
  const db = getDb();
  const bundle = loadBundle(db, id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  const map: NodeMap = {};
  for (const n of bundle.nodes) map[n.id] = n;
  const node = map[nodeId];
  if (!node) notFound();
  const siblings = childrenOf(map, node.parentId);
  const index = siblings.findIndex((s) => s.id === node.id);
  const prev = siblings[index - 1] ?? null;
  const next = siblings[index + 1] ?? null;
  const parent = node.parentId ? map[node.parentId] : null;
  const sections = childrenOf(map, null);
  const base = `/courses/${slug}/outlines/${id}`;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-gray-200 p-3 text-sm md:block print-hidden">
        <Link href={base} className="text-gray-500 hover:text-gray-900">
          ← Editor
        </Link>
        <div className="mb-1 mt-3 text-xs uppercase tracking-wide text-gray-500">Sections</div>
        {sections.map((s, i) => (
          <Link key={s.id} href={`${base}/read/${s.id}`} className={`block truncate rounded px-1 py-0.5 hover:bg-gray-100 ${s.id === node.id ? "bg-gray-100 font-medium" : ""}`}>
            {numberingLabel(bundle.outline.numbering, [i])} {s.title || "(untitled)"}
          </Link>
        ))}
        <div className="mb-1 mt-4 text-xs uppercase tracking-wide text-gray-500">This branch</div>
        {childrenOf(map, node.id).map((c) => (
          <Link key={c.id} href={`${base}/read/${c.id}`} className="block truncate rounded px-1 py-0.5 text-gray-700 hover:bg-gray-100">
            {c.title || "(untitled)"}
          </Link>
        ))}
      </aside>
      <div className="min-w-0 flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-gray-500 print-hidden">
          {parent ? (
            <Link href={`${base}/read/${parent.id}`} className="hover:text-gray-900">
              ↑ {parent.title || "(untitled)"}
            </Link>
          ) : (
            <span>Top level</span>
          )}
          <span className="ml-auto" />
          {prev && (
            <Link href={`${base}/read/${prev.id}`} className="btn">
              ← {prev.title || "(untitled)"}
            </Link>
          )}
          {next && (
            <Link href={`${base}/read/${next.id}`} className="btn">
              {next.title || "(untitled)"} →
            </Link>
          )}
          <Link href={`${base}?node=${node.id}`} className="btn">
            Edit
          </Link>
        </div>
        <NodeDocument nodes={bundle.nodes} images={bundle.images} sources={bundle.sources} numbering={bundle.outline.numbering} rootId={node.id} terms={termsFromNodes(bundle.nodes)} large />
      </div>
    </div>
  );
}
