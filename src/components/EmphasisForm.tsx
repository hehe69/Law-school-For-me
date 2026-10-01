import { saveEmphasisAction } from "@/app/content-actions";

/** Professor emphasis for a unit: shown as a callout, edited through a plain form, saved to unit.json. */
export default function EmphasisForm({ courseSlug, unitSlug, emphasis }: { courseSlug: string; unitSlug: string; emphasis: string }) {
  return (
    <section className="mb-8 rounded border border-amber-300 bg-amber-50 p-4">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-amber-900">Professor emphasis</h2>
      {emphasis ? (
        <p className="mb-2 whitespace-pre-line">{emphasis}</p>
      ) : (
        <p className="mb-2 text-sm text-gray-600">Nothing recorded yet. What did the professor say matters most in this unit?</p>
      )}
      <details open={!emphasis}>
        <summary className="cursor-pointer text-sm text-amber-900 underline">{emphasis ? "Edit" : "Add"}</summary>
        <form action={saveEmphasisAction} className="mt-2">
          <input type="hidden" name="course" value={courseSlug} />
          <input type="hidden" name="unit" value={unitSlug} />
          <textarea name="emphasis" defaultValue={emphasis} rows={4} className="w-full rounded border border-gray-300 bg-white px-2 py-1" />
          <button type="submit" className="mt-2 rounded bg-amber-700 px-3 py-1 text-sm text-white">Save to unit.json</button>
        </form>
      </details>
    </section>
  );
}
