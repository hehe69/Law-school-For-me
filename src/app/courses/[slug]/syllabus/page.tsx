import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { defaultOutline, getCourseBySlug } from "@/lib/courses";
import { getSyllabus, syllabusUrl } from "@/lib/syllabus";
import { removeSyllabusAction, saveTopicsAction, uploadSyllabusAction } from "@/app/syllabus-actions";
import { importTopicsAction } from "@/app/import-actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

export default async function SyllabusPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params;
  const query = await searchParams;
  const db = getDb();
  const course = getCourseBySlug(db, slug);
  if (!course) notFound();
  const syllabus = getSyllabus(db, course.id);
  const outline = defaultOutline(db, course.id);
  const error = typeof query.error === "string" ? query.error : null;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Syllabus · {course.title}</h1>
        <Link href={`/courses/${course.slug}`} className="text-sm text-gray-500 hover:text-gray-900">
          Course page
        </Link>
      </div>
      {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <section className="card mt-6">
        <h2 className="text-base font-medium">Syllabus PDF</h2>
        {syllabus ? (
          <p className="mt-1 text-sm text-gray-600">
            Uploaded {new Date(syllabus.uploadedAt).toLocaleString()}.{" "}
            {outline && (
              <Link href={`/courses/${course.slug}/outlines/${outline.id}?pane=syllabus`} className="text-blue-700 hover:underline">
                Open it beside the outline
              </Link>
            )}{" "}
            to build the skeleton from it: select text in the PDF pane and press ⌘⇧H to make a heading at the current level.
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-600">No syllabus yet. Upload the PDF to view it in a split pane beside the outline and turn selected lines into headings.</p>
        )}
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <form action={uploadSyllabusAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="courseId" value={course.id} />
            <div>
              <label className="label" htmlFor="file">
                {syllabus ? "Replace the PDF" : "PDF file"}
              </label>
              <input id="file" name="file" type="file" accept="application/pdf,.pdf" className="text-sm" required />
            </div>
            <button type="submit" className="btn-primary">
              {syllabus ? "Replace" : "Upload"}
            </button>
          </form>
          {syllabus && (
            <form action={removeSyllabusAction}>
              <input type="hidden" name="courseId" value={course.id} />
              <ConfirmSubmit message="Remove the syllabus PDF? The topics list stays.">Remove</ConfirmSubmit>
            </form>
          )}
        </div>
        {syllabus && <iframe title="Syllabus" src={syllabusUrl(syllabus)} className="mt-4 h-[70vh] w-full rounded border border-gray-200" />}
      </section>

      <section className="card mt-6">
        <h2 className="text-base font-medium">Syllabus topics</h2>
        <p className="mt-1 text-sm text-gray-600">One per line. Topics are offered as tags on every node and drive the gaps view (a topic with no node is a gap).</p>
        <form action={saveTopicsAction} className="mt-3">
          <input type="hidden" name="courseId" value={course.id} />
          <textarea name="syllabusTopics" className="input" rows={Math.max(6, course.syllabusTopics.length + 2)} defaultValue={course.syllabusTopics.join("\n")} />
          <div className="mt-2 flex items-center gap-3">
            <button type="submit" className="btn-primary">
              Save topics
            </button>
            <span className="text-xs text-gray-500">{course.syllabusTopics.length} topics</span>
          </div>
        </form>
        {course.studyCourseSlug && (
          <form action={importTopicsAction} className="mt-3 border-t border-gray-200 pt-3">
            <input type="hidden" name="courseId" value={course.id} />
            <button type="submit" className="btn">
              Add topics from the study app&apos;s unit.json files
            </button>
            <span className="ml-2 text-xs text-gray-500">linked to {course.studyCourseSlug}</span>
          </form>
        )}
      </section>
    </div>
  );
}
