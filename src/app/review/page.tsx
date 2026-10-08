import Link from "next/link";
import { getDb } from "@/lib/db";
import { listCourses, getCourseBySlug } from "@/lib/courses";
import { cardFaces, dueCards, reviewSummary } from "@/lib/cards";
import { ReviewSession } from "@/components/views/ReviewSession";

/** Daily review of every flashcard due today, across courses or for one course (?course=slug). */
export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ course?: string | string[] }> }) {
  const { course: courseSlug } = await searchParams;
  const db = getDb();
  const course = typeof courseSlug === "string" ? getCourseBySlug(db, courseSlug) : null;
  const courses = listCourses(db);
  const summary = reviewSummary(db, course?.id);
  const due = dueCards(db, course?.id);
  const items = due.map((c) => {
    const faces = cardFaces(c.node);
    return { nodeId: c.node.id, front: faces.front, back: faces.back, courseTitle: c.courseTitle, courseSlug: c.courseSlug, outlineId: c.node.outlineId, outlineName: c.outlineName, isNew: c.state === null };
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Daily review{course ? ` · ${course.title}` : ""}</h1>
        <nav className="flex flex-wrap gap-2 text-sm">
          <Link href="/review" className={`btn ${course ? "" : "border-gray-900"}`}>
            All courses
          </Link>
          {courses.map((c) => (
            <Link key={c.id} href={`/review?course=${c.slug}`} className={`btn ${course?.id === c.id ? "border-gray-900" : ""}`}>
              {c.title}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        {summary.due} due ({summary.newCards} new) of {summary.total} card{summary.total === 1 ? "" : "s"} · {summary.reviewedToday} reviewed today. Flashcards are off by default: turn them on per rule or element node in the editor panel. Scheduling is SM-2, as in the study app.
      </p>
      <div className="mt-6">
        <ReviewSession items={items} />
      </div>
    </div>
  );
}
