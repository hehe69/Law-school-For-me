import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourseBySlug, listOutlines } from "@/lib/courses";
import { loadImages, loadNodes } from "@/lib/nodes";
import { countStatuses, estimatePages, percent, sectionProgress, STALE_AFTER_DAYS } from "@/lib/progress";
import { listSnapshots, wordCountOf } from "@/lib/snapshots";
import { numberingLabel } from "@/lib/numbering";
import type { NodeMap } from "@/lib/types";
import { StatusBar, WordTimeline } from "@/components/views/ProgressCharts";

export default async function ProgressPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ outline?: string | string[] }> }) {
  const { slug } = await params;
  const { outline: outlineParam } = await searchParams;
  const db = getDb();
  const course = getCourseBySlug(db, slug);
  if (!course) notFound();
  const outlines = listOutlines(db, course.id).filter((o) => o.kind !== "scratch");
  const outline = outlines.find((o) => o.id === outlineParam) ?? outlines.find((o) => o.isDefault && o.kind === "full") ?? outlines[0];
  if (!outline) notFound();
  const nodes = loadNodes(db, outline.id);
  const images = loadImages(db, outline.id);
  const map: NodeMap = {};
  for (const n of nodes) map[n.id] = n;
  const totals = countStatuses(nodes);
  const sections = sectionProgress(map);
  const words = wordCountOf(nodes);
  const pages = estimatePages(nodes, images);
  const snapshots = listSnapshots(db, outline.id);
  const points = [...snapshots.map((s) => ({ date: s.createdAt, words: s.wordCount, label: s.automatic ? "daily" : s.label || "snapshot" })), { date: new Date().toISOString(), words, label: "now" }];
  const stale = sections.filter((s) => s.staleDays >= STALE_AFTER_DAYS);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Progress · {course.title}</h1>
        <nav className="flex flex-wrap gap-2 text-sm">
          {outlines.map((o) => (
            <Link key={o.id} href={`/courses/${slug}/progress?outline=${o.id}`} className={`btn ${o.id === outline.id ? "border-gray-900" : ""}`}>
              {o.name}
            </Link>
          ))}
          <Link href={`/courses/${slug}`} className="btn">
            Course page
          </Link>
        </nav>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-gray-500">Nodes</div>
          <div className="mt-1 text-2xl font-semibold">{totals.total}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-gray-500">Final</div>
          <div className="mt-1 text-2xl font-semibold">{percent(totals.final, totals.total)}%</div>
          <div className="text-xs text-gray-500">{totals.final} nodes</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-gray-500">Words</div>
          <div className="mt-1 text-2xl font-semibold">{words}</div>
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wide text-gray-500">Printed pages (est.)</div>
          <div className={`mt-1 text-2xl font-semibold ${course.pageLimit && pages > course.pageLimit ? "text-red-700" : ""}`}>
            ~{pages}
            {course.pageLimit ? <span className="text-base font-normal text-gray-500"> / {course.pageLimit}</span> : null}
          </div>
          {course.pageLimit && <div className="text-xs text-gray-500">{pages > course.pageLimit ? "over the limit" : `${Math.round((pages / course.pageLimit) * 100)}% of the limit`}</div>}
        </div>
      </div>

      <section className="card mt-6">
        <h2 className="text-base font-medium">By status</h2>
        <div className="mt-2">
          <StatusBar counts={totals} />
        </div>
        <h3 className="mt-5 text-sm font-medium">Per top-level section</h3>
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-1 pr-3">Section</th>
              <th className="py-1 pr-3">Nodes</th>
              <th className="py-1 pr-3">Final</th>
              <th className="py-1 pr-3 w-[30%]">Status</th>
              <th className="py-1 pr-3">Words</th>
              <th className="py-1">Last edit</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s, i) => (
              <tr key={s.node.id} className="border-t border-gray-100 align-top">
                <td className="py-2 pr-3">
                  <Link href={`/courses/${slug}/outlines/${outline.id}?node=${s.node.id}`} className="hover:underline">
                    <span className="font-mono text-gray-500">{numberingLabel(outline.numbering, [i])}</span> {s.node.title || "(untitled)"}
                  </Link>
                </td>
                <td className="py-2 pr-3">{s.counts.total}</td>
                <td className="py-2 pr-3">
                  {percent(s.counts.final, s.counts.total)}% <span className="text-xs text-gray-400">({s.counts.final})</span>
                </td>
                <td className="py-2 pr-3">
                  <StatusBar counts={s.counts} compact />
                  <div className="mt-0.5 text-[11px] text-gray-500">
                    {s.counts.empty} empty · {s.counts.skeleton} skeleton · {s.counts.drafted} drafted · {s.counts.final} final
                  </div>
                </td>
                <td className="py-2 pr-3">{s.words}</td>
                <td className={`py-2 ${s.staleDays >= STALE_AFTER_DAYS ? "text-amber-700" : "text-gray-600"}`}>{s.staleDays === 0 ? "today" : `${s.staleDays} day${s.staleDays === 1 ? "" : "s"} ago`}</td>
              </tr>
            ))}
            {sections.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-sm text-gray-500">
                  The outline is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="card mt-6">
        <h2 className="text-base font-medium">Word count over snapshots</h2>
        <div className="mt-3">
          <WordTimeline points={points} />
        </div>
      </section>

      <section className="card mt-6">
        <h2 className="text-base font-medium">
          Stale sections <span className="text-sm font-normal text-gray-500">(no edit in {STALE_AFTER_DAYS}+ days)</span>
        </h2>
        {stale.length === 0 ? (
          <p className="mt-2 text-sm text-green-700">Every section was edited in the last {STALE_AFTER_DAYS} days.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {stale.map((s) => (
              <li key={s.node.id}>
                <Link href={`/courses/${slug}/outlines/${outline.id}?node=${s.node.id}`} className="hover:underline">
                  {s.node.title || "(untitled)"}
                </Link>
                <span className="ml-2 text-xs text-amber-700">{s.staleDays} days</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
