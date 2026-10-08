import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { childrenOf } from "@/lib/tree";
import { numberingLabel } from "@/lib/numbering";
import { EXPORT_DIR } from "@/lib/paths";
import type { NodeMap } from "@/lib/types";
import { exportAction } from "@/app/export-actions";

export default async function ExportPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug, id } = await params;
  const q = await searchParams;
  const bundle = loadBundle(getDb(), id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  const map: NodeMap = {};
  for (const n of bundle.nodes) map[n.id] = n;
  const done = typeof q.done === "string" ? q.done : null;
  const error = typeof q.error === "string" ? q.error : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Export · {bundle.outline.name}</h1>
        <Link href={`/courses/${slug}/outlines/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
          Editor
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Files are written to <span className="font-mono text-xs">{EXPORT_DIR}</span> as <span className="font-mono text-xs">&lt;course&gt;-&lt;outline&gt;-&lt;date&gt;.docx / .pdf / .md</span>. Word
        files use real heading styles, so Word&apos;s navigation pane and its table of contents work (Word asks to update fields on opening). PDFs carry a table of contents with page numbers. Markdown
        keeps your notes as written and copies the images next to the file.
      </p>
      {done && (
        <p className="mt-4 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Written: <span className="font-mono text-xs">{done}</span> ({Math.round(Number(q.bytes ?? 0) / 1024)} KB)
        </p>
      )}
      {error && <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <form action={exportAction} className="card mt-6 grid gap-4 text-sm">
        <input type="hidden" name="outlineId" value={id} />
        <fieldset>
          <legend className="label">Format</legend>
          <div className="flex gap-4">
            {(["docx", "pdf", "md"] as const).map((f) => (
              <label key={f} className="flex items-center gap-1">
                <input type="radio" name="format" value={f} defaultChecked={f === "docx"} /> {f === "docx" ? "Word (.docx)" : f === "pdf" ? "PDF" : "Markdown (.md)"}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="sectionId">
            What to export
          </label>
          <select id="sectionId" name="sectionId" className="input w-auto" defaultValue="">
            <option value="">Whole outline</option>
            {childrenOf(map, null).map((n, i) => (
              <option key={n.id} value={n.id}>
                Section {numberingLabel(bundle.outline.numbering, [i])} {n.title || "(untitled)"}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="label">Sources</legend>
          <div className="flex gap-4">
            {(["inline", "footnotes", "none"] as const).map((m) => (
              <label key={m} className="flex items-center gap-1">
                <input type="radio" name="sources" value={m} defaultChecked={m === "inline"} /> {m === "inline" ? "Inline under each node" : m === "footnotes" ? "Footnotes" : "Leave out"}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="answers" /> Include hypo answers
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary">
            Export
          </button>
          <Link href={`/courses/${slug}/outlines/${id}/print`} className="btn">
            Print view instead
          </Link>
        </div>
      </form>
    </div>
  );
}
