import { notFound } from "next/navigation";
import { getPaperBySlug } from "@/lib/queries/papers";
import { exportPaperAction } from "@/app/actions";
import { EXPORTS_DIR } from "@/lib/paths";

export default async function ExportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const { slug } = await params;
  const { done } = await searchParams;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();
  return (
    <div className="space-y-4 max-w-2xl">
      <h2>Export</h2>
      {done && (
        <p className="card bg-green-50 border-green-300 text-sm">
          Written to <code>{done}</code>
        </p>
      )}
      <section className="card space-y-2 text-sm">
        <h3>Whole paper</h3>
        <p className="text-gray-600">
          Title, thesis, outline with headings and claims in tree order, each section&apos;s linked sources with notes and extracts with pin cites and
          notes, open questions, then the full source list. Your text verbatim; citations are not reformatted.
        </p>
        <div className="flex gap-2">
          <ExportButton slug={paper.slug} what="paper" format="docx" label="Export .docx" />
          <ExportButton slug={paper.slug} what="paper" format="md" label="Export .md" />
        </div>
      </section>
      <section className="card space-y-2 text-sm">
        <h3>Source list only</h3>
        <p className="text-gray-600">Full citations as you typed them, one per line.</p>
        <div className="flex gap-2">
          <ExportButton slug={paper.slug} what="sources" format="docx" label="Export .docx" />
          <ExportButton slug={paper.slug} what="sources" format="md" label="Export .md" />
        </div>
      </section>
      <p className="text-xs text-gray-600">
        Files go to <code>{EXPORTS_DIR}</code> as <code>{paper.slug}-&lt;date&gt;.docx</code> / <code>.md</code>.
      </p>
    </div>
  );
}

function ExportButton({ slug, what, format, label }: { slug: string; what: "paper" | "sources"; format: "docx" | "md"; label: string }) {
  return (
    <form action={exportPaperAction}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="what" value={what} />
      <input type="hidden" name="format" value={format} />
      <button type="submit">{label}</button>
    </form>
  );
}
