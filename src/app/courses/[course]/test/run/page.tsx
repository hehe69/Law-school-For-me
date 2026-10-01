// Course-level test runs that are built from question ids rather than units:
//   scope=tags&tags=a,b,c            questions carrying any of those tags
//   scope=retry&ids=q1,q2&unit=slug  specific questions, attributed to a unit's history when given
//   scope=diagnostic&count=N         an even sample across every unit (lib/diagnostic.ts)
import Link from "next/link";
import { notFound } from "next/navigation";
import TestRunner from "@/components/test/TestRunner";
import { courseQuestions, DEFAULT_SECONDS_PER_QUESTION, findCourse, loadContent, SCOPE_LABELS, type Scope } from "@/lib/content/loader";
import { countByType, listParam, pickQuestions, timeLimitFor, toInt, toRunnerQuestions } from "@/lib/testing";
import { questionsWithTags } from "@/lib/weakTags";
import { buildDiagnostic, minimumCount } from "@/lib/diagnostic";
import { seenQuestionIds } from "@/lib/attempts";

export const dynamic = "force-dynamic";

export default async function CourseTestRunPage({ params, searchParams }: PageProps<"/courses/[course]/test/run">) {
  const { course: courseSlug } = await params;
  const sp = await searchParams;
  const course = findCourse(loadContent(), courseSlug);
  if (!course) notFound();

  const scope: Scope = sp.scope === "retry" ? "retry" : sp.scope === "diagnostic" ? "diagnostic" : "tags";
  const unitSlug = typeof sp.unit === "string" && course.units.some((u) => u.slug === sp.unit) ? sp.unit : "";
  const unit = course.units.find((u) => u.slug === unitSlug);

  let pool;
  if (scope === "tags") {
    pool = questionsWithTags(course, listParam(sp.tags));
  } else if (scope === "diagnostic") {
    pool = buildDiagnostic(course, Math.max(minimumCount(course), toInt(sp.count, minimumCount(course))), seenQuestionIds(course.slug));
  } else {
    const wanted = new Set(listParam(sp.ids));
    pool = courseQuestions(course).filter((q) => wanted.has(q.id));
  }

  if (pool.length === 0) {
    const back = unit ? `/courses/${course.slug}/units/${unit.slug}` : scope === "diagnostic" ? `/courses/${course.slug}/diagnostic` : `/courses/${course.slug}/weak-tags`;
    return (
      <p>
        No questions match this {SCOPE_LABELS[scope].toLowerCase()} test (they may have been removed from content).{" "}
        <Link href={back} className="underline">Go back</Link>
      </p>
    );
  }

  const available = countByType(pool);
  const count = scope === "diagnostic" ? available.mc : Math.min(available.mc, Math.max(0, toInt(sp.count, available.mc)));
  const issues = scope === "diagnostic" ? available.issue : Math.min(available.issue, Math.max(0, toInt(sp.issues, available.issue)));
  const secondsPerQuestion = Math.min(3600, Math.max(5, toInt(sp.seconds, DEFAULT_SECONDS_PER_QUESTION)));
  const picked = pickQuestions(pool, count, issues);

  return (
    <TestRunner
      courseSlug={course.slug}
      unitSlug={unitSlug}
      scope={scope}
      scopeLabel={SCOPE_LABELS[scope]}
      unitTitle={unit ? unit.title : course.title}
      timeLimitSeconds={timeLimitFor(picked, secondsPerQuestion)}
      startedAt={new Date().toISOString()}
      questions={toRunnerQuestions(picked)}
    />
  );
}
