import Link from "next/link";
import ReviewCard from "@/components/cards/ReviewCard";
import { rateCardAction } from "@/app/actions";
import { loadContent } from "@/lib/content/loader";
import { dueQueue, reviewsToday } from "@/lib/reviews";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const sp = await searchParams;
  const courseFilter = typeof sp.course === "string" ? sp.course : "";
  const tree = loadContent();
  const course = courseFilter ? tree.courses.find((c) => c.slug === courseFilter) : undefined;
  const queue = dueQueue(tree, course?.slug);
  const done = reviewsToday();
  const current = queue[0];

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">Review</h1>
      <p className="mb-4 text-sm text-gray-600">
        {course ? course.title : "All courses"} · {queue.length} due · {done} reviewed today
        {course && (
          <>
            {" · "}
            <Link href="/review" className="underline">all courses</Link>
          </>
        )}
      </p>

      {courseFilter && !course && <p className="text-red-700">No course with slug &ldquo;{courseFilter}&rdquo;.</p>}

      {current ? (
        <ReviewCard key={current.card.key} card={current.card} courseFilter={course?.slug ?? ""} action={rateCardAction} />
      ) : (
        <p className="rounded border border-gray-200 bg-gray-50 p-4">
          Nothing due. Cards come from rule and case notes; new notes show up here automatically.{" "}
          <Link href="/" className="underline">Back to courses</Link>.
        </p>
      )}

      {current?.state && (
        <p className="mt-3 text-xs text-gray-500">
          Seen {current.state.repetitions} time{current.state.repetitions === 1 ? "" : "s"} in a row · interval {current.state.interval_days}d · ease {current.state.ease.toFixed(2)}
        </p>
      )}
    </div>
  );
}
