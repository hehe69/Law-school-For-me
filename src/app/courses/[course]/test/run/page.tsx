// Course-level test runs that are built from question ids rather than units:
//   scope=tags&tags=a,b,c            questions carrying any of those tags
//   scope=retry&ids=q1,q2&unit=slug  specific questions, attributed to a unit's history when given
import Link from "next/link";
import { notFound } from "next/navigation";
import TestRunner from "@/components/test/TestRunner";
import { courseQuestions, DEFAULT_SECONDS_PER_QUESTION, findCourse, loadContent, SCOPE_LABELS, type Scope } from "@/lib/content/loader";
import { listParam, toInt, toRunnerQuestions } from "@/lib/testing";
import { questionsWithTags } from "@/lib/weakTags";

export const dynamic = "force-dynamic";

export default async function CourseTestRunPage({ params, searchParams }: PageProps<"/courses/[course]/test/run">) {
  const { course: courseSlug } = await params;
  const sp = await searchParams;
  const course = findCourse(loadContent(), courseSlug);
  if (!course) notFound();

  const scope: Scope = sp.scope === "retry" ? "retry" : "tags";
  const unitSlug = typeof sp.unit === "string" && course.units.some((u) => u.slug === sp.unit) ? sp.unit : "";
  const unit = course.units.find((u) => u.slug === unitSlug);

  let pool;
  if (scope === "tags") {
    pool = questionsWithTags(course, listParam(sp.tags));
  } else {
    const wanted = new Set(listParam(sp.ids));
    pool = courseQuestions(course).filter((q) => wanted.has(q.id));
  }

  if (pool.length === 0) {
    const back = unit ? `/courses/${course.slug}/units/${unit.slug}` : `/courses/${course.slug}/weak-tags`;
    return (
      <p>
        No questions match this {SCOPE_LABELS[scope].toLowerCase()} test (they may have been removed from content).{" "}
        <Link href={back} className="underline">Go back</Link>
      </p>
    );
  }

  const count = Math.min(pool.length, Math.max(1, toInt(sp.count, pool.length)));
  const secondsPerQuestion = Math.min(3600, Math.max(5, toInt(sp.seconds, DEFAULT_SECONDS_PER_QUESTION)));

  return (
    <TestRunner
      courseSlug={course.slug}
      unitSlug={unitSlug}
      scope={scope}
      scopeLabel={SCOPE_LABELS[scope]}
      unitTitle={unit ? unit.title : course.title}
      timeLimitSeconds={count * secondsPerQuestion}
      startedAt={new Date().toISOString()}
      questions={toRunnerQuestions(pool, count)}
    />
  );
}
