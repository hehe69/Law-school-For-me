/** One labelled field of a note's frontmatter. Empty values render as a dash so drafts show their holes. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === "" || children === null || children === undefined;
  return (
    <div className="mb-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="whitespace-pre-line">{empty ? <span className="text-gray-400">—</span> : children}</dd>
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
