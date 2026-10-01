"use server";

// Server action called by the test runner when a test is submitted (or auto-submitted).
// Grades against the content on disk and stores the attempt in SQLite.

import { redirect } from "next/navigation";
import { findNoteByPath, findQuestion, isScope, loadContent } from "@/lib/content/loader";
import { insertAttempt } from "@/lib/attempts";
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
  questions: { id: string; courseSlug: string; unitSlug: string; selected: number | null; flagged: boolean }[];
};

export type SubmitResult = { ok: true; attemptId: number } | { ok: false; error: string };

export async function submitAttempt(input: SubmitInput): Promise<SubmitResult> {
  if (!isScope(input.scope)) return { ok: false, error: "invalid scope" };
  if (!Array.isArray(input.questions) || input.questions.length === 0) return { ok: false, error: "no questions" };
  const tree = loadContent();
  const graded = [];
  for (const q of input.questions) {
    const source = findQuestion(tree, q.courseSlug, q.unitSlug, q.id);
    if (!source) return { ok: false, error: `question ${q.id} no longer exists in content; attempt not saved` };
    const selected = Number.isInteger(q.selected) && (q.selected as number) >= 0 && (q.selected as number) < source.choices.length ? (q.selected as number) : null;
    graded.push({
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
