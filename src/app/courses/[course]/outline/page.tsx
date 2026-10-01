import Link from "next/link";
import { notFound } from "next/navigation";
import { exportOutlineAction } from "@/app/content-actions";
import { findCourse, loadContent } from "@/lib/content/loader";
import { buildOutline, OUTLINE_DIR, type OutlineNote } from "@/lib/outline";

export const dynamic = "force-dynamic";

function Entry({ note, courseSlug }: { note: OutlineNote; courseSlug: string }) {
  return (
    <article className="mb-4">
      <h4 className="font-semibold">
        <Link href={`/courses/${courseSlug}/units/${note.unitSlug}#note-${note.slug}`} className="hover:underline">{note.title}</Link>
        {note.draft && <span className="ml-2 rounded bg-yellow-200 px-2 py-0.5 text-xs font-semibold text-yellow-900">Draft</span>}
      </h4>
      <dl className="ml-4">
        {note.entries.map((e) => (
          <div key={e.label} className="mb-1">
            <dt className="inline text-xs font-semibold uppercase tracking-wide text-gray-500">{e.label}: </dt>
            <dd className="inline whitespace-pre-line">
              {e.items ? (e.items.length ? <ul className="ml-5 list-disc">{e.items.map((it, i) => <li key={i}>{it}</li>)}</ul> : <span className="text-gray-400">(none)</span>) : e.text?.trim() ? e.text : <span className="text-gray-400">(empty)</span>}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export default async function OutlinePage({ params, searchParams }: PageProps<"/courses/[course]/outline">) {
  const { course: courseSlug } = await params;
  const sp = await searchParams;
  const course = findCourse(loadContent(), courseSlug);
  if (!course) notFound();
  const units = buildOutline(course);

  return (
    <div>
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / <Link href={`/courses/${course.slug}`} className="underline">{course.title}</Link>
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Outline</h1>
        <form action={exportOutlineAction} className="ml-auto flex items-center gap-2 text-sm">
          <input type="hidden" name="course" value={course.slug} />
          <span className="text-gray-600">to <code className="font-mono">{OUTLINE_DIR}/</code></span>
          <button type="submit" className="rounded border border-gray-300 px-3 py-1">Export markdown</button>
        </form>
      </div>
      {typeof sp.exported === "string" && (
        <p className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">Written to <code className="font-mono">{sp.exported}</code></p>
      )}
      <p className="mb-6 text-sm text-gray-600">Every unit in order: rule notes, then case notes, your text as written.</p>

      {units.map((u) => (
        <section key={u.slug} className="mb-8">
          <h2 className="mb-3 border-b border-gray-300 pb-1 text-xl font-semibold">Unit {u.order}: {u.title}</h2>
          {u.rules.length === 0 && u.cases.length === 0 && <p className="text-sm text-gray-500">No rule or case notes yet.</p>}
          {u.rules.length > 0 && <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Rules</h3>}
          {u.rules.map((n) => <Entry key={n.slug} note={n} courseSlug={course.slug} />)}
          {u.cases.length > 0 && <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Cases</h3>}
          {u.cases.map((n) => <Entry key={n.slug} note={n} courseSlug={course.slug} />)}
        </section>
      ))}
    </div>
  );
}
