// SM-2 spaced repetition, the same scheduling as the study app. Pure functions only. Ratings are 1-4:
//   1 = Again (forgot), 2 = Hard, 3 = Good, 4 = Easy.
// They map onto SM-2's 0-5 quality scale as 1 -> 1, 2 -> 3, 3 -> 4, 4 -> 5.

export type Sm2State = {
  ease: number; // ease factor, starts at 2.5, never below 1.3
  intervalDays: number; // current interval; 0 for a new card
  repetitions: number; // consecutive successful reviews
};

export const NEW_CARD: Sm2State = { ease: 2.5, intervalDays: 0, repetitions: 0 };

export type Rating = 1 | 2 | 3 | 4;

export function isRating(v: unknown): v is Rating {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

export const RATING_LABELS: Record<Rating, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };

const QUALITY: Record<Rating, number> = { 1: 1, 2: 3, 3: 4, 4: 5 };

export function applySm2(state: Sm2State, rating: Rating): Sm2State {
  const q = QUALITY[rating];
  // Ease always updates, per SM-2.
  const ease = Math.max(1.3, state.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (q < 3) {
    // Forgot: start over. Interval 0 keeps the card in today's queue.
    return { ease, intervalDays: 0, repetitions: 0 };
  }
  let intervalDays: number;
  if (state.repetitions === 0) intervalDays = 1;
  else if (state.repetitions === 1) intervalDays = 6;
  else intervalDays = Math.round(state.intervalDays * ease);
  if (rating === 2) intervalDays = Math.max(1, Math.round(intervalDays * 0.5)); // Hard: shorter step
  return { ease, intervalDays: Math.max(1, intervalDays), repetitions: state.repetitions + 1 };
}

/** Local calendar date as YYYY-MM-DD. */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayString(): string {
  return toDateString(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return toDateString(new Date(y, m - 1, d + days));
}
