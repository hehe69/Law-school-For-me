import Link from "next/link";
import { notFound } from "next/navigation";
import { gradeIssuesAction } from "@/app/actions";
import { getAttempt, type AttemptQuestionRow, type IssueResult, type IssueResultEntry } from "@/lib/attempts";
import { fileUrl, findQuestion, findRuleNote, loadContent, SCOPE_LABELS } from "@/lib/content/loader";
import type { Course, IssueQuestion, McQuestion } from "@/lib/content/types";
import { choiceLetter, formatDate, formatDuration, formatScore } from "@/lib/format";
import { missedInAttempt } from "@/lib/weakTags";
import DiagnosticReportView from "@/components/DiagnosticReportView";
import type { DiagnosticReport } from "@/lib/diagnostic";

export const dynamic = "force-dynamic";

const RESULT_LABELS: Record<IssueResult, string> = { spotted: "Spotted", missed: "Missed", "wrong-rule": "Spotted, wrong rule" };

function Tags({ row }: { row: AttemptQuestionRow }) {
  const tags: string[] = JSON.parse(row.tags);
  if (tags.length === 0) return null;
  return (
    <p className="text-xs text-gray-600">
      Tags: {tags.map((t) => <span key={t} className="mr-1 rounded bg-gray-100 px-2 py-0.5">{t}</span>)}
    </p>
  );
}

function McReview({ row, q }: { row: AttemptQuestionRow; q: McQuestion | undefined }) {
  return (
    <>
      {q ? (
        <>
          {q.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fileUrl(q.courseSlug, q.unitSlug, q.image)} alt="" className="mb-3 max-h-96 max-w-full rounded border border-gray-200" />
          )}
          <p className="mb-3 whitespace-pre-line">{q.stem}</p>
          <ol className="mb-3 space-y-1">
            {q.choices.map((choice, ci) => {
              const isCorrect = ci === row.correct_answer;
              const isMine = ci === row.selected;
              return (
                <li key={ci} className={`rounded px-2 py-1 ${isCorrect ? "bg-green-50 font-medium" : isMine ? "bg-red-50" : ""}`}>
                  <span className="mr-2 font-semibold">{choiceLetter(ci)}.</span>
                  {choice}
                  {isCorrect && <span className="ml-2 text-xs text-green-700">correct answer</span>}
                  {isMine && !isCorrect && <span className="ml-2 text-xs text-red-700">your answer</span>}
                  {isMine && isCorrect && <span className="ml-2 text-xs text-green-700">(your answer)</span>}
                </li>
              );
            })}
          </ol>
          <p className="mb-2 text-sm"><span className="font-semibold">Explanation:</span> {q.explanation}</p>
        </>
      ) : (
        <p className="mb-2 text-sm text-gray-600">
          This question is no longer in content (id {row.question_id}). You answered {row.selected === null ? "nothing" : choiceLetter(row.selected)}; correct was {choiceLetter(row.correct_answer)}.
        </p>
      )}
      <Tags row={row} />
    </>
  );
}

function IssueReview({ row, q, course }: { row: AttemptQuestionRow; q: IssueQuestion | undefined; course: Course | undefined }) {
  const graded: IssueResultEntry[] | null = row.issue_results ? JSON.parse(row.issue_results) : null;
  if (!q) {
    return (
      <>
        <p className="mb-2 text-sm text-gray-600">This issue question is no longer in content (id {row.question_id}), so it cannot be graded.</p>
        <p className="whitespace-pre-line rounded border border-gray-200 p-3 text-sm">{row.written_answer || "(blank)"}</p>
      </>
    );
  }
  return (
    <>
      <details className="mb-3 text-sm">
        <summary className="cursor-pointer text-gray-600">Fact pattern</summary>
        {q.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(q.courseSlug, q.unitSlug, q.image)} alt="" className="mt-2 max-h-96 max-w-full rounded border border-gray-200" />
        )}
        <p className="mt-2 whitespace-pre-line rounded border border-gray-200 bg-gray-50 p-3">{q.factPattern}</p>
      </details>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Your answer</h4>
          <p className="min-h-24 whitespace-pre-line rounded border border-gray-200 p-3 text-sm">{row.written_answer?.trim() ? row.written_answer : <span className="text-gray-400">(blank)</span>}</p>
        </div>
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Issues ({q.issues.length})</h4>
          <ol className="space-y-3">
            {q.issues.map((issue, i) => {
              const ref = course ? findRuleNote(course, issue.ruleNotePath) : undefined;
              const rule = ref?.note.frontmatter.type === "rule" ? ref.note.frontmatter : undefined;
              const current = graded?.[i]?.result;
              return (
                <li key={i} className={`rounded border p-3 text-sm ${current === "spotted" ? "border-green-300" : current ? "border-red-300" : "border-gray-200"}`}>
                  <p className="font-semibold">{i + 1}. {issue.name}</p>
                  <p className="mt-1">
                    <span className="font-semibold text-gray-600">Rule:</span>{" "}
                    {rule ? (
                      <>
                        {rule.ruleStatement || <span className="text-gray-400">(draft rule note, no statement yet)</span>}{" "}
                        <Link href={`/courses/${course!.slug}/units/${ref!.unit.slug}#note-${ref!.note.slug}`} className="text-blue-700 underline">{rule.name || ref!.note.slug}</Link>
                      </>
                    ) : (
                      <span className="text-red-700">rule note {issue.ruleNote} not found in content</span>
                    )}
                  </p>
                  <p className="mt-1"><span className="font-semibold text-gray-600">Model analysis:</span> {issue.modelAnalysis}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {(["spotted", "missed", "wrong-rule"] as IssueResult[]).map((r) => (
                      <label key={r} className="text-xs">
                        <input type="radio" name={`r-${row.position}-${i}`} value={r} defaultChecked={current === r} className="mr-1" />
                        {RESULT_LABELS[r]}
                      </label>
                    ))}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-600">
        {graded ? `Graded ${formatDate(row.graded_at)}: ${row.spotted_count}/${row.issue_count} spotted.` : "Not graded yet."}
      </p>
      <Tags row={row} />
    </>
  );
}

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
  const isDiagnostic = attempt.scope === "diagnostic";
  const base = unit ? `/courses/${attempt.course_slug}/units/${attempt.unit_slug}` : isDiagnostic ? `/courses/${attempt.course_slug}` : `/courses/${attempt.course_slug}/weak-tags`;
  const report: DiagnosticReport | null = isDiagnostic && attempt.diagnostic_report ? JSON.parse(attempt.diagnostic_report) : null;
  const parentTitle = unit?.title ?? (attempt.unit_slug || (course?.title ?? attempt.course_slug));
  const missedIds = missedInAttempt(attempt.id);
  const retryHref = `/courses/${attempt.course_slug}/test/run?scope=retry${unit ? `&unit=${unit.slug}` : ""}&ids=${encodeURIComponent(missedIds.join(","))}`;

  const mcRows = questions.filter((q) => q.question_type === "mc");
  const issueRows = questions.filter((q) => q.question_type === "issue");
  const ungraded = issueRows.filter((r) => !r.graded_at).length;
  const issuesTotal = issueRows.reduce((n, r) => n + (r.issue_count ?? 0), 0);
  const spotted = issueRows.reduce((n, r) => n + (r.spotted_count ?? 0), 0);
  const mcCorrect = mcRows.filter((r) => r.is_correct).length;

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
      <h1 className="mb-4 text-2xl font-semibold">{isDiagnostic ? "Diagnostic results" : "Results"}</h1>

      {sp.grade === "saved" && <p className="mb-4 rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">Grading saved.</p>}
      {sp.grade === "incomplete" && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">Pick spotted, missed, or wrong rule for every issue, then save again.</p>}

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-1 rounded border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-4">
        <dt className="text-gray-600">Score</dt>
        <dd className="text-lg font-semibold">
          {formatScore(attempt.score_percent)} <span className="text-sm font-normal text-gray-600">({attempt.points_earned}/{attempt.points_possible} points)</span>
          {ungraded > 0 && <span className="block text-xs font-normal text-yellow-900">{ungraded} issue question{ungraded === 1 ? "" : "s"} not graded yet</span>}
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
        {mcRows.length > 0 && issueRows.length > 0 && (
          <>
            <dt className="text-gray-600">Multiple choice</dt>
            <dd>{mcCorrect}/{mcRows.length} correct</dd>
            <dt className="text-gray-600">Issue spotting</dt>
            <dd>{ungraded > 0 ? `${issueRows.length} question${issueRows.length === 1 ? "" : "s"}, ${issuesTotal} issues, ungraded` : `${spotted}/${issuesTotal} issues spotted`}</dd>
          </>
        )}
        {mcRows.length === 0 && issueRows.length > 0 && (
          <>
            <dt className="text-gray-600">Issues spotted</dt>
            <dd>{ungraded > 0 ? "grade below" : `${spotted} of ${issuesTotal}`}</dd>
          </>
        )}
      </dl>

      {report && <DiagnosticReportView report={report} courseSlug={attempt.course_slug} />}

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">Show:</span>
        <Link href={`/attempts/${attempt.id}`} className={wrongOnly ? "underline" : "font-semibold"}>All ({questions.length})</Link>
        <Link href={`/attempts/${attempt.id}?filter=wrong`} className={wrongOnly ? "font-semibold" : "underline"}>Wrong only ({wrongCount})</Link>
        {missedIds.length > 0 && (
          <Link href={retryHref} className="ml-auto rounded border border-red-300 px-3 py-1 text-red-800">Retry wrong ({missedIds.length})</Link>
        )}
        <Link href={unit ? `${base}/test` : base} className={`rounded border border-gray-300 px-3 py-1 ${missedIds.length > 0 ? "" : "ml-auto"}`}>
          {unit ? "Take another test" : isDiagnostic ? "Back to course" : "Back to weak tags"}
        </Link>
      </div>

      {shown.length === 0 && <p className="text-gray-600">Nothing to show.</p>}

      <form action={gradeIssuesAction} id="grading">
        <input type="hidden" name="attemptId" value={attempt.id} />
        <ol className="space-y-4">
          {shown.map((row) => {
            const q = findQuestion(tree, row.course_slug, row.unit_slug, row.question_id);
            const isIssue = row.question_type === "issue";
            const status = isIssue && !row.graded_at ? "Ungraded" : row.is_correct ? "Correct" : isIssue ? "Missed issues" : row.selected === null ? "Unanswered" : "Wrong";
            const border = isIssue && !row.graded_at ? "border-yellow-300" : row.is_correct ? "border-green-300" : "border-red-300";
            return (
              <li key={row.position} className={`rounded border p-4 ${border}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{isIssue ? "Issue question" : "Question"} {row.position + 1}</span>
                  <span className={status === "Correct" ? "text-green-700" : status === "Ungraded" ? "text-yellow-900" : "text-red-700"}>{status}</span>
                  {row.flagged ? <span className="rounded bg-yellow-100 px-2 text-xs">flagged</span> : null}
                  <span className="ml-auto text-xs text-gray-500">{row.unit_slug} · {row.question_id}</span>
                </div>
                {isIssue ? (
                  <IssueReview row={row} q={q?.type === "issue" ? q : undefined} course={course} />
                ) : (
                  <McReview row={row} q={q?.type === "mc" ? q : undefined} />
                )}
              </li>
            );
          })}
        </ol>
        {issueRows.length > 0 && shown.some((r) => r.question_type === "issue") && (
          <div className="sticky bottom-0 mt-4 flex items-center gap-3 border-t border-gray-200 bg-white py-3">
            <button type="submit" className="rounded bg-blue-700 px-4 py-2 text-white">{ungraded > 0 ? "Save grading" : "Update grading"}</button>
            <span className="text-sm text-gray-600">Pick spotted, missed, or wrong rule for every issue above. Score = issues spotted.</span>
          </div>
        )}
      </form>
    </div>
  );
}
