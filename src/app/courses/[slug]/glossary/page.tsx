import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourseBySlug, listOutlines } from "@/lib/courses";
import { loadNodes } from "@/lib/nodes";
import { termsFromNodes } from "@/lib/glossary";
import { Markdown } from "@/components/Markdown";

/** Every definition node of the course, alphabetised, with the outline it lives in. */
export default async function GlossaryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const course = getCourseBySlug(db, slug);
  if (!course) notFound();
  const outlines = listOutlines(db, course.id).filter((o) => o.kind !== "attack");
  const terms = termsFromNodes(outlines.flatMap((o) => loadNodes(db, o.id)));
  const outlineName = Object.fromEntries(outlines.map((o) => [o.id, o.name]));
  const letters = Array.from(new Set(terms.map((t) => t.term[0].toUpperCase())));

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Glossary · {course.title}</h1>
        <Link href={`/courses/${course.slug}`} className="text-sm text-gray-500 hover:text-gray-900">
          Course page
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        {terms.length} term{terms.length === 1 ? "" : "s"} from definition nodes. Wherever the outline is shown as a document, these terms get a dotted underline with the definition on hover.
      </p>
      {letters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1 text-sm">
          {letters.map((l) => (
            <a key={l} href={`#letter-${l}`} className="rounded px-1.5 py-0.5 text-gray-600 hover:bg-gray-100">
              {l}
            </a>
          ))}
        </div>
      )}
      {terms.length === 0 && <p className="card mt-6 text-sm text-gray-500">No definition nodes yet. Give a node the type &quot;definition&quot;, with the term as its title.</p>}
      <dl className="mt-6">
        {terms.map((t, i) => {
          const letter = t.term[0].toUpperCase();
          const first = i === 0 || terms[i - 1].term[0].toUpperCase() !== letter;
          return (
            <div key={t.nodeId} className="border-b border-gray-100 py-3">
              {first && (
                <div id={`letter-${letter}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {letter}
                </div>
              )}
              <dt className="font-medium">
                <Link href={`/courses/${course.slug}/outlines/${t.outlineId}?node=${t.nodeId}`} className="hover:underline">
                  {t.term}
                </Link>
                <span className="ml-2 text-xs font-normal text-gray-400">{outlineName[t.outlineId]}</span>
              </dt>
              <dd className="mt-1 text-sm text-gray-700">
                <Markdown text={t.definition} terms={terms} skipNodeId={t.nodeId} />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
