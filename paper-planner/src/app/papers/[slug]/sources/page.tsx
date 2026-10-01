import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaperBySlug } from "@/lib/queries/papers";
import { listSources } from "@/lib/queries/sources";
import { listTags } from "@/lib/queries/tags";
import { createSourceAction } from "@/app/actions";
import { ReadBadge, TagList } from "@/components/badges";
import { SourceForm } from "@/components/SourceForm";

type Sort = "type" | "year" | "read" | "tag" | "created";

export default async function SourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; dir?: string; tag?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();
  const sort = (["type", "year", "read", "tag", "created"].includes(sp.sort ?? "") ? sp.sort : "created") as Sort;
  const dir = sp.dir === "desc" ? "desc" : "asc";
  const tagFilter = sp.tag ?? "";
  let rows = listSources(paper.id);
  if (tagFilter) rows = rows.filter((r) => r.tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase()));
  const readRank: Record<string, number> = { unread: 0, skimmed: 1, read: 2 };
  rows.sort((a, b) => {
    let c = 0;
    if (sort === "type") c = a.type.localeCompare(b.type);
    else if (sort === "year") c = (a.year ?? 0) - (b.year ?? 0);
    else if (sort === "read") c = readRank[a.read_status] - readRank[b.read_status];
    else if (sort === "tag") c = (a.tags[0] ?? "").localeCompare(b.tags[0] ?? "");
    else c = a.created_at.localeCompare(b.created_at) || a.id - b.id;
    if (c === 0) c = a.short_cite.localeCompare(b.short_cite);
    return dir === "asc" ? c : -c;
  });
  const tags = listTags(paper.id);
  const base = `/papers/${paper.slug}/sources`;
  const sortLink = (key: Sort, label: string) => {
    const nextDir = sort === key && dir === "asc" ? "desc" : "asc";
    const q = new URLSearchParams({ sort: key, dir: nextDir });
    if (tagFilter) q.set("tag", tagFilter);
    return (
      <Link href={`${base}?${q}`} className="no-underline text-gray-900 hover:underline">
        {label}
        {sort === key ? (dir === "asc" ? " ▲" : " ▼") : ""}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2>Sources ({rows.length})</h2>
        <form method="get" className="flex items-center gap-1 text-sm">
          <input type="hidden" name="sort" value={sort} />
          <input type="hidden" name="dir" value={dir} />
          <label>Filter by tag</label>
          <select name="tag" defaultValue={tagFilter}>
            <option value="">(all)</option>
            {tags.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="submit">Apply</button>
          {tagFilter && <Link href={base}>clear</Link>}
        </form>
      </div>

      <table>
        <thead>
          <tr>
            <th>Short cite</th>
            <th>{sortLink("type", "Type")}</th>
            <th>{sortLink("year", "Year")}</th>
            <th>{sortLink("read", "Read")}</th>
            <th>{sortLink("tag", "Tags")}</th>
            <th className="text-right">Extracts</th>
            <th className="text-right">Links</th>
            <th>PDF</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="text-gray-500">
                No sources yet.
              </td>
            </tr>
          )}
          {rows.map((s) => (
            <tr key={s.id}>
              <td>
                <Link href={`${base}/${s.id}`} className="font-medium">
                  {s.short_cite}
                </Link>
                <div className="text-xs text-gray-600">{s.citation}</div>
              </td>
              <td>{s.type}</td>
              <td>{s.year ?? ""}</td>
              <td>
                <ReadBadge status={s.read_status} />
              </td>
              <td>
                <TagList tags={s.tags} />
              </td>
              <td className="text-right">{s.extract_count}</td>
              <td className="text-right">{s.link_count}</td>
              <td>{s.pdf_path ? "yes" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="card max-w-3xl">
        <h2 className="mb-2">Add source</h2>
        <SourceForm slug={paper.slug} action={createSourceAction} />
      </section>
    </div>
  );
}
