import Link from "next/link";
import { notFound } from "next/navigation";
import NoteForm from "@/components/notes/NoteForm";
import { findUnit, loadContent, ruleNoteOptions } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export default async function NewNotePage({ params }: PageProps<"/courses/[course]/units/[unit]/notes/new">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const base = `/courses/${course.slug}/units/${unit.slug}`;

  return (
    <div className="max-w-2xl">
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / {course.title} /{" "}
        <Link href={base} className="underline">{unit.title}</Link>
      </p>
      <h1 className="mb-4 text-2xl font-semibold">New note</h1>
      <NoteForm
        courseSlug={course.slug}
        unitSlug={unit.slug}
        syllabusTopics={unit.syllabusTopics}
        existingSlugs={unit.notes.map((n) => n.slug)}
        ruleNotes={ruleNoteOptions(course).map((r) => ({ ref: r.ref, label: r.label }))}
      />
    </div>
  );
}
