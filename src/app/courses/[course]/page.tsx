import Link from "next/link";
import { notFound } from "next/navigation";
import ContentErrors from "@/components/ContentErrors";
import UnitTable from "@/components/UnitTable";
import { setExamDateAction } from "@/app/content-actions";
import { listDiagnostics, unitStatsMap } from "@/lib/attempts";
import { formatDate, formatScore } from "@/lib/format";
import { findCourse, loadContent } from "@/lib/content/loader";
import { examPlan } from "@/lib/exam";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: PageProps<"/courses/[course]">) {
  const { course: courseSlug } = await params;
  const tree = loadContent();
  const course = findCourse(tree, courseSlug);
  if (!course) notFound();
  const errors = tree.errors.filter((e) => e.path.startsWith(`${course.slug}/`) || e.path === course.slug);
  const stats = unitStatsMap();
  const plan = examPlan(course, stats);
  const diagnostics = listDiagnostics(course.slug);

  return (
    <div>
      <p className="mb-1 text-sm text-gray-600"><Link href="/" className="underline">Courses</Link></p>
      <h1 className="mb-1 text-2xl font-semibold">{course.title}</h1>
      <p className="mb-4 text-sm text-gray-600"><code className="font-mono">content/{course.slug}/</code> · order {course.order}</p>

      <ContentErrors errors={errors} title="Problems in this course's files" />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/courses/${course.slug}/units/new`} className="rounded bg-blue-700 px-4 py-2 text-white">New unit</Link>
        <Link href={`/courses/${course.slug}/diagnostic`} className="rounded border border-blue-700 px-4 py-2 text-blue-800">Diagnostic</Link>
        <Link href={`/courses/${course.slug}/weak-tags`} className="text-blue-700 underline">Weak tags</Link>
        <Link href={`/review?course=${course.slug}`} className="text-blue-700 underline">Review cards</Link>
        <Link href={`/courses/${course.slug}/outline`} className="text-blue-700 underline">Outline</Link>
        <Link href={`/courses/${course.slug}/map`} className="text-blue-700 underline">Map</Link>
      </div>

      <form action={setExamDateAction} className="mb-6 flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
        <input type="hidden" name="course" value={course.slug} />
        <label className="font-medium" htmlFor="examDate">Exam date</label>
        <input id="examDate" type="date" name="examDate" defaultValue={course.examDate ?? ""} className="rounded border border-gray-300 px-2 py-1" />
        <button type="submit" className="rounded border border-gray-300 px-3 py-1">Save</button>
        {plan && (
          <span className="text-gray-600">
            {plan.daysRemaining > 0 ? `${plan.daysRemaining} day${plan.daysRemaining === 1 ? "" : "s"} remaining` : plan.daysRemaining === 0 ? "exam is today" : `${-plan.daysRemaining} day${plan.daysRemaining === -1 ? "" : "s"} ago`}
            {plan.unitsPerWeek !== null && ` · ${plan.unitsRemaining} unit${plan.unitsRemaining === 1 ? "" : "s"} untested · ${plan.unitsPerWeek} unit${plan.unitsPerWeek === 1 ? "" : "s"} per week to finish`}
          </span>
        )}
        {!course.examDate && <span className="text-gray-500">none set; clear the field and save to remove</span>}
      </form>

      <UnitTable course={course} stats={stats} showEdit />

      <section className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Diagnostics</h2>
        {diagnostics.length === 0 ? (
          <p className="text-sm text-gray-600">None yet. <Link href={`/courses/${course.slug}/diagnostic`} className="underline">Take one</Link> at the start of term and again before the exam.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {diagnostics.map((a) => (
              <li key={a.id}>
                {formatDate(a.finished_at)} · <strong>{formatScore(a.score_percent)}</strong> ({a.points_earned}/{a.points_possible} points, {a.question_count} questions) ·{" "}
                <Link href={`/attempts/${a.id}`} className="text-blue-700 underline">Report</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
