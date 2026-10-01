// Small helpers shared by the test-run pages.

import type { RunnerQuestion } from "@/components/test/TestRunner";
import type { Question } from "./content/types";

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function toInt(v: string | string[] | undefined, fallback: number): number {
  const n = parseInt(Array.isArray(v) ? v[0] : (v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

/** Multiple choice first (shuffled, up to mcCount), then issue questions (shuffled, up to issueCount), as a real exam runs them. */
export function pickQuestions(pool: Question[], mcCount: number, issueCount: number): Question[] {
  const mc = shuffle(pool.filter((q) => q.type === "mc")).slice(0, Math.max(0, mcCount));
  const issues = shuffle(pool.filter((q) => q.type === "issue")).slice(0, Math.max(0, issueCount));
  return [...mc, ...issues];
}

/** Strip answers, explanations, issues and model analyses before sending to the browser. */
export function toRunnerQuestions(questions: Question[]): RunnerQuestion[] {
  return questions.map((q) =>
    q.type === "mc"
      ? { kind: "mc", id: q.id, courseSlug: q.courseSlug, unitSlug: q.unitSlug, stem: q.stem, choices: q.choices }
      : { kind: "issue", id: q.id, courseSlug: q.courseSlug, unitSlug: q.unitSlug, factPattern: q.factPattern, minutes: q.minutes },
  );
}

/** One timer for the whole run: seconds per multiple-choice question plus each issue question's minutes. */
export function timeLimitFor(questions: Question[], secondsPerMc: number): number {
  return questions.reduce((n, q) => n + (q.type === "mc" ? secondsPerMc : Math.round(q.minutes * 60)), 0);
}

export function countByType(questions: Question[]): { mc: number; issue: number } {
  return { mc: questions.filter((q) => q.type === "mc").length, issue: questions.filter((q) => q.type === "issue").length };
}

/** Parse a comma-separated list query param into trimmed non-empty strings. */
export function listParam(v: string | string[] | undefined): string[] {
  const raw = Array.isArray(v) ? v.join(",") : (v ?? "");
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
