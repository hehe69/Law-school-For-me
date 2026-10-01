import { notFound } from "next/navigation";
import { getPaperBySlug } from "@/lib/queries/papers";
import { counterargumentSections, outlineTree } from "@/lib/queries/outline";
import { linksForPaper } from "@/lib/queries/citations";
import { listExtracts } from "@/lib/queries/extracts";
import { listSources } from "@/lib/queries/sources";
import { SECTION_ROLES } from "@/lib/types";
import { createSectionAction } from "@/app/actions";
import { OutlineTree, type SectionDetails } from "@/components/OutlineTree";

export default async function OutlinePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ focus?: string }>;
}) {
  const { slug } = await params;
  const { focus } = await searchParams;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();
  const nodes = outlineTree(paper.id);
  const details: Record<number, SectionDetails> = {};
  for (const n of nodes) details[n.id] = { links: [], extracts: [] };
  for (const l of linksForPaper(paper.id)) details[l.section_id]?.links.push(l);
  for (const e of listExtracts(paper.id)) for (const s of e.sections) details[s.id]?.extracts.push(e);
  const sources = listSources(paper.id).map((s) => ({ id: s.id, short_cite: s.short_cite, citation: s.citation }));
  const counters = counterargumentSections(paper.id).map((c) => ({ id: c.id, heading: c.heading }));
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h2>Outline</h2>
        <p className="text-xs text-gray-600">
          Drag the handle to reorder; drop onto a section to nest. Click a heading or claim to edit it.
        </p>
      </div>
      <OutlineTree slug={paper.slug} nodes={nodes} details={details} sources={sources} counters={counters} focusId={focus ? parseInt(focus, 10) : undefined} />
      <form action={createSectionAction} className="card flex gap-2 items-end flex-wrap">
        <input type="hidden" name="slug" value={paper.slug} />
        <label className="flex-1 min-w-48">
          New top-level section
          <input name="heading" placeholder="Heading" required className="w-full" />
        </label>
        <label className="flex-1 min-w-48">
          Claim
          <input name="claim" placeholder="one-line claim" className="w-full" />
        </label>
        <label>
          Role
          <select name="role" className="block">
            {SECTION_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="primary">
          Add section
        </button>
      </form>
    </div>
  );
}
