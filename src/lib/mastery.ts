// Mastery score and colours. Pure: safe to import from client components.

export type Mastery = "green" | "amber" | "red" | "grey";

const EASE_LOW = 1.3;
const EASE_HIGH = 2.5;

/** Blend flashcard ease and tag miss rate into a 0..1 score, or null with no data. */
export function masteryScore(ease: number | null, missRate: number | null): number | null {
  const parts: number[] = [];
  if (ease !== null) parts.push(Math.max(0, Math.min(1, (ease - EASE_LOW) / (EASE_HIGH - EASE_LOW))));
  if (missRate !== null) parts.push(1 - missRate);
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

export function masteryColour(score: number | null): Mastery {
  if (score === null) return "grey";
  if (score >= 0.7) return "green";
  if (score >= 0.4) return "amber";
  return "red";
}

export const MASTERY_FILL: Record<Mastery, string> = { green: "#bbf7d0", amber: "#fde68a", red: "#fecaca", grey: "#e5e7eb" };
