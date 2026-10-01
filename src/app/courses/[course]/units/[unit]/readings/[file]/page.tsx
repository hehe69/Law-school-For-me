import Link from "next/link";
import { notFound } from "next/navigation";
import NoteCard from "@/components/notes/NoteCard";
import { fileUrl, findUnit, loadContent } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

/** A PDF reading beside the unit's notes. */
export default async function ReadingPage({ params }: PageProps<"/courses/[course]/units/[unit]/readings/[file]">) {
  const { course: courseSlug, unit: unitSlug, file } = await params;
  const name = decodeURIComponent(file);
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const reading = unit.readings.find((r) => r.file === name);
  if (!reading) notFound();
  const base = `/courses/${course.slug}/units/${unit.slug}`;
  const src = fileUrl(course.slug, unit.slug, `readings/${reading.file}`);
  const others = unit.readings.filter((r) => r.file !== reading.file);

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-57px)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-4 py-2 text-sm">
        <Link href="/" className="underline">Courses</Link> / {course.title} / <Link href={base} className="underline">{unit.title}</Link>
        <span className="font-semibold">{reading.file}</span>
        <a href={src} target="_blank" rel="noopener" className="text-blue-700 underline">open in a new tab</a>
        {others.length > 0 && (
          <span className="ml-auto text-gray-600">
            Other readings:{" "}
            {others.map((r) => (
              <Link key={r.file} href={`${base}/readings/${encodeURIComponent(r.file)}`} className="mr-2 underline">{r.file}</Link>
            ))}
          </span>
        )}
      </div>
      <div className="grid min-h-0 flex-1 md:grid-cols-[3fr_2fr]">
        <iframe src={src} title={reading.file} className="h-full min-h-[60vh] w-full border-r border-gray-200" />
        <div className="min-h-0 overflow-y-auto px-4 py-3">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Notes · {unit.title}</h2>
          {unit.notes.length === 0 && <p className="text-sm text-gray-600">No notes in this unit yet.</p>}
          {unit.notes.map((n) => (
            <NoteCard key={n.slug} note={n} editHref={`${base}/notes/${n.slug}/edit`} />
          ))}
        </div>
      </div>
    </div>
  );
}
