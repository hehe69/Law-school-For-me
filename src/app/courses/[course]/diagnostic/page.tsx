import Link from "next/link";
import { notFound } from "next/navigation";
import { findCourse, loadContent, activeQuestions } from "@/lib/content/loader";
import { DEFAULT_PER_UNIT, defaultCount, minimumCount, unitsWithQuestions } from "@/lib/diagnostic";
import { seenQuestionIds } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export default async function DiagnosticSetupPage({ params }: PageProps<"/courses/[course]/diagnostic">) {
  const { course: courseSlug } = await params;
  const course = findCourse(loadContent(), courseSlug);
  if (!course) notFound();
  const units = unitsWithQuestions(course);
  const seen = seenQuestionIds(course.slug);
  const unseen = units.reduce((n, u) => n + activeQuestions(u).filter((q) => !seen.has(q.id)).length, 0);
  const total = units.reduce((n, u) => n + activeQuestions(u).length, 0);
  const hasIssues = units.some((u) => activeQuestions(u).some((q) => q.type === "issue"));
  const skipped = course.units.length - units.length;

  return (
    <div className="max-w-xl">
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / <Link href={`/courses/${course.slug}`} className="underline">{course.title}</Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Diagnostic exam</h1>
      <p className="mb-4 text-sm text-gray-600">
        Samples evenly across every unit with questions ({units.length}{skipped > 0 ? `; ${skipped} unit${skipped === 1 ? "" : "s"} with no questions will be reported as untested` : ""}),
        spread across tags within each unit, preferring questions you have never seen ({unseen} of {total} unseen).
        {hasIssues ? " Includes one issue question from the unit with the most." : ""} Standard timing: 90 seconds per multiple choice plus each issue question&apos;s minutes.
      </p>
      {units.length === 0 ? (
        <p className="rounded border border-gray-200 bg-gray-50 p-4">No unit in this course has questions yet.</p>
      ) : (
        <form action={`/courses/${course.slug}/test/run`} method="get" className="space-y-4">
          <input type="hidden" name="scope" value="diagnostic" />
          <label className="block">
            <span className="font-medium">Number of questions</span>
            <input type="number" name="count" min={minimumCount(course)} max={total} defaultValue={Math.min(total, defaultCount(course))} className="mt-1 w-32 rounded border border-gray-300 px-2 py-1" />
            <span className="ml-2 text-sm text-gray-500">default {DEFAULT_PER_UNIT} per unit, minimum 1 per unit ({minimumCount(course)})</span>
          </label>
          <button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white">Begin diagnostic</button>
        </form>
      )}
    </div>
  );
}
