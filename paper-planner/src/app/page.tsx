import Link from "next/link";
import { listPapers, nextMilestone, paperCounts } from "@/lib/queries/papers";
import { lastBackupTime } from "@/lib/backup";
import { backupAction, createPaperAction } from "./actions";
import { fmtDateTime } from "@/lib/format";
import { RevealButton } from "@/components/RevealButton";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ backup?: string }> }) {
  const { backup } = await searchParams;
  const papers = listPapers();
  const last = lastBackupTime();
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <h1>Papers</h1>
        <form action={backupAction} className="text-right text-xs text-gray-600">
          <button type="submit">Back up now</button>
          <div className="mt-1">{last ? `Last backup ${fmtDateTime(last.toISOString())}` : "No backup yet"}</div>
        </form>
      </div>
      {backup && (
        <p className="card text-sm bg-green-50 border-green-300">
          Backup written to <code>{backup}</code>
          <RevealButton path={backup} />
        </p>
      )}

      {papers.length === 0 ? (
        <p className="text-gray-600">No papers yet. Create one below.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Paper</th>
              <th>Status</th>
              <th>Next milestone</th>
              <th className="text-right">Unread sources</th>
              <th className="text-right">Unlinked sources</th>
              <th className="text-right">Unlinked extracts</th>
              <th className="text-right">Unsupported sections</th>
            </tr>
          </thead>
          <tbody>
            {papers.map((p) => {
              const c = paperCounts(p.id);
              const m = nextMilestone(p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/papers/${p.slug}`} className="font-medium">
                      {p.title}
                    </Link>
                    {p.venue && <div className="text-xs text-gray-600">{p.venue}</div>}
                  </td>
                  <td>
                    <span className="badge border-gray-300">{p.status}</span>
                  </td>
                  <td>
                    {m ? (
                      <>
                        {m.name}
                        {m.days !== null && (
                          <span className={`ml-2 text-xs ${m.days < 0 ? "text-red-700" : "text-gray-600"}`}>
                            {m.days === 0 ? "today" : m.days < 0 ? `${-m.days}d overdue` : `in ${m.days}d`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    <Link href={`/papers/${p.slug}/sources`}>{c.unread_sources}</Link>
                  </td>
                  <td className="text-right">
                    <Link href={`/papers/${p.slug}`}>{c.unlinked_sources}</Link>
                  </td>
                  <td className="text-right">
                    <Link href={`/papers/${p.slug}/quotes?unlinked=1`}>{c.unlinked_extracts}</Link>
                  </td>
                  <td className="text-right">
                    <Link href={`/papers/${p.slug}/outline`}>{c.unsupported_sections}</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <section className="card max-w-2xl">
        <h2 className="mb-2">New paper</h2>
        <form action={createPaperAction} className="grid gap-2">
          <label>
            Title
            <input name="title" required className="w-full" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label>
              Venue or course
              <input name="venue" className="w-full" />
            </label>
            <label>
              Word limit
              <input name="word_limit" type="number" min="0" className="w-full" />
            </label>
          </div>
          <label>
            Thesis
            <textarea name="thesis" rows={3} className="w-full" />
          </label>
          <div>
            <button type="submit" className="primary">
              Create paper
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
