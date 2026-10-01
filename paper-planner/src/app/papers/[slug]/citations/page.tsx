import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaperBySlug } from "@/lib/queries/papers";
import { listCitationLog } from "@/lib/queries/citations";
import { outlineTree } from "@/lib/queries/outline";
import { listSources } from "@/lib/queries/sources";
import { addLogEntryAction, deleteLogEntryAction } from "@/app/actions";
import { LogNote, LogPin, LogUsedIn, LogVerified } from "@/components/LogRowEditor";
import { ConfirmButton } from "@/components/ConfirmButton";
import { fmtDate, truncate } from "@/lib/format";

export default async function CitationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; unverified?: string; missing?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();
  const sort = (["outline", "source", "date"].includes(sp.sort ?? "") ? sp.sort : "outline") as "outline" | "source" | "date";
  const rows = listCitationLog(paper.id, { sort, unverified: sp.unverified === "1", missingPin: sp.missing === "1" });
  const tree = outlineTree(paper.id);
  const sources = listSources(paper.id);
  const base = `/papers/${paper.slug}`;
  const q = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string> = { sort, unverified: sp.unverified ?? "", missing: sp.missing ?? "", ...over };
    for (const [k, v] of Object.entries(cur)) if (v) p.set(k, v);
    return `${base}/citations?${p}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap text-sm">
        <h2>Citation log ({rows.length})</h2>
        <span className="text-gray-600">Sort:</span>
        {(["outline", "source", "date"] as const).map((s) => (
          <Link key={s} href={q({ sort: s })} className={sort === s ? "font-semibold" : ""}>
            {s === "outline" ? "outline order" : s}
          </Link>
        ))}
        <span className="text-gray-600 ml-2">Filter:</span>
        <Link href={q({ unverified: sp.unverified === "1" ? "" : "1" })} className={sp.unverified === "1" ? "font-semibold" : ""}>
          unverified only
        </Link>
        <Link href={q({ missing: sp.missing === "1" ? "" : "1" })} className={sp.missing === "1" ? "font-semibold" : ""}>
          missing pin cite only
        </Link>
      </div>

      <table>
        <thead>
          <tr>
            <th>Source</th>
            <th>Pin cite</th>
            <th>Section</th>
            <th>Used in</th>
            <th className="text-center">Verified</th>
            <th>Note</th>
            <th>Date</th>
            <th>From</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="text-gray-500">
                No entries.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} id={`log-${r.id}`}>
              <td>
                <Link href={`${base}/sources/${r.source_id}`}>{r.short_cite}</Link>
              </td>
              <td className={!r.pin_cite?.trim() ? "bg-yellow-50" : ""}>
                <LogPin id={r.id} value={r.pin_cite} />
              </td>
              <td>
                {r.section_id ? <Link href={`${base}/outline#section-${r.section_id}`}>{r.section_heading}</Link> : <span className="text-gray-400">—</span>}
              </td>
              <td>
                <LogUsedIn id={r.id} value={r.used_in} />
              </td>
              <td className={`text-center ${!r.verified ? "bg-yellow-50" : ""}`}>
                <LogVerified id={r.id} value={!!r.verified} />
              </td>
              <td className="min-w-40">
                <LogNote id={r.id} value={r.note} />
              </td>
              <td className="whitespace-nowrap text-xs text-gray-600">{fmtDate(r.created_at)}</td>
              <td className="text-xs text-gray-600">
                {r.origin === "manual" && "manual"}
                {r.origin === "source_link" && "source link"}
                {r.origin === "extract_link" &&
                  (r.extract_id ? (
                    <Link href={`${base}/quotes?extract=${r.extract_id}`} title={r.extract_text ?? ""}>
                      extract {r.extract_pin}
                    </Link>
                  ) : (
                    "extract (deleted)"
                  ))}
                {r.extract_text && <div className="text-gray-500 italic">{truncate(r.extract_text, 60)}</div>}
              </td>
              <td>
                <form action={deleteLogEntryAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <ConfirmButton message="Delete this log entry?" className="text-xs px-1 py-0 text-gray-500">
                    ×
                  </ConfirmButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="card max-w-3xl">
        <h3 className="mb-2">Add entry by hand</h3>
        <form action={addLogEntryAction} className="grid md:grid-cols-3 gap-2 text-sm">
          <input type="hidden" name="slug" value={paper.slug} />
          <label>
            Source
            <select name="source_id" required className="w-full">
              <option value="">Pick…</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.short_cite}
                </option>
              ))}
            </select>
          </label>
          <label>
            Pin cite
            <input name="pin_cite" className="w-full" />
          </label>
          <label>
            Section
            <select name="section_id" className="w-full">
              <option value="">(none)</option>
              {tree.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.path} {s.heading}
                </option>
              ))}
            </select>
          </label>
          <label>
            Used in
            <input name="used_in" placeholder="fn 23 / first draft" className="w-full" />
          </label>
          <label className="md:col-span-2">
            Note
            <input name="note" className="w-full" />
          </label>
          <div>
            <button type="submit" className="primary">
              Add
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
