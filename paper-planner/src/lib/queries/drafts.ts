import fs from "node:fs";
import mammoth from "mammoth";
import { getDb } from "../db";
import { draftsDir, ensureDir, toStored, uniquePath } from "../paths";
import type { Draft } from "../types";

export function listDrafts(paperId: number): Draft[] {
  return getDb().prepare("SELECT * FROM drafts WHERE paper_id = ? ORDER BY id DESC").all(paperId) as Draft[];
}

export function latestDraft(paperId: number): Draft | undefined {
  return getDb().prepare("SELECT * FROM drafts WHERE paper_id = ? ORDER BY id DESC LIMIT 1").get(paperId) as Draft | undefined;
}

export function getDraft(id: number): Draft | undefined {
  return getDb().prepare("SELECT * FROM drafts WHERE id = ?").get(id) as Draft | undefined;
}

// Word count = raw text of the .docx split on whitespace.
export async function countWords(bytes: Buffer): Promise<number> {
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  return value.split(/\s+/).filter(Boolean).length;
}

export async function addDraft(paperId: number, slug: string, fileName: string, bytes: Buffer, note: string): Promise<number> {
  const words = await countWords(bytes);
  const dir = ensureDir(draftsDir(slug));
  const target = uniquePath(dir, fileName);
  fs.writeFileSync(target, bytes);
  const res = getDb()
    .prepare("INSERT INTO drafts (paper_id, file_path, word_count, note) VALUES (?, ?, ?, ?)")
    .run(paperId, toStored(target), words, note);
  return Number(res.lastInsertRowid);
}

export function deleteDraft(id: number) {
  getDb().prepare("DELETE FROM drafts WHERE id = ?").run(id);
}
