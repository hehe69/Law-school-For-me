/** One labelled field of a note's frontmatter. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  );
}

export function FieldList({ label, items }: { label: string; items: string[] }) {
  return (
    <Field label={label}>
      {items.length === 0 ? <span className="text-gray-500">None</span> : (
        <ul className="list-disc pl-5">
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
      )}
    </Field>
  );
}
