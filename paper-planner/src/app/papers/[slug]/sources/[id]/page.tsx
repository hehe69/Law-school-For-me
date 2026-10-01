import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaperBySlug, listPapers } from "@/lib/queries/papers";
import { getSource, linksForSource } from "@/lib/queries/sources";
import { extractsForSource } from "@/lib/queries/extracts";
import { outlineTree } from "@/lib/queries/outline";
import { EXTRACT_KINDS, LINK_PURPOSES, READ_STATUSES } from "@/lib/types";
import {
  copySourceAction,
  deleteExtractAction,
  deleteLinkAction,
  deleteSourceAction,
  linkSourceAction,
  removePdfAction,
  setReadStatusAction,
  unlinkExtractAction,
  updateExtractAction,
  updateLinkAction,
  updateSourceAction,
  uploadPdfAction,
} from "@/app/actions";
import { ExtractForm } from "@/components/ExtractForm";
import { SourceForm } from "@/components/SourceForm";
import { ConfirmButton } from "@/components/ConfirmButton";
import { AutoSubmitSelect } from "@/components/AutoSubmitSelect";
import { KindBadge, ReadBadge, TagList } from "@/components/badges";
import { fmtDate } from "@/lib/format";

export default async function SourcePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();
  const source = getSource(parseInt(id, 10));
  if (!source || source.paper_id !== paper.id) notFound();
  const extracts = extractsForSource(source.id);
  const links = linksForSource(source.id);
  const tree = outlineTree(paper.id);
  const others = listPapers().filter((p) => p.id !== paper.id);
  const base = `/papers/${paper.slug}`;
  const linkedIds = new Set(links.map((l) => l.section_id));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2>{source.short_cite}</h2>
            <span className="badge border-gray-300">{source.type}</span>
            <ReadBadge status={source.read_status} />
            <TagList tags={source.tags} />
          </div>
          <p className="text-sm text-gray-700">{source.citation}</p>
          {source.url && (
            <p className="text-xs">
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.url}
              </a>
            </p>
          )}
          {source.relevance && <p className="text-sm text-gray-600 mt-1">{source.relevance}</p>}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <form action={setReadStatusAction} className="flex items-center gap-1" key={source.read_status}>
            <input type="hidden" name="id" value={source.id} />
            <label>Read status</label>
            <AutoSubmitSelect name="read_status" defaultValue={source.read_status}>
              {READ_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </AutoSubmitSelect>
          </form>
          <Link href={`${base}/sources`} className="text-xs">
            ← all sources
          </Link>
        </div>
      </div>

      {/* Split view: PDF left, capture right */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-2 min-h-[70vh] flex flex-col">
          {source.pdf_path ? (
            <>
              <iframe src={`/api/sources/${source.id}/pdf`} title="PDF" className="flex-1 w-full min-h-[65vh] border border-gray-200 rounded" />
              <div className="flex items-center justify-between text-xs mt-1 text-gray-600">
                <a href={`/api/sources/${source.id}/pdf`} target="_blank" rel="noreferrer">
                  open PDF in a new tab
                </a>
                <form action={removePdfAction}>
                  <input type="hidden" name="id" value={source.id} />
                  <ConfirmButton message="Remove the PDF file from this source?" className="text-xs px-1 py-0 text-gray-500">
                    remove PDF
                  </ConfirmButton>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col gap-3 text-sm">
              <p className="text-gray-600">No PDF uploaded.</p>
              <p className="font-medium">{source.citation}</p>
              {source.url ? (
                <p>
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.url}
                  </a>
                </p>
              ) : (
                <p className="text-gray-500">No URL.</p>
              )}
              <form action={uploadPdfAction} className="mt-auto flex items-center gap-2">
                <input type="hidden" name="slug" value={paper.slug} />
                <input type="hidden" name="id" value={source.id} />
                <input type="file" name="pdf" accept="application/pdf,.pdf" required />
                <button type="submit">Upload PDF</button>
              </form>
            </div>
          )}
        </div>
        <div className="card">
          <h3 className="mb-2">Capture extract</h3>
          <ExtractForm slug={paper.slug} sourceId={source.id} sections={tree.map((s) => ({ id: s.id, heading: s.heading, claim: s.claim, path: s.path }))} />
        </div>
      </div>

      {/* Extracts */}
      <section className="card">
        <h3 className="mb-2">Extracts ({extracts.length})</h3>
        {extracts.length === 0 && <p className="text-sm text-gray-500">No extracts yet.</p>}
        <ul className="space-y-3 text-sm">
          {extracts.map((e) => (
            <li key={e.id} id={`extract-${e.id}`} className="border-b border-gray-200 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{e.pin_cite}</span>
                <KindBadge kind={e.kind} />
                <TagList tags={e.tags} />
                <span className="text-xs text-gray-500">{fmtDate(e.created_at)}</span>
              </div>
              <blockquote className="italic text-gray-800 font-serif my-1">“{e.text}”</blockquote>
              {e.note && <p className="text-gray-600">{e.note}</p>}
              <div className="text-xs text-gray-600 mt-1 flex gap-2 flex-wrap items-center">
                Sections:
                {e.sections.length === 0 && <span className="text-red-700">unlinked</span>}
                {e.sections.map((s) => (
                  <span key={s.id} className="inline-flex items-center gap-1">
                    <Link href={`${base}/outline#section-${s.id}`}>{s.heading}</Link>
                    <form action={unlinkExtractAction} className="inline">
                      <input type="hidden" name="extract_id" value={e.id} />
                      <input type="hidden" name="section_id" value={s.id} />
                      <button type="submit" className="px-1 py-0 text-xs text-gray-500" title="Unlink">
                        ×
                      </button>
                    </form>
                  </span>
                ))}
                <Link href={`${base}/quotes?extract=${e.id}`}>in quote bank</Link>
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-gray-600">Edit</summary>
                <form action={updateExtractAction} className="grid gap-1 mt-1" key={`${e.pin_cite}|${e.kind}|${e.tags.join(",")}|${e.text}|${e.note}`}>
                  <input type="hidden" name="id" value={e.id} />
                  <div className="grid grid-cols-3 gap-1">
                    <input name="pin_cite" defaultValue={e.pin_cite} required placeholder="pin cite" />
                    <select name="kind" defaultValue={e.kind}>
                      {EXTRACT_KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                    <input name="tags" defaultValue={e.tags.join(", ")} placeholder="tags" />
                  </div>
                  <textarea name="text" defaultValue={e.text} rows={3} />
                  <input name="note" defaultValue={e.note} placeholder="note" />
                  <div className="flex gap-2">
                    <button type="submit">Save</button>
                  </div>
                </form>
                <form action={deleteExtractAction} className="mt-1">
                  <input type="hidden" name="id" value={e.id} />
                  <ConfirmButton message="Delete this extract? Its section links are removed; citation log rows are kept.">Delete extract</ConfirmButton>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {/* Section links */}
      <section className="card">
        <h3 className="mb-2">Linked to sections ({links.length})</h3>
        {links.length === 0 && <p className="text-sm text-gray-500">Not linked to any section yet.</p>}
        <ul className="space-y-2 text-sm">
          {links.map((l) => (
            <li key={l.id} className="flex gap-2 items-start">
              <div className="w-64 shrink-0">
                <Link href={`${base}/outline#section-${l.section_id}`}>{l.heading}</Link>
                {l.claim && <div className="text-xs text-gray-600">{l.claim}</div>}
              </div>
              <form action={updateLinkAction} className="flex gap-1 flex-1 items-center" key={`${l.purpose}|${l.note}`}>
                <input type="hidden" name="id" value={l.id} />
                <select name="purpose" defaultValue={l.purpose} className="text-xs">
                  {LINK_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input name="note" defaultValue={l.note} required className="flex-1 text-xs" />
                <button type="submit" className="text-xs">
                  Save
                </button>
              </form>
              <form action={deleteLinkAction}>
                <input type="hidden" name="id" value={l.id} />
                <ConfirmButton message="Remove this link? (Its citation log row stays.)" className="text-xs px-1 py-0 text-gray-500">
                  unlink
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
        <form action={linkSourceAction} className="mt-3 grid gap-1 text-sm">
          <input type="hidden" name="source_id" value={source.id} />
          <div className="font-medium text-xs uppercase text-gray-500">Link to a section</div>
          <select name="section_id" required>
            <option value="">Pick a section…</option>
            {tree
              .filter((s) => !linkedIds.has(s.id))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.path} {s.heading}
                  {s.claim ? ` — ${s.claim}` : ""}
                </option>
              ))}
          </select>
          <div className="flex gap-1">
            <select name="purpose">
              {LINK_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <input name="note" placeholder="What this source proves for this section (required)" required className="flex-1" />
            <button type="submit">Link</button>
          </div>
        </form>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <details className="card">
          <summary className="cursor-pointer text-sm font-medium">Edit source</summary>
          <div className="mt-2">
            <SourceForm key={JSON.stringify(source)} slug={paper.slug} source={source} action={updateSourceAction} />
          </div>
          <form action={deleteSourceAction} className="mt-4">
            <input type="hidden" name="slug" value={paper.slug} />
            <input type="hidden" name="id" value={source.id} />
            <ConfirmButton message={`Delete "${source.short_cite}"? This deletes its ${extracts.length} extract(s), its section links, its citation log rows, and its PDF.`}>
              Delete source
            </ConfirmButton>
          </form>
        </details>
        <section className="card text-sm">
          <h3 className="mb-1">Copy to another paper</h3>
          <p className="text-xs text-gray-600 mb-2">Copies the source row, its tags, and its PDF. Extracts and links are not copied.</p>
          {others.length === 0 ? (
            <p className="text-gray-500">No other papers.</p>
          ) : (
            <form action={copySourceAction} className="flex gap-1">
              <input type="hidden" name="id" value={source.id} />
              <select name="target_paper_id" required className="flex-1">
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <button type="submit">Copy</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
