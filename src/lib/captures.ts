// Quick-capture inbox: raw text saved with a timestamp, later filed as a note or discarded.

import { getDb } from "./db";

export type CaptureRow = {
  id: number;
  text: string;
  created_at: string;
  filed_at: string | null;
  filed_note_path: string | null;
  discarded_at: string | null;
};

export function addCapture(text: string): number {
  const info = getDb().prepare("INSERT INTO captures (text, created_at) VALUES (?, ?)").run(text, new Date().toISOString());
  return Number(info.lastInsertRowid);
}

/** Unfiled, undiscarded captures, newest first. */
export function listInbox(): CaptureRow[] {
  return getDb()
    .prepare("SELECT * FROM captures WHERE filed_at IS NULL AND discarded_at IS NULL ORDER BY created_at DESC")
    .all() as CaptureRow[];
}

export function inboxCount(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM captures WHERE filed_at IS NULL AND discarded_at IS NULL").get() as { n: number }).n;
}

export function getCapture(id: number): CaptureRow | undefined {
  return getDb().prepare("SELECT * FROM captures WHERE id = ?").get(id) as CaptureRow | undefined;
}

export function markFiled(id: number, notePath: string): void {
  getDb().prepare("UPDATE captures SET filed_at = ?, filed_note_path = ? WHERE id = ?").run(new Date().toISOString(), notePath, id);
}

export function markDiscarded(id: number): void {
  getDb().prepare("UPDATE captures SET discarded_at = ? WHERE id = ? AND filed_at IS NULL").run(new Date().toISOString(), id);
}
