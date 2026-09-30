export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function formatScore(percent: number | null): string {
  if (percent === null) return "—";
  return `${Math.round(percent)}%`;
}

/** A, B, C ... for choice indexes. */
export function choiceLetter(i: number): string {
  return String.fromCharCode(65 + i);
}
