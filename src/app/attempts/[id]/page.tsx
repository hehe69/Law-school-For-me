import Link from "next/link";
import { notFound } from "next/navigation";
import { getAttempt } from "@/lib/attempts";
import { findQuestion, loadContent, SCOPE_LABELS } from "@/lib/content/loader";
import { missedInAttempt } from "@/lib/weakTags";
import { choiceLetter, formatDate, formatDuration, formatScore } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AttemptPage({ params, searchParams }: PageProps<"/attempts/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const wrongOnly = sp.filter === "wrong";
  const data = getAttempt(Number(id));
  if (!data) notFound();
  const { attempt, questions } = data;
  const tree = loadContent();
  const course = tree.courses.find((c) => c.slug === attempt.course_slug);
  const unit = course?.units.find((u) => u.slug === attempt.unit_slug);
  // Weak-tag tests belong to the course, not a unit; their links go to the weak-tags page instead.
  const base = unit ? `/courses/${attempt.course_slug}/units/${attempt.unit_slug}` : `/courses/${attempt.course_slug}/weak-tags`;
  const parentTitle = unit?.title ?? (attempt.unit_slug || (course?.title ?? attempt.course_slug));
  const missedIds = missedInAttempt(attempt.id);
  const retryHref = `/courses/${attempt.course_slug}/test/run?scope=retry${unit ? `&unit=${unit.slug}` : ""}&ids=${encodeURIComponent(missedIds.join(","))}`;

  const shown = wrongOnly ? questions.filter((q) => !q.is_correct) : questions;
  const wrongCount = questions.filter((q) => !q.is_correct).length;

  return (
    <div>
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / <Link href={base} className="underline">{parentTitle}</Link>
        {unit && (
          <>
            {" / "}
            <Link href={`${base}/history`} className="underline">History</Link>
          </>
        )}
      </p>
      <h1 className="mb-4 text-2xl font-semibold">Results</h1>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-4">
        <dt className="text-gray-600">Score</dt>
        <dd className="text-lg font-semibold">
          {formatScore(attempt.score_percent)} <span className="text-sm font-normal text-gray-600">({attempt.correct_count}/{attempt.question_count})</span>
        </dd>
        <dt className="text-gray-600">Time used</dt>
        <dd>
          {formatDuration(attempt.time_used_seconds)} of {formatDuration(attempt.time_limit_seconds)}
          {attempt.auto_submitted ? <span className="ml-1 text-red-700">(time ran out)</span> : null}
        </dd>
        <dt className="text-gray-600">Scope</dt>
        <dd>{SCOPE_LABELS[attempt.scope]}</dd>
        <dt className="text-gray-600">Taken</dt>
        <dd>{formatDate(attempt.finished_at)}</dd>
      </dl>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">Show:</span>
        <Link href={`/attempts/${attempt.id}`} className={wrongOnly ? "underline" : "font-semibold"}>
          All ({questions.length})
        </Link>
        <Link href={`/attempts/${attempt.id}?filter=wrong`} className={wrongOnly ? "font-semibold" : "underline"}>
          Wrong only ({wrongCount})
        </Link>
        {missedIds.length > 0 && (
          <Link href={retryHref} className="ml-auto rounded border border-red-300 px-3 py-1 text-red-800">
            Retry wrong ({missedIds.length})
          </Link>
        )}
        <Link href={unit ? `${base}/test` : base} className={`rounded border border-gray-300 px-3 py-1 ${missedIds.length > 0 ? "" : "ml-auto"}`}>
          {unit ? "Take another test" : "Back to weak tags"}
        </Link>
      </div>

      {shown.length === 0 && <p className="text-gray-600">Nothing to show.</p>}

      <ol className="space-y-4">
        {shown.map((row) => {
          const q = findQuestion(tree, row.course_slug, row.unit_slug, row.question_id);
          const tags: string[] = JSON.parse(row.tags);
          return (
            <li key={row.position} className={`rounded border p-4 ${row.is_correct ? "border-green-300" : "border-red-300"}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">Question {row.position + 1}</span>
                <span className={row.is_correct ? "text-green-700" : "text-red-700"}>
                  {row.is_correct ? "Correct" : row.selected === null ? "Unanswered" : "Wrong"}
                </span>
                {row.flagged ? <span className="rounded bg-yellow-100 px-2 text-xs">flagged</span> : null}
                <span className="ml-auto text-xs text-gray-500">
                  {row.unit_slug} · {row.question_id}
                </span>
              </div>
              {q ? (
                <>
                  <p className="mb-3 whitespace-pre-line">{q.stem}</p>
                  <ol className="mb-3 space-y-1">
                    {q.choices.map((choice, ci) => {
                      const isCorrect = ci === row.correct_answer;
                      const isMine = ci === row.selected;
                      return (
                        <li
                          key={ci}
                          className={`rounded px-2 py-1 ${isCorrect ? "bg-green-50 font-medium" : isMine ? "bg-red-50" : ""}`}
                        >
                          <span className="mr-2 font-semibold">{choiceLetter(ci)}.</span>
                          {choice}
                          {isCorrect && <span className="ml-2 text-xs text-green-700">correct answer</span>}
                          {isMine && !isCorrect && <span className="ml-2 text-xs text-red-700">your answer</span>}
                          {isMine && isCorrect && <span className="ml-2 text-xs text-green-700">(your answer)</span>}
                        </li>
                      );
                    })}
                  </ol>
                  <p className="mb-2 text-sm">
                    <span className="font-semibold">Explanation:</span> {q.explanation}
                  </p>
                </>
              ) : (
                <p className="mb-2 text-sm text-gray-600">
                  This question is no longer in content (id {row.question_id}). You answered {row.selected === null ? "nothing" : choiceLetter(row.selected)}; correct was {choiceLetter(row.correct_answer)}.
                </p>
              )}
              {tags.length > 0 && (
                <p className="text-xs text-gray-600">
                  Tags: {tags.map((t) => (
                    <span key={t} className="mr-1 rounded bg-gray-100 px-2 py-0.5">{t}</span>
                  ))}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
