import Link from "next/link";
import { notFound } from "next/navigation";
import TestRunner from "@/components/test/TestRunner";
import { toInt, toRunnerQuestions } from "@/lib/testing";
import { DEFAULT_SECONDS_PER_QUESTION, findUnit, isPoolScope, loadContent, questionsForScope, SCOPE_LABELS } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export default async function TestRunPage({ params, searchParams }: PageProps<"/courses/[course]/units/[unit]/test/run">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const sp = await searchParams;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const base = `/courses/${course.slug}/units/${unit.slug}`;

  const scope = isPoolScope(sp.scope) ? sp.scope : "unit";
  const pool = questionsForScope(course, unit, scope);
  if (pool.length === 0) {
    return (
      <p>
        No questions in scope &ldquo;{SCOPE_LABELS[scope]}&rdquo;. <Link href={`${base}/test`} className="underline">Back to setup</Link>
      </p>
    );
  }
  const count = Math.min(pool.length, Math.max(1, toInt(sp.count, pool.length)));
  const secondsPerQuestion = Math.min(3600, Math.max(5, toInt(sp.seconds, DEFAULT_SECONDS_PER_QUESTION)));
  const timeLimitSeconds = count * secondsPerQuestion;

  // Answers and explanations stay on the server; the client only gets what it needs to show the question.
  const questions = toRunnerQuestions(pool, count);

  return (
    <TestRunner
      courseSlug={course.slug}
      unitSlug={unit.slug}
      scope={scope}
      scopeLabel={SCOPE_LABELS[scope]}
      unitTitle={unit.title}
      timeLimitSeconds={timeLimitSeconds}
      startedAt={new Date().toISOString()}
      questions={questions}
    />
  );
}
