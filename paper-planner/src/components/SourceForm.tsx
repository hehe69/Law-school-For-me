import { READ_STATUSES, SOURCE_TYPES } from "@/lib/types";

export function SourceForm({
  slug,
  source,
  action,
}: {
  slug: string;
  action: (fd: FormData) => Promise<void>;
  source?: {
    id: number;
    type: string;
    citation: string;
    short_cite: string;
    year: number | null;
    publisher: string;
    url: string;
    read_status: string;
    relevance: string;
    tags: string[];
  };
}) {
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="slug" value={slug} />
      {source && <input type="hidden" name="id" value={source.id} />}
      <label>
        Full citation (as you type it)
        <input name="citation" required defaultValue={source?.citation ?? ""} className="w-full" />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label>
          Short cite
          <input name="short_cite" defaultValue={source?.short_cite ?? ""} className="w-full" />
        </label>
        <label>
          Type
          <select name="type" defaultValue={source?.type ?? "article"} className="w-full">
            {SOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <input name="year" type="number" defaultValue={source?.year ?? ""} className="w-full" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label>
          Court or publisher
          <input name="publisher" defaultValue={source?.publisher ?? ""} className="w-full" />
        </label>
        <label>
          URL
          <input name="url" defaultValue={source?.url ?? ""} className="w-full" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label>
          Read status
          <select name="read_status" defaultValue={source?.read_status ?? "unread"} className="w-full">
            {READ_STATUSES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tags (comma-separated)
          <input name="tags" defaultValue={source?.tags.join(", ") ?? ""} className="w-full" />
        </label>
      </div>
      <label>
        Relevance note
        <textarea name="relevance" rows={2} defaultValue={source?.relevance ?? ""} className="w-full" />
      </label>
      <label>
        PDF (optional)
        <input name="pdf" type="file" accept="application/pdf,.pdf" className="block" />
      </label>
      <div>
        <button type="submit" className="primary">
          {source ? "Save" : "Add source"}
        </button>
      </div>
    </form>
  );
}
