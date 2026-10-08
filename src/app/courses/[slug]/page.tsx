import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourseBySlug, listOutlines } from "@/lib/courses";
import { loadImages, loadNodes } from "@/lib/nodes";
import { estimatePages } from "@/lib/progress";
import { createOutlineAction, deleteCourseAction, deleteOutlineAction, renameOutlineAction, updateCourseAction } from "@/app/actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

const KIND_LABEL = { full: "Full", attack: "Attack", scratch: "Scratch" } as const;

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const course = getCourseBySlug(db, slug);
  if (!course) notFound();
  const outlines = listOutlines(db, course.id);
  const main = outlines.find((o) => o.isDefault && o.kind === "full") ?? outlines.find((o) => o.kind === "full") ?? null;
  const pageEstimates = course.pageLimit
    ? outlines.filter((o) => o.kind !== "scratch").map((o) => ({ id: o.id, name: o.name, pages: estimatePages(loadNodes(db, o.id), loadImages(db, o.id)) }))
    : [];
  const nodeCounts = Object.fromEntries(
    outlines.map((o) => [o.id, (db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE outline_id = ?").get(o.id) as { n: number }).n]),
  ) as Record<string, number>;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">{course.title}</h1>
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          All courses
        </Link>
      </div>
      {course.examDate && (
        <p className="mt-1 text-sm text-gray-600">
          Exam {course.examDate}
          {course.examFormat ? ` · ${course.examFormat}` : ""}
        </p>
      )}
      <nav className="mt-3 flex flex-wrap gap-2 text-sm">
        <Link href={`/courses/${course.slug}/syllabus`} className="btn">
          Syllabus
        </Link>
        <Link href={`/courses/${course.slug}/import`} className="btn">
          Import
        </Link>
        <Link href={`/courses/${course.slug}/inbox`} className="btn">
          Inbox
        </Link>
        <Link href={`/courses/${course.slug}/glossary`} className="btn">
          Glossary
        </Link>
        {main && (
          <>
            <Link href={`/courses/${course.slug}/outlines/${main.id}/exam`} className="btn">
              Exam mode
            </Link>
            <Link href={`/courses/${course.slug}/outlines/${main.id}/checklist`} className="btn">
              Issue checklist
            </Link>
            <Link href={`/courses/${course.slug}/outlines/${main.id}/flowchart`} className="btn">
              Flowcharts
            </Link>
            <Link href={`/courses/${course.slug}/outlines/${main.id}/attack`} className="btn">
              Attack outline
            </Link>
            <Link href={`/courses/${course.slug}/outlines/${main.id}/drill`} className="btn">
              Drills
            </Link>
            <Link href={`/courses/${course.slug}/outlines/${main.id}/print`} className="btn">
              Print
            </Link>
            <Link href={`/courses/${course.slug}/outlines/${main.id}/export`} className="btn">
              Export
            </Link>
            <Link href={`/courses/${course.slug}/outlines/${main.id}/snapshots`} className="btn">
              Snapshots
            </Link>
          </>
        )}
        <Link href={`/courses/${course.slug}/progress`} className="btn">
          Progress
        </Link>
        <Link href={`/courses/${course.slug}/gaps`} className="btn">
          Gaps
        </Link>
        <Link href={`/review?course=${course.slug}`} className="btn">
          Review
        </Link>
      </nav>
      {course.pageLimit && pageEstimates.length > 0 && (
        <p className="mt-2 text-sm text-gray-600">
          Page limit {course.pageLimit}:{" "}
          {pageEstimates.map((p, i) => (
            <span key={p.id}>
              {i > 0 ? " · " : ""}
              {p.name} ~{p.pages} page{p.pages === 1 ? "" : "s"}
              <span className={p.pages > course.pageLimit! ? " text-red-700" : " text-green-700"}>{p.pages > course.pageLimit! ? " (over)" : " (ok)"}</span>
            </span>
          ))}
        </p>
      )}

      <section className="mt-6">
        <h2 className="text-base font-medium">Outlines</h2>
        <ul className="mt-2 divide-y divide-gray-200 rounded border border-gray-200">
          {outlines.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3 px-4 py-2">
              <Link href={`/courses/${course.slug}/outlines/${o.id}`} className="font-medium text-gray-900 hover:underline">
                {o.name}
              </Link>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{KIND_LABEL[o.kind]}</span>
              {o.isDefault && <span className="text-xs text-gray-500">default</span>}
              <span className="text-xs text-gray-500">{nodeCounts[o.id]} nodes</span>
              <form action={renameOutlineAction} className="ml-auto flex items-center gap-2">
                <input type="hidden" name="id" value={o.id} />
                <input name="name" defaultValue={o.name} className="input w-40" aria-label="Outline name" />
                {o.kind === "full" && !o.isDefault && (
                  <label className="flex items-center gap-1 text-xs text-gray-600">
                    <input type="checkbox" name="isDefault" /> make default
                  </label>
                )}
                <button className="btn" type="submit">
                  Save
                </button>
              </form>
              {o.kind !== "scratch" && (
                <form action={deleteOutlineAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <ConfirmSubmit message={`Delete the outline "${o.name}" and all its nodes? This cannot be undone.`}>Delete</ConfirmSubmit>
                </form>
              )}
            </li>
          ))}
        </ul>

        <form action={createOutlineAction} className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="courseId" value={course.id} />
          <div>
            <label className="label" htmlFor="name">
              New outline
            </label>
            <input id="name" name="name" className="input w-48" placeholder="Midterm" required />
          </div>
          <div>
            <label className="label" htmlFor="kind">
              Kind
            </label>
            <select id="kind" name="kind" className="input w-32" defaultValue="full">
              <option value="full">Full</option>
              <option value="attack">Attack</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="numbering">
              Numbering
            </label>
            <select id="numbering" name="numbering" className="input w-32" defaultValue="legal">
              <option value="legal">Legal (I. A. 1.)</option>
              <option value="decimal">Decimal (1.1.1)</option>
              <option value="bullets">Bullets</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Create
          </button>
        </form>
      </section>

      <section className="card mt-8">
        <h2 className="text-base font-medium">Course settings</h2>
        <form action={updateCourseAction} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={course.id} />
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">
              Title
            </label>
            <input id="title" name="title" className="input" defaultValue={course.title} required />
          </div>
          <div>
            <label className="label" htmlFor="examDate">
              Exam date
            </label>
            <input id="examDate" name="examDate" type="date" className="input" defaultValue={course.examDate ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="pageLimit">
              Page limit for the printed outline
            </label>
            <input id="pageLimit" name="pageLimit" type="number" min={1} className="input" defaultValue={course.pageLimit ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="examFormat">
              Exam format notes
            </label>
            <textarea id="examFormat" name="examFormat" className="input" rows={2} defaultValue={course.examFormat} />
          </div>
          <div>
            <label className="label" htmlFor="studyCourseSlug">
              Study-app course slug
            </label>
            <input id="studyCourseSlug" name="studyCourseSlug" className="input" defaultValue={course.studyCourseSlug ?? ""} placeholder="property" />
          </div>
          <div>
            <label className="label" htmlFor="order">
              Order
            </label>
            <input id="order" name="order" type="number" className="input" defaultValue={course.order} />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="syllabusTopics">
              Syllabus topics (one per line)
            </label>
            <textarea id="syllabusTopics" name="syllabusTopics" className="input" rows={4} defaultValue={course.syllabusTopics.join("\n")} />
          </div>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" className="btn-primary">
              Save settings
            </button>
          </div>
        </form>
        <form action={deleteCourseAction} className="mt-4 border-t border-gray-200 pt-4">
          <input type="hidden" name="id" value={course.id} />
          <ConfirmSubmit message={`Delete "${course.title}" with every outline, node, image and capture in it? This cannot be undone.`}>Delete course</ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}
