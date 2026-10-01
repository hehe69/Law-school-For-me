import Link from "next/link";
import { notFound } from "next/navigation";
import { findCourse, loadContent, SCOPE_LABELS } from "@/lib/content/loader";
import { listAttemptsForCourseScope, questionsWithTags, tagStats, weakestTags, WEAKEST_COUNT } from "@/lib/weakTags";
import { formatDate, formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WeakTagsPage({ params }: PageProps<"/courses/[course]/weak-tags">) {
  const { course: courseSlug } = await params;
  const course = findCourse(loadContent(), courseSlug);
  if (!course) notFound();
  const stats = tagStats(course);
  const weakest = weakestTags(stats);
  const pool = questionsWithTags(course, weakest);
  const recent = listAttemptsForCourseScope(course.slug, "tags");
  const runHref = `/courses/${course.slug}/test/run?scope=tags&tags=${encodeURIComponent(weakest.join(","))}`;

  return (
    <div>
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / {course.title}
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Weak tags</h1>
      <p className="mb-4 text-sm text-gray-600">
        Miss rate per tag across every attempt in this course. Unanswered counts as missed. Tags are read from the snapshot stored with each attempt.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-gray-50 p-4">
        {weakest.length > 0 ? (
          <>
            <span>
              Weakest {weakest.length}: {weakest.map((t) => <span key={t} className="mr-1 rounded bg-red-100 px-2 py-0.5 text-sm">{t}</span>)}
            </span>
            <Link href={runHref} className="rounded bg-blue-700 px-4 py-2 text-white">
              Test weakest tags ({pool.length} question{pool.length === 1 ? "" : "s"})
            </Link>
          </>
        ) : (
          <span className="text-sm text-gray-600">No attempts with tagged questions yet. Take a test first.</span>
        )}
      </div>

      {stats.length > 0 && (
        <table className="mb-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-gray-600">
              <th className="py-1 pr-2 font-medium">Tag</th>
              <th className="py-1 pr-2 text-right font-medium">Seen</th>
              <th className="py-1 pr-2 text-right font-medium">Missed</th>
              <th className="py-1 pr-2 text-right font-medium">Miss rate</th>
              <th className="py-1 pr-2 text-right font-medium">In content</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={s.tag} className={`border-b border-gray-200 ${i < WEAKEST_COUNT && weakest.includes(s.tag) ? "bg-red-50" : ""}`}>
                <td className="py-1 pr-2">{s.tag}</td>
                <td className="py-1 pr-2 text-right">{s.seen}</td>
                <td className="py-1 pr-2 text-right">{s.missed}</td>
                <td className="py-1 pr-2 text-right font-medium">{Math.round(s.missRate * 100)}%</td>
                <td className="py-1 pr-2 text-right">{s.inContent}{s.inContent === 0 && <span className="ml-1 text-xs text-gray-500">(tag no longer used)</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Recent weak-tag tests</h2>
          <ul className="space-y-1 text-sm">
            {recent.map((a) => (
              <li key={a.id}>
                {formatDate(a.finished_at)} · {SCOPE_LABELS[a.scope]} · {formatScore(a.score_percent)} ({a.correct_count}/{a.question_count}) ·{" "}
                <Link href={`/attempts/${a.id}`} className="text-blue-700 underline">Review</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
