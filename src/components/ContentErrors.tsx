import type { ContentError } from "@/lib/content/types";

/** Lists malformed content files. Renders nothing when there are no errors. */
export default function ContentErrors({ errors, title = "Content problems" }: { errors: ContentError[]; title?: string }) {
  if (errors.length === 0) return null;
  return (
    <div className="mb-6 rounded border border-red-300 bg-red-50 p-4 text-sm">
      <p className="font-semibold text-red-800">
        {title} ({errors.length})
      </p>
      <p className="mb-2 text-red-700">These files were skipped. Fix them and reload the page.</p>
      <ul className="list-disc space-y-1 pl-5 text-red-900">
        {errors.map((e, i) => (
          <li key={i}>
            <code className="font-mono">content/{e.path}</code>: {e.message}
          </li>
        ))}
      </ul>
    </div>
  );
}
