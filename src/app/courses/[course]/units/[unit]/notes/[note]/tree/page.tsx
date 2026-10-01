import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { findUnit, loadContent, noteLinks } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

/** A rule as a checklist tree: elements as steps, exceptions under the element they defeat, Wisconsin beside its element. */
export default async function RuleTreePage({ params }: PageProps<"/courses/[course]/units/[unit]/notes/[note]/tree">) {
  const { course: courseSlug, unit: unitSlug, note: noteSlug } = await params;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const note = unit.notes.find((n) => n.slug === noteSlug);
  if (!note || note.frontmatter.type !== "rule") notFound();
  const fm = note.frontmatter;
  const base = `/courses/${course.slug}/units/${unit.slug}`;
  const links = noteLinks(course, note);
  const looseExceptions = fm.exceptions.map((e, i) => ({ e, el: fm.exceptionElements[i] })).filter((x) => !x.el || x.el > fm.elements.length);

  return (
    <div className="max-w-3xl">
      <p className="mb-1 text-sm text-gray-600 print:hidden">
        <Link href="/" className="underline">Courses</Link> / {course.title} / <Link href={base} className="underline">{unit.title}</Link> /{" "}
        <Link href={`${base}#note-${note.slug}`} className="underline">note</Link> · <Link href={`${base}/map?focus=${encodeURIComponent(note.path)}`} className="underline">on the map</Link>
      </p>
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">{fm.name || "(untitled rule)"}</h1>
        {note.status === "draft" && <span className="rounded bg-yellow-200 px-2 py-0.5 text-xs font-semibold text-yellow-900">Draft</span>}
        <span className="ml-auto flex gap-2 print:hidden">
          <Link href={`${base}/notes/${note.slug}/edit`} className="rounded border border-gray-300 px-3 py-1 text-sm">Edit</Link>
          <PrintButton className="rounded border border-gray-300 px-3 py-1 text-sm" />
        </span>
      </div>
      <p className="mb-6 whitespace-pre-line text-gray-800">{fm.ruleStatement || <span className="text-gray-400">(no rule statement yet)</span>}</p>

      {fm.elements.length === 0 && <p className="text-gray-500">No elements listed yet.</p>}
      <ol className="space-y-4">
        {fm.elements.map((el, i) => {
          const n = i + 1;
          const exceptions = fm.exceptions.filter((_, j) => fm.exceptionElements[j] === n);
          const wisconsin = fm.wisconsinElement === n && fm.wisconsinVariation;
          return (
            <li key={i} className="grid gap-3 md:grid-cols-[1fr_280px]">
              <div>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-block h-5 w-5 shrink-0 rounded border-2 border-gray-700" aria-hidden />
                  <p className="font-medium">
                    <span className="mr-1 text-gray-500">{n}.</span>{el}
                  </p>
                </div>
                {exceptions.length > 0 && (
                  <ul className="ml-8 mt-2 space-y-1 border-l-2 border-red-300 pl-3 text-sm">
                    {exceptions.map((ex, j) => (
                      <li key={j}><span className="font-semibold text-red-800">unless</span> {ex}</li>
                    ))}
                  </ul>
                )}
              </div>
              {wisconsin ? (
                <aside className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-900">Wisconsin</p>
                  <p className="whitespace-pre-line">{fm.wisconsinVariation}</p>
                </aside>
              ) : (
                <div />
              )}
            </li>
          );
        })}
      </ol>

      {looseExceptions.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">Exceptions not tied to an element</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {looseExceptions.map((x, i) => <li key={i}>{x.e}</li>)}
          </ul>
          <p className="mt-1 text-xs text-gray-500 print:hidden">Tie one to an element by starting its line with @N in the note form.</p>
        </section>
      )}
      {fm.wisconsinVariation && !fm.wisconsinElement && (
        <section className="mt-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-900">Wisconsin variation (whole rule)</p>
          <p className="whitespace-pre-line">{fm.wisconsinVariation}</p>
        </section>
      )}
      {links.relatedRules && links.relatedRules.length > 0 && (
        <p className="mt-6 text-sm text-gray-700">
          Related rules: {links.relatedRules.map((r, i) => <span key={i}>{i > 0 && ", "}{"href" in r ? <Link href={r.href} className="underline">{r.label}</Link> : r.text}</span>)}
        </p>
      )}
    </div>
  );
}
