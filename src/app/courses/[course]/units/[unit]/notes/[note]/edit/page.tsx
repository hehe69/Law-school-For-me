import Link from "next/link";
import { notFound } from "next/navigation";
import NoteForm from "@/components/notes/NoteForm";
import { findUnit, loadContent } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export default async function EditNotePage({ params }: PageProps<"/courses/[course]/units/[unit]/notes/[note]/edit">) {
  const { course: courseSlug, unit: unitSlug, note: noteSlug } = await params;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const note = unit.notes.find((n) => n.slug === noteSlug);
  if (!note) notFound();
  const base = `/courses/${course.slug}/units/${unit.slug}`;

  return (
    <div className="max-w-2xl">
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / {course.title} /{" "}
        <Link href={base} className="underline">{unit.title}</Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Edit note</h1>
      <p className="mb-4 text-sm text-gray-600">
        <code className="font-mono">content/{note.path}</code>
        {note.status === "draft" && <span className="ml-2 rounded bg-yellow-200 px-2 py-0.5 text-xs font-semibold text-yellow-900">Draft</span>}
      </p>
      <NoteForm
        courseSlug={course.slug}
        unitSlug={unit.slug}
        syllabusTopics={unit.syllabusTopics}
        existingSlugs={unit.notes.map((n) => n.slug)}
        note={note}
      />
    </div>
  );
}
