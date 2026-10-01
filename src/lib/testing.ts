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

/** Shuffle a pool, take `count`, and strip answers/explanations before sending to the browser. */
export function toRunnerQuestions(pool: Question[], count: number): RunnerQuestion[] {
  return shuffle(pool)
    .slice(0, count)
    .map((q) => ({ id: q.id, courseSlug: q.courseSlug, unitSlug: q.unitSlug, stem: q.stem, choices: q.choices }));
}

/** Parse a comma-separated list query param into trimmed non-empty strings. */
export function listParam(v: string | string[] | undefined): string[] {
  const raw = Array.isArray(v) ? v.join(",") : (v ?? "");
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
