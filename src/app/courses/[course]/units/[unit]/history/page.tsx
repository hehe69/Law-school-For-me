import Link from "next/link";
import { notFound } from "next/navigation";
import { listAttemptsForUnit } from "@/lib/attempts";
import { findUnit, loadContent, SCOPE_LABELS } from "@/lib/content/loader";
import { formatDate, formatDuration, formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ params }: PageProps<"/courses/[course]/units/[unit]/history">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const base = `/courses/${course.slug}/units/${unit.slug}`;
  const attempts = listAttemptsForUnit(course.slug, unit.slug);
  const best = attempts.reduce<number | null>((b, a) => (b === null || a.score_percent > b ? a.score_percent : b), null);

  return (
    <div>
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / {course.title} /{" "}
        <Link href={base} className="underline">{unit.title}</Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Attempt history</h1>
      <p className="mb-4 text-sm text-gray-600">
        {attempts.length} attempt{attempts.length === 1 ? "" : "s"} started from this unit · best {formatScore(best)}
      </p>

      {attempts.length === 0 ? (
        <p>
          No attempts yet. <Link href={`${base}/test`} className="underline">Start a test</Link>.
        </p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-600">
              <th className="py-1 pr-2 font-medium">Date</th>
              <th className="py-1 pr-2 font-medium">Scope</th>
              <th className="py-1 pr-2 text-right font-medium">Score</th>
              <th className="py-1 pr-2 text-right font-medium">Correct</th>
              <th className="py-1 pr-2 text-right font-medium">Time</th>
              <th className="py-1 pr-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a) => (
              <tr key={a.id} className="border-b border-gray-200">
                <td className="py-2 pr-2">{formatDate(a.finished_at)}</td>
                <td className="py-2 pr-2">{SCOPE_LABELS[a.scope]}</td>
                <td className="py-2 pr-2 text-right font-medium">{formatScore(a.score_percent)}</td>
                <td className="py-2 pr-2 text-right">{a.correct_count}/{a.question_count}</td>
                <td className="py-2 pr-2 text-right">
                  {formatDuration(a.time_used_seconds)}{a.auto_submitted ? " (timed out)" : ""}
                </td>
                <td className="py-2 pr-2">
                  <Link href={`/attempts/${a.id}`} className="text-blue-700 underline">Review</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
