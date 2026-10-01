import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPaperBySlug,
  listMilestones,
  listOpenQuestions,
  listThesisVersions,
} from "@/lib/queries/papers";
import { outlineTree } from "@/lib/queries/outline";
import { unlinkedSources } from "@/lib/queries/sources";
import { unlinkedExtracts } from "@/lib/queries/extracts";
import { problemLogEntries } from "@/lib/queries/citations";
import { latestDraft } from "@/lib/queries/drafts";
import { PAPER_STATUSES } from "@/lib/types";
import { daysUntil, fmtDateTime, truncate } from "@/lib/format";
import {
  addMilestoneAction,
  addQuestionAction,
  deleteMilestoneAction,
  deletePaperAction,
  deleteQuestionAction,
  reviseThesisAction,
  setQuestionResolvedAction,
  updateMilestoneAction,
  updatePaperAction,
} from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { RoleBadge } from "@/components/badges";

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();
  const base = `/papers/${paper.slug}`;
  const tree = outlineTree(paper.id);
  const unsupported = tree.filter((s) => s.support === 0);
  const srcs = unlinkedSources(paper.id);
  const exts = unlinkedExtracts(paper.id);
  const logProblems = problemLogEntries(paper.id);
  const milestones = listMilestones(paper.id);
  const questions = listOpenQuestions(paper.id);
  const versions = listThesisVersions(paper.id);
  const draft = latestDraft(paper.id);

  return (
    <div className="space-y-6">
      {/* Four attention lists, in the order the spec gives. */}
      <div className="grid md:grid-cols-2 gap-3">
        <AttentionList count={srcs.length} title={`Sources linked to no section (${srcs.length})`} empty="Every source is linked to a section.">
          {srcs.map((s) => (
            <li key={s.id}>
              <Link href={`${base}/sources/${s.id}`}>{s.short_cite}</Link>
              <span className="text-gray-500 text-xs ml-2">{s.type}</span>
            </li>
          ))}
        </AttentionList>
        <AttentionList count={exts.length} title={`Extracts linked to no section (${exts.length})`} empty="Every extract is linked to a section.">
          {exts.map((e) => (
            <li key={e.id}>
              <Link href={`${base}/quotes?extract=${e.id}`}>
                {e.short_cite}, {e.pin_cite}
              </Link>
              <span className="text-gray-600 text-xs ml-2">{truncate(e.text, 80)}</span>
            </li>
          ))}
          {exts.length > 0 && (
            <li className="text-xs mt-1">
              <Link href={`${base}/quotes?mode=linker`}>Open the linker</Link>
            </li>
          )}
        </AttentionList>
        <AttentionList count={unsupported.length} title={`Sections with no support (${unsupported.length})`} empty="Every section has at least one source or extract.">
          {unsupported.map((s) => (
            <li key={s.id}>
              <Link href={`${base}/outline#section-${s.id}`}>
                {s.path} {s.heading}
              </Link>{" "}
              <RoleBadge role={s.role} />
            </li>
          ))}
        </AttentionList>
        <AttentionList
          count={logProblems.length}
          title={`Citation log entries missing a pin cite or unverified (${logProblems.length})`}
          empty="Every log entry has a pin cite and is verified."
        >
          {logProblems.map((r) => (
            <li key={r.id}>
              <Link href={`${base}/citations#log-${r.id}`}>
                {r.short_cite}
                {r.pin_cite ? `, ${r.pin_cite}` : ""}
              </Link>
              <span className="text-xs text-gray-600 ml-2">
                {!r.pin_cite?.trim() && "no pin cite"}
                {!r.pin_cite?.trim() && !r.verified && " · "}
                {!r.verified && "unverified"}
              </span>
            </li>
          ))}
        </AttentionList>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Milestones */}
        <section className="card">
          <h2 className="mb-2">Milestones</h2>
          <table>
            <tbody>
              {milestones.map((m) => {
                const days = daysUntil(m.due_date);
                return (
                  <tr key={m.id} className={m.done ? "text-gray-400 line-through" : ""}>
                    <td className="w-6">
                      <form action={updateMilestoneAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="done" value={m.done ? "0" : "1"} />
                        <button type="submit" className="px-1 py-0 text-xs" title={m.done ? "Mark not done" : "Mark done"}>
                          {m.done ? "✓" : "○"}
                        </button>
                      </form>
                    </td>
                    <td>{m.name}</td>
                    <td>
                      <form action={updateMilestoneAction} className="flex gap-1 items-center" key={String(m.due_date)}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="date" name="due_date" defaultValue={m.due_date ?? ""} className="text-xs" />
                        <button type="submit" className="text-xs">
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="text-xs whitespace-nowrap">
                      {!m.done && days !== null && (
                        <span className={days < 0 ? "text-red-700" : "text-gray-600"}>
                          {days === 0 ? "today" : days < 0 ? `${-days}d overdue` : `in ${days}d`}
                        </span>
                      )}
                    </td>
                    <td className="w-6">
                      <form action={deleteMilestoneAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <ConfirmButton message={`Delete milestone "${m.name}"?`} className="text-xs px-1 py-0 text-gray-500">
                          ×
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <form action={addMilestoneAction} className="flex gap-1 mt-2 items-end">
            <input type="hidden" name="slug" value={paper.slug} />
            <input name="name" placeholder="New milestone" required className="flex-1" />
            <input type="date" name="due_date" />
            <button type="submit">Add</button>
          </form>
        </section>

        {/* Open questions */}
        <section className="card">
          <h2 className="mb-2">Open questions</h2>
          <ul className="space-y-1 text-sm">
            {questions.length === 0 && <li className="text-gray-500">None.</li>}
            {questions.map((q) => (
              <li key={q.id} className={`flex gap-2 items-start ${q.resolved ? "text-gray-400" : ""}`}>
                <form action={setQuestionResolvedAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="resolved" value={q.resolved ? "0" : "1"} />
                  <button type="submit" className="px-1 py-0 text-xs" title={q.resolved ? "Reopen" : "Resolve"}>
                    {q.resolved ? "✓" : "○"}
                  </button>
                </form>
                <div className="flex-1">
                  <span className={q.resolved ? "line-through" : ""}>{q.text}</span>
                  {q.section_id && (
                    <span className="text-xs ml-2">
                      <Link href={`${base}/outline#section-${q.section_id}`}>{q.section_heading}</Link>
                    </span>
                  )}
                </div>
                <form action={deleteQuestionAction}>
                  <input type="hidden" name="id" value={q.id} />
                  <ConfirmButton message="Delete this question?" className="text-xs px-1 py-0 text-gray-500">
                    ×
                  </ConfirmButton>
                </form>
              </li>
            ))}
          </ul>
          <form action={addQuestionAction} className="grid gap-1 mt-2">
            <input type="hidden" name="slug" value={paper.slug} />
            <input name="text" placeholder="New question" required />
            <div className="flex gap-1">
              <select name="section_id" className="flex-1">
                <option value="">(no section)</option>
                {tree.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.path} {s.heading}
                  </option>
                ))}
              </select>
              <button type="submit">Add</button>
            </div>
          </form>
        </section>
      </div>

      {/* Thesis */}
      <section className="card">
        <h2 className="mb-1">Thesis</h2>
        <p className="whitespace-pre-wrap text-sm mb-3">{paper.thesis || <span className="text-gray-500">No thesis yet.</span>}</p>
        <details>
          <summary className="cursor-pointer text-sm">Revise thesis</summary>
          <form action={reviseThesisAction} className="grid gap-2 mt-2" key={paper.thesis}>
            <input type="hidden" name="slug" value={paper.slug} />
            <textarea name="thesis" rows={4} defaultValue={paper.thesis} required />
            <input name="note" placeholder="Why it changed (optional)" />
            <div>
              <button type="submit" className="primary">
                Save new version
              </button>
            </div>
          </form>
        </details>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm">Thesis history ({versions.length})</summary>
          <ol className="mt-2 space-y-2 text-sm">
            {versions.map((v) => (
              <li key={v.id} className="border-l-2 border-gray-300 pl-2">
                <div className="text-xs text-gray-600">
                  {fmtDateTime(v.created_at)}
                  {v.note && ` — ${v.note}`}
                </div>
                <div className="whitespace-pre-wrap">{v.text}</div>
              </li>
            ))}
          </ol>
        </details>
      </section>

      {/* Draft word count */}
      <section className="card text-sm">
        <h2 className="mb-1">Latest draft</h2>
        {draft ? (
          <p>
            <Link href={`${base}/drafts`}>{draft.file_path.split("/").pop()}</Link> — {draft.word_count.toLocaleString()} words
            {paper.word_limit ? (
              <>
                {" "}
                of {paper.word_limit.toLocaleString()} limit (
                <span className={draft.word_count > paper.word_limit ? "text-red-700" : "text-gray-700"}>
                  {Math.round((draft.word_count / paper.word_limit) * 100)}%
                </span>
                )
              </>
            ) : (
              " (no word limit set)"
            )}
          </p>
        ) : (
          <p className="text-gray-500">
            No drafts logged. <Link href={`${base}/drafts`}>Upload one.</Link>
          </p>
        )}
      </section>

      {/* Paper settings */}
      <details className="card">
        <summary className="cursor-pointer text-sm font-medium">Paper settings</summary>
        <form action={updatePaperAction} className="grid gap-2 mt-2 max-w-xl" key={JSON.stringify(paper)}>
          <input type="hidden" name="id" value={paper.id} />
          <label>
            Title
            <input name="title" defaultValue={paper.title} required className="w-full" />
          </label>
          <label>
            Slug (folder name under papers/; must be unique)
            <input name="slug" defaultValue={paper.slug} className="w-full" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label>
              Venue or course
              <input name="venue" defaultValue={paper.venue} className="w-full" />
            </label>
            <label>
              Word limit
              <input name="word_limit" type="number" min="0" defaultValue={paper.word_limit ?? ""} className="w-full" />
            </label>
            <label>
              Status
              <select name="status" defaultValue={paper.status} className="w-full">
                {PAPER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-gray-600">
            Changing the slug changes the URL only; files already stored under papers/{paper.slug}/ stay where they are.
          </p>
          <div>
            <button type="submit" className="primary">
              Save
            </button>
          </div>
        </form>
        <form action={deletePaperAction} className="mt-4">
          <input type="hidden" name="id" value={paper.id} />
          <ConfirmButton message={`Delete "${paper.title}" with all its sources, extracts, links, and log? Files under papers/${paper.slug}/ are left on disk.`}>
            Delete paper
          </ConfirmButton>
        </form>
      </details>
    </div>
  );
}

function AttentionList({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section className="card">
      <h3 className="text-sm mb-1">{title}</h3>
      {count === 0 ? <p className="text-xs text-gray-500">{empty}</p> : <ul className="text-sm space-y-0.5 max-h-56 overflow-auto">{children}</ul>}
    </section>
  );
}
