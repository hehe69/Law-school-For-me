import Link from "next/link";
import { notFound } from "next/navigation";
import ContentErrors from "@/components/ContentErrors";
import NoteCard from "@/components/notes/NoteCard";
import { findUnit, loadContent } from "@/lib/content/loader";
import type { NoteType } from "@/lib/content/types";
import { listAttemptsForUnit } from "@/lib/attempts";
import { cardsForUnit } from "@/lib/cards";
import { formatDate, formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

const GROUPS: { type: NoteType; heading: string }[] = [
  { type: "rule", heading: "Rules" },
  { type: "case", heading: "Cases" },
  { type: "class", heading: "Class notes" },
];

export default async function UnitPage({ params }: PageProps<"/courses/[course]/units/[unit]">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const tree = loadContent();
  const found = findUnit(tree, courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const base = `/courses/${course.slug}/units/${unit.slug}`;
  const recent = listAttemptsForUnit(course.slug, unit.slug).slice(0, 3);
  const cardCount = cardsForUnit(course, unit).length;

  return (
    <div>
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / {course.title}
      </p>
      <h1 className="mb-1 text-2xl font-semibold">
        Unit {unit.order}: {unit.title}
      </h1>
      {unit.syllabusTopics.length > 0 && (
        <p className="mb-4 text-sm text-gray-600">Syllabus topics: {unit.syllabusTopics.join(" · ")}</p>
      )}

      <ContentErrors errors={unit.errors} title="Problems in this unit's files" />

      <div className="mb-8 flex flex-wrap items-center gap-4 rounded border border-gray-200 bg-gray-50 p-4">
        <span>
          <strong>{unit.questions.length}</strong> question{unit.questions.length === 1 ? "" : "s"}
        </span>
        {unit.questions.length > 0 ? (
          <Link href={`${base}/test`} className="rounded bg-blue-700 px-4 py-2 text-white">
            Start test
          </Link>
        ) : (
          <span className="text-sm text-gray-600">Add a questions.json to enable tests.</span>
        )}
        <Link href={`${base}/history`} className="text-sm text-blue-700 underline">
          Attempt history
        </Link>
        <Link href={`${base}/cards`} className="text-sm text-blue-700 underline">
          Flashcards ({cardCount})
        </Link>
        {recent.length > 0 && (
          <span className="text-sm text-gray-600">
            Recent: {recent.map((a) => `${formatScore(a.score_percent)} on ${formatDate(a.finished_at)}`).join("; ")}
          </span>
        )}
      </div>

      {unit.notes.length === 0 && <p className="text-gray-600">No notes yet. Add markdown files under notes/.</p>}

      {GROUPS.map(({ type, heading }) => {
        const notes = unit.notes.filter((n) => n.frontmatter.type === type);
        if (notes.length === 0) return null;
        return (
          <section key={type} className="mb-8">
            <h2 className="mb-3 border-b border-gray-300 pb-1 text-xl font-semibold">
              {heading} <span className="text-base font-normal text-gray-500">({notes.length})</span>
            </h2>
            {notes.map((n) => (
              <NoteCard key={n.slug} note={n} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
