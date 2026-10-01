import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaperBySlug } from "@/lib/queries/papers";
import { listExtracts, unlinkedExtracts } from "@/lib/queries/extracts";
import { outlineTree } from "@/lib/queries/outline";
import { listSources } from "@/lib/queries/sources";
import { listTags } from "@/lib/queries/tags";
import { EXTRACT_KINDS } from "@/lib/types";
import { linkExtractAction, unlinkExtractAction } from "@/app/actions";
import { KindBadge, TagList } from "@/components/badges";
import { Linker } from "@/components/Linker";

export default async function QuotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mode?: string; kind?: string; section?: string; source?: string; tag?: string; unlinked?: string; q?: string; extract?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();
  const tree = outlineTree(paper.id);
  const base = `/papers/${paper.slug}/quotes`;

  if (sp.mode === "linker") {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h2>Linker</h2>
          <Link href={base} className="text-sm">
            ← quote bank
          </Link>
        </div>
        <Linker
          slug={paper.slug}
          quotes={unlinkedExtracts(paper.id)}
          sections={tree.map((s) => ({ id: s.id, heading: s.heading, claim: s.claim, path: s.path, depth: s.depth, support: s.support }))}
        />
      </div>
    );
  }

  const filters = {
    kind: sp.kind || undefined,
    section: sp.section ? parseInt(sp.section, 10) : undefined,
    source: sp.source ? parseInt(sp.source, 10) : undefined,
    tag: sp.tag || undefined,
    unlinked: sp.unlinked === "1",
    q: sp.q || undefined,
  };
  const rows = listExtracts(paper.id, filters);
  const sources = listSources(paper.id);
  const tags = listTags(paper.id);
  const highlight = sp.extract ? parseInt(sp.extract, 10) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2>Quote bank ({rows.length})</h2>
        <Link href={`${base}?mode=linker`} className="btn no-underline text-gray-900">
          Linker mode
        </Link>
      </div>
      <form method="get" className="card grid md:grid-cols-6 gap-2 text-sm items-end">
        <label className="md:col-span-2">
          Search text and notes
          <input name="q" defaultValue={sp.q ?? ""} placeholder="full-text search" className="w-full" />
        </label>
        <label>
          Kind
          <select name="kind" defaultValue={sp.kind ?? ""} className="w-full">
            <option value="">(any)</option>
            {EXTRACT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label>
          Section
          <select name="section" defaultValue={sp.section ?? ""} className="w-full">
            <option value="">(any)</option>
            {tree.map((s) => (
              <option key={s.id} value={s.id}>
                {s.path} {s.heading}
              </option>
            ))}
          </select>
        </label>
        <label>
          Source
          <select name="source" defaultValue={sp.source ?? ""} className="w-full">
            <option value="">(any)</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.short_cite}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tag
          <select name="tag" defaultValue={sp.tag ?? ""} className="w-full">
            <option value="">(any)</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="unlinked" value="1" defaultChecked={sp.unlinked === "1"} />
          unlinked only
        </label>
        <div className="flex gap-2">
          <button type="submit" className="primary">
            Filter
          </button>
          <Link href={base} className="btn no-underline text-gray-900">
            Clear
          </Link>
        </div>
      </form>

      {rows.length === 0 && <p className="text-sm text-gray-500">No extracts match.</p>}
      <ul className="space-y-2">
        {rows.map((e) => (
          <li key={e.id} id={`extract-${e.id}`} className={`card text-sm ${highlight === e.id ? "ring-2 ring-yellow-400" : ""}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/papers/${paper.slug}/sources/${e.source_id}#extract-${e.id}`} className="font-medium">
                {e.short_cite}, {e.pin_cite}
              </Link>
              <KindBadge kind={e.kind} />
              <TagList tags={e.tags} />
            </div>
            <blockquote className="italic text-gray-800 font-serif my-1">“{e.text}”</blockquote>
            {e.note && <p className="text-gray-600">{e.note}</p>}
            <div className="text-xs text-gray-600 mt-1 flex gap-2 flex-wrap items-center">
              Sections:
              {e.sections.length === 0 && <span className="text-red-700">unlinked</span>}
              {e.sections.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1">
                  <Link href={`/papers/${paper.slug}/outline#section-${s.id}`}>{s.heading}</Link>
                  <form action={unlinkExtractAction} className="inline">
                    <input type="hidden" name="extract_id" value={e.id} />
                    <input type="hidden" name="section_id" value={s.id} />
                    <button type="submit" className="px-1 py-0 text-xs text-gray-500" title="Unlink">
                      ×
                    </button>
                  </form>
                </span>
              ))}
              <form action={linkExtractAction} className="inline-flex gap-1 items-center">
                <input type="hidden" name="extract_id" value={e.id} />
                <select name="section_id" required className="text-xs py-0">
                  <option value="">link to…</option>
                  {tree
                    .filter((s) => !e.sections.some((x) => x.id === s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.path} {s.heading}
                      </option>
                    ))}
                </select>
                <button type="submit" className="text-xs py-0">
                  Link
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
