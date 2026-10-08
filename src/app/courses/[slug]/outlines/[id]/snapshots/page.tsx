import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourseBySlug, getOutline } from "@/lib/courses";
import { getSnapshotTree, listSnapshots } from "@/lib/snapshots";
import { diffTrees, treeRows, type DiffEntry } from "@/lib/snapdiff";
import { numberingLabel } from "@/lib/numbering";
import { restoreSnapshotAction, takeSnapshotAction } from "@/app/export-actions";

const ROW_CLASS: Record<DiffEntry["status"], string> = {
  added: "bg-green-50 text-green-900",
  removed: "bg-red-50 text-red-900 line-through",
  changed: "bg-amber-50 text-amber-900",
  moved: "bg-blue-50 text-blue-900",
  same: "",
};

export default async function SnapshotsPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug, id } = await params;
  const q = await searchParams;
  const db = getDb();
  const course = getCourseBySlug(db, slug);
  const outline = getOutline(db, id);
  if (!course || !outline || outline.courseId !== course.id) notFound();
  const snapshots = listSnapshots(db, id).reverse();
  const aId = typeof q.a === "string" ? q.a : snapshots[1]?.id;
  const bId = typeof q.b === "string" ? q.b : snapshots[0]?.id;
  const a = aId ? getSnapshotTree(db, aId) : null;
  const b = bId ? getSnapshotTree(db, bId) : null;
  const diff = a && b ? diffTrees(a.tree, b.tree) : null;
  const base = `/courses/${slug}/outlines/${id}/snapshots`;
  const fmt = (iso: string) => new Date(iso).toLocaleString();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Snapshots · {outline.name}</h1>
        <Link href={`/courses/${slug}/outlines/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
          Editor
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-600">A snapshot is the whole outline at a moment. One is taken automatically each day the outline changes; take one by hand before big edits. Restoring makes a new outline, never overwriting this one.</p>

      <form action={takeSnapshotAction} className="mt-4 flex flex-wrap items-end gap-2">
        <input type="hidden" name="outlineId" value={id} />
        <div>
          <label className="label" htmlFor="label">
            Label
          </label>
          <input id="label" name="label" className="input w-64" placeholder="before reorganising estates" />
        </div>
        <button type="submit" className="btn-primary">
          Take snapshot now
        </button>
      </form>

      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="py-1 pr-3">When</th>
            <th className="py-1 pr-3">Label</th>
            <th className="py-1 pr-3">Words</th>
            <th className="py-1 pr-3">Compare</th>
            <th className="py-1">Restore</th>
          </tr>
        </thead>
        <tbody>
          {snapshots.map((s) => (
            <tr key={s.id} className={`border-t border-gray-100 ${s.id === aId || s.id === bId ? "bg-gray-50" : ""}`}>
              <td className="py-2 pr-3">{fmt(s.createdAt)}</td>
              <td className="py-2 pr-3">{s.automatic ? <span className="text-gray-400">daily</span> : s.label || <span className="text-gray-400">manual</span>}</td>
              <td className="py-2 pr-3">{s.wordCount}</td>
              <td className="py-2 pr-3">
                <Link href={`${base}?a=${s.id}&b=${bId ?? ""}`} className={`btn py-0 text-xs ${s.id === aId ? "border-gray-900" : ""}`}>
                  A
                </Link>{" "}
                <Link href={`${base}?a=${aId ?? ""}&b=${s.id}`} className={`btn py-0 text-xs ${s.id === bId ? "border-gray-900" : ""}`}>
                  B
                </Link>
              </td>
              <td className="py-2">
                <form action={restoreSnapshotAction} className="flex items-center gap-1">
                  <input type="hidden" name="snapshotId" value={s.id} />
                  <input name="name" className="input w-40 py-0 text-xs" placeholder={`${outline.name} (restored)`} />
                  <button type="submit" className="btn py-0 text-xs">
                    Restore as new outline
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {snapshots.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-gray-500">
                No snapshots yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {diff && a && b && (
        <section className="mt-8">
          <h2 className="text-base font-medium">
            A ({fmt(a.snapshot.createdAt)}) → B ({fmt(b.snapshot.createdAt)})
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            <span className="rounded bg-green-50 px-1.5 text-green-900">{diff.added} added</span> <span className="rounded bg-red-50 px-1.5 text-red-900">{diff.removed} removed</span>{" "}
            <span className="rounded bg-amber-50 px-1.5 text-amber-900">{diff.changed} changed</span> <span className="rounded bg-blue-50 px-1.5 text-blue-900">{diff.moved} moved</span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
            {[a, b].map((side, si) => (
              <div key={si} className="rounded border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-500">{si === 0 ? "A" : "B"}</div>
                <div className="max-h-[60vh] overflow-auto p-2">
                  {treeRows(side.tree).map((r) => {
                    const e = diff.entries[r.node.id];
                    const status = si === 0 ? (e?.status === "added" ? "same" : e?.status) : e?.status === "removed" ? "same" : e?.status;
                    return (
                      <div key={r.node.id} className={`truncate rounded px-1 py-0.5 ${ROW_CLASS[status ?? "same"]}`} style={{ paddingLeft: 4 + r.depth * 14 }} title={e?.changedFields.join(", ")}>
                        <span className="font-mono text-xs text-gray-500">{numberingLabel(outline.numbering, r.path)}</span> {r.node.title || "(untitled)"}
                        {e && e.status === "changed" && <span className="ml-1 text-xs text-amber-700">({e.changedFields.join(", ")})</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {diff.changed > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-gray-700">Changed nodes in detail</summary>
              <div className="mt-2 space-y-3">
                {Object.values(diff.entries)
                  .filter((e) => e.status === "changed" && e.before && e.after)
                  .map((e) => (
                    <div key={e.id} className="rounded border border-amber-200 p-2">
                      <div className="font-medium">{e.after!.title || e.before!.title || "(untitled)"}</div>
                      {e.changedFields.map((f) => {
                        const pick = (n: NonNullable<typeof e.before>) => (f === "title" ? n.title : f === "notes" ? n.body : f === "type" ? n.type : f === "status" ? n.status : f === "tags" ? n.tags.join(", ") : JSON.stringify(n.fields[f] ?? ""));
                        return (
                          <div key={f} className="mt-1 grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded bg-red-50 p-1 whitespace-pre-wrap">
                              <span className="font-medium">{f} (A): </span>
                              {pick(e.before!)}
                            </div>
                            <div className="rounded bg-green-50 p-1 whitespace-pre-wrap">
                              <span className="font-medium">{f} (B): </span>
                              {pick(e.after!)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
              </div>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
