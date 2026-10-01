"use server";

// Server action called by the test runner when a test is submitted (or auto-submitted).
// Grades against the content on disk and stores the attempt in SQLite.

import { redirect } from "next/navigation";
import { findNoteByPath, findQuestion, isScope, loadContent } from "@/lib/content/loader";
import { getAttempt, gradeIssues, insertAttempt, type IssueResult, type IssueResultEntry, type NewAttemptQuestion } from "@/lib/attempts";
import { cardFromNote } from "@/lib/cards";
import { rateCard } from "@/lib/reviews";
import { isRating } from "@/lib/sm2";

export type SubmitInput = {
  courseSlug: string;
  unitSlug: string;
  scope: string;
  startedAt: string;
  timeLimitSeconds: number;
  timeUsedSeconds: number;
  autoSubmitted: boolean;
  questions: { id: string; courseSlug: string; unitSlug: string; selected: number | null; written: string; flagged: boolean }[];
};

export type SubmitResult = { ok: true; attemptId: number } | { ok: false; error: string };

export async function submitAttempt(input: SubmitInput): Promise<SubmitResult> {
  if (!isScope(input.scope)) return { ok: false, error: "invalid scope" };
  if (!Array.isArray(input.questions) || input.questions.length === 0) return { ok: false, error: "no questions" };
  const tree = loadContent();
  const graded: NewAttemptQuestion[] = [];
  for (const q of input.questions) {
    const source = findQuestion(tree, q.courseSlug, q.unitSlug, q.id);
    if (!source) return { ok: false, error: `question ${q.id} no longer exists in content; attempt not saved` };
    if (source.type === "issue") {
      graded.push({
        type: "issue",
        courseSlug: q.courseSlug,
        unitSlug: q.unitSlug,
        questionId: q.id,
        written: String(q.written ?? "").replace(/\r\n?/g, "\n"),
        issueCount: source.issues.length,
        flagged: Boolean(q.flagged),
        tags: source.tags,
      });
      continue;
    }
    const selected = Number.isInteger(q.selected) && (q.selected as number) >= 0 && (q.selected as number) < source.choices.length ? (q.selected as number) : null;
    graded.push({
      type: "mc",
      courseSlug: q.courseSlug,
      unitSlug: q.unitSlug,
      questionId: q.id,
      selected,
      correctAnswer: source.answer,
      flagged: Boolean(q.flagged),
      tags: source.tags,
    });
  }
  const limit = Math.max(0, Math.floor(input.timeLimitSeconds));
  const attemptId = insertAttempt({
    courseSlug: input.courseSlug,
    unitSlug: input.unitSlug,
    scope: input.scope,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
    timeLimitSeconds: limit,
    timeUsedSeconds: Math.min(limit, Math.max(0, Math.floor(input.timeUsedSeconds))),
    autoSubmitted: Boolean(input.autoSubmitted),
    questions: graded,
  });
  return { ok: true, attemptId };
}

// Flashcard rating from the review page's plain form. Redirects back to the queue.
export async function rateCardAction(formData: FormData): Promise<void> {
  const cardKey = String(formData.get("cardKey") ?? "");
  const rating = Number(formData.get("rating"));
  const course = String(formData.get("course") ?? "");
  if (!isRating(rating)) throw new Error("rating must be 1-4");
  const found = findNoteByPath(loadContent(), cardKey);
  if (!found) throw new Error(`card ${cardKey} no longer exists in content`);
  const card = cardFromNote(found.course, found.unit, found.note);
  if (!card) throw new Error(`note ${cardKey} is not a flashcard type`);
  rateCard(card, rating);
  redirect(course ? `/review?course=${encodeURIComponent(course)}` : "/review");
}

// Self-grading of issue questions from the results page. Form fields are named r-<position>-<issueIndex>.
export async function gradeIssuesAction(formData: FormData): Promise<void> {
  const attemptId = Number(formData.get("attemptId"));
  const data = getAttempt(attemptId);
  if (!data) throw new Error("attempt not found");
  const tree = loadContent();
  const grades = new Map<number, IssueResultEntry[]>();
  const missing: string[] = [];
  for (const row of data.questions) {
    if (row.question_type !== "issue") continue;
    const source = findQuestion(tree, row.course_slug, row.unit_slug, row.question_id);
    if (!source || source.type !== "issue") continue; // removed from content; cannot be graded
    const entries: IssueResultEntry[] = [];
    source.issues.forEach((issue, i) => {
      const v = formData.get(`r-${row.position}-${i}`);
      if (v !== "spotted" && v !== "missed" && v !== "wrong-rule") {
        missing.push(`question ${row.position + 1}, issue ${i + 1}`);
        return;
      }
      entries.push({ name: issue.name, ruleNotePath: issue.ruleNotePath, result: v as IssueResult });
    });
    grades.set(row.position, entries);
  }
  if (missing.length) redirect(`/attempts/${attemptId}?grade=incomplete#grading`);
  gradeIssues(attemptId, grades);
  redirect(`/attempts/${attemptId}?grade=saved`);
}
