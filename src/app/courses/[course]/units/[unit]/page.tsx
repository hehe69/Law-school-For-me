import Link from "next/link";
import { notFound } from "next/navigation";
import ContentErrors from "@/components/ContentErrors";
import NoteCard from "@/components/notes/NoteCard";
import { activeQuestions, findUnit, loadContent } from "@/lib/content/loader";
import type { NoteType } from "@/lib/content/types";
import EmphasisForm from "@/components/EmphasisForm";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteQuestionAction, toggleQuestionAction, uploadReadingsAction } from "@/app/content-actions";
import { fileUrl } from "@/lib/content/loader";
import { listAttemptsForUnit } from "@/lib/attempts";
import { cardsForUnit } from "@/lib/cards";
import { missedQuestionIds } from "@/lib/weakTags";
import { countByType } from "@/lib/testing";
import { formatDate, formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

const GROUPS: { type: NoteType; heading: string }[] = [
  { type: "rule", heading: "Rules" },
  { type: "case", heading: "Cases" },
  { type: "class", heading: "Class notes" },
];

export default async function UnitPage({ params, searchParams }: PageProps<"/courses/[course]/units/[unit]">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const sp = await searchParams;
  const tree = loadContent();
  const found = findUnit(tree, courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const base = `/courses/${course.slug}/units/${unit.slug}`;
  const recent = listAttemptsForUnit(course.slug, unit.slug).slice(0, 3);
  const cardCount = cardsForUnit(course, unit).length;
  const inUnit = new Set(unit.questions.map((q) => q.id));
  const missed = missedQuestionIds(course.slug, unit.slug).filter((id) => inUnit.has(id));
  const draftCount = unit.notes.filter((n) => n.status === "draft").length;
  const byType = countByType(activeQuestions(unit));
  const disabledCount = unit.questions.filter((q) => q.disabled).length;

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
          <strong>{byType.mc}</strong> multiple choice
          {byType.issue > 0 && <>, <strong>{byType.issue}</strong> issue</>}
          {disabledCount > 0 && <span className="text-gray-500"> ({disabledCount} disabled)</span>}
        </span>
        {byType.mc + byType.issue > 0 ? (
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
        {missed.length > 0 && (
          <Link
            href={`/courses/${course.slug}/test/run?scope=retry&unit=${unit.slug}&ids=${encodeURIComponent(missed.join(","))}`}
            className="rounded border border-red-300 px-3 py-1 text-sm text-red-800"
            title="Every question in this unit you have ever missed"
          >
            Retry all missed ({missed.length})
          </Link>
        )}
        <span className="ml-auto flex gap-3 text-sm">
          <Link href={`${base}/notes/new`} className="rounded border border-gray-300 px-3 py-1">New note</Link>
          <Link href={`${base}/import`} className="rounded border border-gray-300 px-3 py-1">Import questions</Link>
          <Link href={`/courses/${course.slug}/weak-tags`} className="text-blue-700 underline">Weak tags</Link>
        </span>
        {recent.length > 0 && (
          <span className="text-sm text-gray-600">
            Recent: {recent.map((a) => `${formatScore(a.score_percent)} on ${formatDate(a.finished_at)}`).join("; ")}
          </span>
        )}
      </div>

      <EmphasisForm courseSlug={course.slug} unitSlug={unit.slug} emphasis={unit.emphasis} />

      {unit.notes.length === 0 && (
        <p className="text-gray-600">
          No notes yet. <Link href={`${base}/notes/new`} className="underline">Create one</Link> or add markdown files under notes/.
        </p>
      )}
      {draftCount > 0 && (
        <p className="mb-4 text-sm text-yellow-900">
          {draftCount} draft note{draftCount === 1 ? "" : "s"} in this unit (missing fields). Drafts make no flashcards.
        </p>
      )}

      {GROUPS.map(({ type, heading }) => {
        const notes = unit.notes.filter((n) => n.frontmatter.type === type);
        if (notes.length === 0) return null;
        return (
          <section key={type} className="mb-8">
            <h2 className="mb-3 border-b border-gray-300 pb-1 text-xl font-semibold">
              {heading} <span className="text-base font-normal text-gray-500">({notes.length})</span>
            </h2>
            {notes.map((n) => (
              <NoteCard key={n.slug} note={n} editHref={`${base}/notes/${n.slug}/edit`} />
            ))}
          </section>
        );
      })}

      <section id="readings" className="mb-8">
        <h2 className="mb-3 border-b border-gray-300 pb-1 text-xl font-semibold">
          Readings <span className="text-base font-normal text-gray-500">({unit.readings.length})</span>
        </h2>
        {typeof sp.uploaded === "string" && <p className="mb-2 text-sm text-green-800">Uploaded: {sp.uploaded}</p>}
        {typeof sp.skipped === "string" && <p className="mb-2 text-sm text-red-700">Skipped (not a PDF or too large): {sp.skipped}</p>}
        {unit.readings.length === 0 ? (
          <p className="mb-3 text-sm text-gray-600">No PDFs yet. Upload below or drop files into <code className="font-mono">content/{course.slug}/{unit.slug}/readings/</code>.</p>
        ) : (
          <ul className="mb-3 space-y-1 text-sm">
            {unit.readings.map((r) => (
              <li key={r.file} className="flex items-center gap-3">
                <Link href={`${base}/readings/${encodeURIComponent(r.file)}`} className="text-blue-700 underline">{r.file}</Link>
                <span className="text-gray-500">{(r.bytes / 1024 / 1024).toFixed(1)} MB</span>
                <a href={fileUrl(course.slug, unit.slug, `readings/${r.file}`)} target="_blank" rel="noopener" className="text-xs text-gray-500 underline">raw</a>
              </li>
            ))}
          </ul>
        )}
        <form action={uploadReadingsAction} className="flex flex-wrap items-center gap-2 text-sm">
          <input type="hidden" name="course" value={course.slug} />
          <input type="hidden" name="unit" value={unit.slug} />
          <input type="file" name="files" accept=".pdf,application/pdf" multiple required className="text-sm" />
          <button type="submit" className="rounded border border-gray-300 px-3 py-1">Upload PDF</button>
        </form>
      </section>

      <section id="questions" className="mb-8">
        <h2 className="mb-3 border-b border-gray-300 pb-1 text-xl font-semibold">
          Questions <span className="text-base font-normal text-gray-500">({unit.questions.length})</span>
        </h2>
        {unit.questions.length === 0 ? (
          <p className="text-sm text-gray-600">None yet. <Link href={`${base}/import`} className="underline">Import questions</Link>.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {unit.questions.map((q) => (
              <li key={q.id} id={`question-${q.id}`} className={`flex flex-wrap items-start gap-3 rounded border p-3 ${q.disabled ? "border-gray-200 bg-gray-50 text-gray-500" : "border-gray-200"}`}>
                <div className="min-w-0 flex-1">
                  <p className="mb-1">
                    <code className="font-mono">{q.id}</code>
                    <span className="ml-2 rounded bg-gray-100 px-1.5 text-xs">{q.type === "mc" ? "multiple choice" : `issue · ${q.issues.length} issues · ${q.minutes} min`}</span>
                    {q.disabled && <span className="ml-2 rounded bg-yellow-100 px-1.5 text-xs text-yellow-900">disabled</span>}
                    {q.image && <span className="ml-2 text-xs text-gray-500">image</span>}
                  </p>
                  <p className="line-clamp-2">{q.type === "mc" ? q.stem : q.factPattern}</p>
                  {q.tags.length > 0 && <p className="mt-1 text-xs text-gray-500">{q.tags.join(" · ")}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs">
                  <Link href={`${base}/questions/${encodeURIComponent(q.id)}/edit`} className="rounded border border-gray-300 px-2 py-0.5">Edit</Link>
                  <form action={toggleQuestionAction}>
                    <input type="hidden" name="course" value={course.slug} />
                    <input type="hidden" name="unit" value={unit.slug} />
                    <input type="hidden" name="id" value={q.id} />
                    <input type="hidden" name="disabled" value={q.disabled ? "false" : "true"} />
                    <button type="submit" className="rounded border border-gray-300 px-2 py-0.5">{q.disabled ? "Enable" : "Disable"}</button>
                  </form>
                  <form action={deleteQuestionAction}>
                    <input type="hidden" name="course" value={course.slug} />
                    <input type="hidden" name="unit" value={unit.slug} />
                    <input type="hidden" name="id" value={q.id} />
                    <ConfirmButton message={`Delete question ${q.id} from questions.json? Past attempts keep their record.`} className="rounded border border-red-300 px-2 py-0.5 text-red-800">Delete</ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
