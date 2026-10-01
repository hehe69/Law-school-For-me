import type { CardSection } from "@/lib/cards";

/** The answer side of a flashcard: labelled sections from the note's frontmatter. */
export default function CardBack({ sections }: { sections: CardSection[] }) {
  return (
    <dl>
      {sections.map((s) => (
        <div key={s.label} className="mb-2">
          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{s.label}</dt>
          <dd className="whitespace-pre-line">
            {s.items ? (
              s.items.length === 0 ? <span className="text-gray-500">None</span> : (
                <ul className="list-disc pl-5">{s.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
              )
            ) : (
              s.text
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
