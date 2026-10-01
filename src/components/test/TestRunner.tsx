"use client";

// The LSAC-style test engine. This is the one deliberately client-heavy part of the app.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitAttempt } from "@/app/actions";
import { choiceLetter, formatDuration } from "@/lib/format";

export type RunnerQuestion =
  | { kind: "mc"; id: string; courseSlug: string; unitSlug: string; stem: string; choices: string[] }
  | { kind: "issue"; id: string; courseSlug: string; unitSlug: string; factPattern: string; minutes: number };

/** Multiple-choice answers are a choice index; issue answers are the written text. */
type Answer = number | string | null;

function isAnswered(a: Answer): boolean {
  return typeof a === "number" || (typeof a === "string" && a.trim() !== "");
}

type Props = {
  courseSlug: string;
  unitSlug: string;
  scope: string;
  scopeLabel: string;
  unitTitle: string;
  timeLimitSeconds: number;
  startedAt: string;
  questions: RunnerQuestion[];
};

export default function TestRunner(props: Props) {
  const { questions, timeLimitSeconds } = props;
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => questions.map(() => null));
  const [flags, setFlags] = useState<boolean[]>(() => questions.map(() => false));
  const [remaining, setRemaining] = useState(timeLimitSeconds);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Deadline is fixed when the component mounts; the display ticks against it.
  const deadlineRef = useRef<number>(0);
  const submittedRef = useRef(false);
  // Latest answers/flags for the timer's auto-submit, which runs outside the render cycle.
  const latest = useRef({ answers, flags });
  useEffect(() => {
    latest.current = { answers, flags };
  }, [answers, flags]);

  const submit = useCallback(
    async (auto: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setSubmitting(true);
      setConfirming(false);
      const secondsLeft = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      const result = await submitAttempt({
        courseSlug: props.courseSlug,
        unitSlug: props.unitSlug,
        scope: props.scope,
        startedAt: props.startedAt,
        timeLimitSeconds,
        timeUsedSeconds: auto ? timeLimitSeconds : timeLimitSeconds - secondsLeft,
        autoSubmitted: auto,
        questions: questions.map((q, i) => {
          const a = latest.current.answers[i];
          return {
            id: q.id,
            courseSlug: q.courseSlug,
            unitSlug: q.unitSlug,
            selected: typeof a === "number" ? a : null,
            written: typeof a === "string" ? a : "",
            flagged: latest.current.flags[i],
          };
        }),
      });
      if (result.ok) {
        router.replace(`/attempts/${result.attemptId}`);
      } else {
        submittedRef.current = false;
        setSubmitting(false);
        setError(result.error);
      }
    },
    [props.courseSlug, props.unitSlug, props.scope, props.startedAt, timeLimitSeconds, questions, router],
  );

  useEffect(() => {
    deadlineRef.current = Date.now() + timeLimitSeconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(timer);
        void submit(true);
      }
    };
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [timeLimitSeconds, submit]);

  // Warn before accidentally leaving mid-test (nothing is saved until submit).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!submittedRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const q = questions[index];
  const unansweredCount = answers.filter((a) => !isAnswered(a)).length;
  const mcCount = questions.filter((x) => x.kind === "mc").length;
  const issueCount = questions.length - mcCount;
  const issueNumber = index - mcCount + 1;
  const flaggedCount = flags.filter(Boolean).length;
  const low = remaining <= 60;

  function choose(choice: number) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? (a === choice ? null : choice) : a)));
  }
  function write(text: string) {
    setAnswers((prev) => prev.map((a, i) => (i === index ? text : a)));
  }
  function toggleFlag() {
    setFlags((prev) => prev.map((f, i) => (i === index ? !f : f)));
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_220px]">
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2 text-sm">
          <span className="text-gray-600">
            {props.unitTitle} · {props.scopeLabel}
          </span>
          <span className={`font-mono text-lg font-semibold ${low ? "text-red-700" : ""}`} aria-live="polite">
            {formatDuration(remaining)}
          </span>
        </div>

        {mcCount > 0 && issueCount > 0 && (
          <p className="mb-2 text-xs uppercase tracking-wide text-gray-500">
            {q.kind === "mc" ? `Part 1 · multiple choice (${mcCount})` : `Part 2 · issue spotting (${issueCount})`}
          </p>
        )}
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-lg font-semibold">
            {q.kind === "mc" ? `Question ${index + 1} of ${questions.length}` : `Issue question ${issueNumber} of ${issueCount}`}
            {q.kind === "issue" && <span className="ml-2 text-sm font-normal text-gray-500">suggested {q.minutes} min</span>}
          </h1>
          <button
            type="button"
            onClick={toggleFlag}
            className={`rounded border px-3 py-1 text-sm ${flags[index] ? "border-yellow-500 bg-yellow-100" : "border-gray-300"}`}
          >
            {flags[index] ? "Flagged" : "Flag for review"}
          </button>
        </div>

        {q.kind === "issue" ? (
          <>
            <p className="mb-3 whitespace-pre-line rounded border border-gray-200 bg-gray-50 p-3">{q.factPattern}</p>
            <textarea
              value={typeof answers[index] === "string" ? (answers[index] as string) : ""}
              onChange={(e) => write(e.target.value)}
              rows={16}
              spellCheck={false}
              placeholder="Spot the issues and analyse them. Nothing is checked until you submit and grade yourself."
              className="w-full rounded border border-gray-300 px-3 py-2 font-sans"
            />
          </>
        ) : (
        <>
        <p className="mb-4 whitespace-pre-line">{q.stem}</p>

        <ol className="space-y-2">
          {q.choices.map((choice, ci) => {
            const selected = answers[index] === ci;
            return (
              <li key={ci}>
                <button
                  type="button"
                  onClick={() => choose(ci)}
                  aria-pressed={selected}
                  className={`w-full rounded border px-3 py-2 text-left ${selected ? "border-blue-700 bg-blue-50" : "border-gray-300 hover:bg-gray-50"}`}
                >
                  <span className="mr-2 font-semibold">{choiceLetter(ci)}.</span>
                  {choice}
                </button>
              </li>
            );
          })}
        </ol>
        </>
        )}

        <div className="mt-6 flex items-center gap-2">
          <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40">
            Previous
          </button>
          <button type="button" disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)} className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40">
            Next
          </button>
          <button type="button" onClick={() => setConfirming(true)} disabled={submitting} className="ml-auto rounded bg-blue-700 px-4 py-1 text-white disabled:opacity-40">
            Submit test
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-700">Could not save attempt: {error}</p>}
      </div>

      <aside>
        <h2 className="mb-2 text-sm font-semibold">Navigator</h2>
        <div className="grid grid-cols-5 gap-1">
          {questions.map((_, i) => {
            const answered = isAnswered(answers[i]);
            const flagged = flags[i];
            const current = i === index;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                title={`${questions[i].kind === "issue" ? "Issue question" : "Question"} ${i + 1}: ${answered ? "answered" : "unanswered"}${flagged ? ", flagged" : ""}`}
                className={[
                  "h-8 rounded border text-xs",
                  answered ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-400",
                  flagged ? "ring-2 ring-yellow-400" : "",
                  current ? "outline outline-2 outline-blue-700 outline-offset-1" : "",
                ].join(" ")}
              >
                {questions[i].kind === "issue" ? `I${i - mcCount + 1}` : i + 1}
              </button>
            );
          })}
        </div>
        <ul className="mt-3 space-y-1 text-xs text-gray-600">
          <li><span className="mr-1 inline-block h-3 w-3 rounded border border-gray-800 bg-gray-800 align-middle" /> answered ({questions.length - unansweredCount})</li>
          <li><span className="mr-1 inline-block h-3 w-3 rounded border border-gray-400 bg-white align-middle" /> unanswered ({unansweredCount})</li>
          <li><span className="mr-1 inline-block h-3 w-3 rounded border border-gray-400 bg-white ring-2 ring-yellow-400 align-middle" /> flagged ({flaggedCount})</li>
        </ul>
      </aside>

      {confirming && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded bg-white p-5 shadow">
            <h2 className="mb-2 text-lg font-semibold">Submit test?</h2>
            <p className="mb-1">
              {unansweredCount === 0 ? "All questions answered." : `${unansweredCount} unanswered question${unansweredCount === 1 ? "" : "s"} will be marked wrong (a blank issue answer still goes to grading).`}
            </p>
            {flaggedCount > 0 && <p className="mb-1 text-sm text-gray-600">{flaggedCount} flagged for review.</p>}
            <p className="mb-4 text-sm text-gray-600">Time remaining: {formatDuration(remaining)}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="rounded border border-gray-300 px-3 py-1">
                Keep working
              </button>
              <button type="button" onClick={() => void submit(false)} className="rounded bg-blue-700 px-4 py-1 text-white">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {submitting && <p className="fixed bottom-4 right-4 rounded bg-gray-800 px-3 py-2 text-sm text-white">Saving attempt…</p>}
    </div>
  );
}
