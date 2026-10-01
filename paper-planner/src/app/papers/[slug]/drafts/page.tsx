import { notFound } from "next/navigation";
import { getPaperBySlug } from "@/lib/queries/papers";
import { listDrafts } from "@/lib/queries/drafts";
import { addDraftAction, deleteDraftAction } from "@/app/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { fmtDateTime } from "@/lib/format";

export default async function DraftsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paper = getPaperBySlug(slug);
  if (!paper) notFound();
  const drafts = listDrafts(paper.id);
  const latest = drafts[0];
  return (
    <div className="space-y-4">
      <h2>Drafts</h2>
      <p className="text-sm">
        {latest ? (
          <>
            Latest: <strong>{latest.word_count.toLocaleString()}</strong> words
            {paper.word_limit ? (
              <>
                {" "}
                of {paper.word_limit.toLocaleString()} limit —{" "}
                <span className={latest.word_count > paper.word_limit ? "text-red-700" : "text-gray-700"}>
                  {Math.round((latest.word_count / paper.word_limit) * 100)}%
                  {latest.word_count > paper.word_limit && ` (${(latest.word_count - paper.word_limit).toLocaleString()} over)`}
                </span>
              </>
            ) : (
              " (no word limit set)"
            )}
          </>
        ) : (
          <span className="text-gray-500">No drafts logged yet.</span>
        )}
      </p>
      {paper.word_limit && latest ? (
        <div className="h-2 bg-gray-200 rounded max-w-md overflow-hidden">
          <div
            className={`h-full ${latest.word_count > paper.word_limit ? "bg-red-500" : "bg-gray-700"}`}
            style={{ width: `${Math.min(100, (latest.word_count / paper.word_limit) * 100)}%` }}
          />
        </div>
      ) : null}

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th className="text-right">Word count</th>
            <th>Note</th>
            <th>File</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((d) => (
            <tr key={d.id}>
              <td className="whitespace-nowrap">{fmtDateTime(d.created_at)}</td>
              <td className="text-right">{d.word_count.toLocaleString()}</td>
              <td>{d.note}</td>
              <td>
                <a href={`/api/drafts/${d.id}/download`}>{d.file_path.split("/").pop()}</a>
              </td>
              <td>
                <form action={deleteDraftAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <ConfirmButton message="Remove this draft from the log? The file stays on disk." className="text-xs px-1 py-0 text-gray-500">
                    ×
                  </ConfirmButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <form action={addDraftAction} className="card max-w-xl grid gap-2 text-sm">
        <h3>Log a draft</h3>
        <input type="hidden" name="slug" value={paper.slug} />
        <label>
          .docx file
          <input type="file" name="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" required className="block" />
        </label>
        <label>
          What changed (one line)
          <input name="note" className="w-full" />
        </label>
        <div>
          <button type="submit" className="primary">
            Upload
          </button>
        </div>
      </form>
    </div>
  );
}
