"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  EXTRACT_KINDS,
  LINK_PURPOSES,
  PAPER_STATUSES,
  READ_STATUSES,
  SECTION_ROLES,
  SECTION_STATUSES,
  SOURCE_TYPES,
  type ExtractKind,
  type LinkPurpose,
  type PaperStatus,
  type ReadStatus,
  type SectionRole,
  type SectionStatus,
  type SourceType,
} from "@/lib/types";
import * as papers from "@/lib/queries/papers";
import * as outline from "@/lib/queries/outline";
import * as sources from "@/lib/queries/sources";
import * as extracts from "@/lib/queries/extracts";
import * as citations from "@/lib/queries/citations";
import * as drafts from "@/lib/queries/drafts";
import { exportPaper, exportSourceList } from "@/lib/export";
import { runBackup } from "@/lib/backup";
import { safeFileName } from "@/lib/paths";

// ---- helpers ---------------------------------------------------------------

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
function intOrNull(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function int(fd: FormData, key: string): number {
  const n = intOrNull(fd, key);
  if (n === null) throw new Error(`Missing ${key}`);
  return n;
}
function oneOf<T extends readonly string[]>(value: string, allowed: T, fallback: T[number]): T[number] {
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}
function refresh() {
  // Single-user local app: every page reads straight from SQLite, so revalidate everything.
  revalidatePath("/", "layout");
}
function paperOrThrow(slug: string) {
  const p = papers.getPaperBySlug(slug);
  if (!p) throw new Error("Paper not found");
  return p;
}

// ---- papers ----------------------------------------------------------------

export async function createPaperAction(fd: FormData) {
  const title = str(fd, "title");
  if (!title) return;
  const paper = papers.createPaper({
    title,
    venue: str(fd, "venue"),
    word_limit: intOrNull(fd, "word_limit"),
    thesis: str(fd, "thesis"),
  });
  refresh();
  redirect(`/papers/${paper.slug}`);
}

export async function updatePaperAction(fd: FormData) {
  const id = int(fd, "id");
  const slug = papers.updatePaper(id, {
    title: str(fd, "title"),
    slug: str(fd, "slug"),
    venue: str(fd, "venue"),
    word_limit: intOrNull(fd, "word_limit"),
    status: oneOf(str(fd, "status"), PAPER_STATUSES, "planning") as PaperStatus,
  });
  refresh();
  redirect(`/papers/${slug}`);
}

export async function deletePaperAction(fd: FormData) {
  papers.deletePaper(int(fd, "id"));
  refresh();
  redirect("/");
}

export async function reviseThesisAction(fd: FormData) {
  const paper = paperOrThrow(str(fd, "slug"));
  const text = str(fd, "thesis");
  if (!text) return;
  papers.reviseThesis(paper.id, text, str(fd, "note"));
  refresh();
}

// ---- milestones & questions -----------------------------------------------

export async function addMilestoneAction(fd: FormData) {
  const paper = paperOrThrow(str(fd, "slug"));
  const name = str(fd, "name");
  if (!name) return;
  papers.addMilestone(paper.id, name, str(fd, "due_date") || null);
  refresh();
}
export async function updateMilestoneAction(fd: FormData) {
  const id = int(fd, "id");
  const input: { name?: string; due_date?: string | null; done?: boolean } = {};
  if (fd.has("name")) input.name = str(fd, "name");
  if (fd.has("due_date")) input.due_date = str(fd, "due_date") || null;
  if (fd.has("done")) input.done = str(fd, "done") === "1";
  papers.updateMilestone(id, input);
  refresh();
}
export async function deleteMilestoneAction(fd: FormData) {
  papers.deleteMilestone(int(fd, "id"));
  refresh();
}

export async function addQuestionAction(fd: FormData) {
  const paper = paperOrThrow(str(fd, "slug"));
  const text = str(fd, "text");
  if (!text) return;
  papers.addOpenQuestion(paper.id, text, intOrNull(fd, "section_id"));
  refresh();
}
export async function setQuestionResolvedAction(fd: FormData) {
  papers.setQuestionResolved(int(fd, "id"), str(fd, "resolved") === "1");
  refresh();
}
export async function deleteQuestionAction(fd: FormData) {
  papers.deleteOpenQuestion(int(fd, "id"));
  refresh();
}

// ---- outline ---------------------------------------------------------------

export async function createSectionAction(fd: FormData) {
  const paper = paperOrThrow(str(fd, "slug"));
  const heading = str(fd, "heading");
  if (!heading) return;
  const role = oneOf(str(fd, "role"), SECTION_ROLES, "argument") as SectionRole;
  outline.createSection({
    paper_id: paper.id,
    parent_id: intOrNull(fd, "parent_id"),
    heading,
    claim: str(fd, "claim"),
    role,
    responds_to: intOrNull(fd, "responds_to"),
    word_target: intOrNull(fd, "word_target"),
  });
  refresh();
}

// Used by the extract form's inline "new section" input: returns the new section.
export async function createTopLevelSection(slug: string, heading: string) {
  const paper = paperOrThrow(slug);
  const h = heading.trim();
  if (!h) return null;
  const sec = outline.createSection({ paper_id: paper.id, parent_id: null, heading: h });
  refresh();
  return { id: sec.id, heading: sec.heading, claim: sec.claim };
}

export async function updateSectionAction(fd: FormData) {
  const id = int(fd, "id");
  const input: Parameters<typeof outline.updateSection>[1] = {};
  if (fd.has("heading")) input.heading = str(fd, "heading") || "Untitled";
  if (fd.has("claim")) input.claim = str(fd, "claim");
  if (fd.has("status")) input.status = oneOf(str(fd, "status"), SECTION_STATUSES, "empty") as SectionStatus;
  if (fd.has("role")) input.role = oneOf(str(fd, "role"), SECTION_ROLES, "argument") as SectionRole;
  if (fd.has("responds_to")) input.responds_to = intOrNull(fd, "responds_to");
  if (fd.has("word_target")) input.word_target = intOrNull(fd, "word_target");
  outline.updateSection(id, input);
  refresh();
}

export async function updateSectionFields(id: number, input: { heading?: string; claim?: string }) {
  outline.updateSection(id, input);
  refresh();
}

export async function moveSectionAction(id: number, newParentId: number | null, index: number) {
  outline.moveSection(id, newParentId, index);
  refresh();
}

export async function deleteSectionAction(fd: FormData) {
  outline.deleteSection(int(fd, "id"));
  refresh();
}

// ---- sources ---------------------------------------------------------------

function sourceInput(fd: FormData): sources.SourceInput {
  return {
    type: oneOf(str(fd, "type"), SOURCE_TYPES, "other") as SourceType,
    citation: str(fd, "citation"),
    short_cite: str(fd, "short_cite") || str(fd, "citation").slice(0, 40),
    year: intOrNull(fd, "year"),
    publisher: str(fd, "publisher"),
    url: str(fd, "url"),
    read_status: oneOf(str(fd, "read_status"), READ_STATUSES, "unread") as ReadStatus,
    relevance: str(fd, "relevance"),
    tags: str(fd, "tags"),
  };
}

async function fileBytes(fd: FormData, key: string): Promise<{ name: string; bytes: Buffer } | null> {
  const f = fd.get(key);
  if (!f || typeof f === "string" || f.size === 0) return null;
  return { name: f.name, bytes: Buffer.from(await f.arrayBuffer()) };
}

export async function createSourceAction(fd: FormData) {
  const paper = paperOrThrow(str(fd, "slug"));
  const input = sourceInput(fd);
  if (!input.citation) return;
  const id = sources.createSource(paper.id, input);
  const pdf = await fileBytes(fd, "pdf");
  if (pdf) sources.attachPdf(id, paper.slug, safeFileName(pdf.name, ".pdf"), pdf.bytes);
  refresh();
  redirect(`/papers/${paper.slug}/sources/${id}`);
}

export async function updateSourceAction(fd: FormData) {
  const paper = paperOrThrow(str(fd, "slug"));
  const id = int(fd, "id");
  const input = sourceInput(fd);
  if (!input.citation) return;
  sources.updateSource(id, input);
  const pdf = await fileBytes(fd, "pdf");
  if (pdf) sources.attachPdf(id, paper.slug, safeFileName(pdf.name, ".pdf"), pdf.bytes);
  refresh();
}

export async function uploadPdfAction(fd: FormData) {
  const paper = paperOrThrow(str(fd, "slug"));
  const id = int(fd, "id");
  const pdf = await fileBytes(fd, "pdf");
  if (pdf) sources.attachPdf(id, paper.slug, safeFileName(pdf.name, ".pdf"), pdf.bytes);
  refresh();
}

export async function removePdfAction(fd: FormData) {
  sources.removePdf(int(fd, "id"));
  refresh();
}

export async function setReadStatusAction(fd: FormData) {
  sources.setReadStatus(int(fd, "id"), oneOf(str(fd, "read_status"), READ_STATUSES, "unread") as ReadStatus);
  refresh();
}

export async function deleteSourceAction(fd: FormData) {
  const slug = str(fd, "slug");
  sources.deleteSource(int(fd, "id"));
  refresh();
  redirect(`/papers/${slug}/sources`);
}

export async function copySourceAction(fd: FormData) {
  const id = int(fd, "id");
  const target = int(fd, "target_paper_id");
  const newId = sources.copySourceToPaper(id, target);
  refresh();
  const paper = papers.getPaperById(target);
  if (newId && paper) redirect(`/papers/${paper.slug}/sources/${newId}`);
}

// ---- section–source links --------------------------------------------------

export async function linkSourceAction(fd: FormData) {
  const note = str(fd, "note");
  if (!note) return;
  citations.createSectionSourceLink(int(fd, "section_id"), int(fd, "source_id"), oneOf(str(fd, "purpose"), LINK_PURPOSES, "support") as LinkPurpose, note);
  refresh();
}

// Called from the argument map after a drop.
export async function linkSource(sectionId: number, sourceId: number, purpose: string, note: string) {
  const n = note.trim();
  if (!n) return { ok: false, error: "A note on what this source proves is required." };
  const ok = citations.createSectionSourceLink(sectionId, sourceId, oneOf(purpose, LINK_PURPOSES, "support") as LinkPurpose, n);
  refresh();
  return { ok, error: ok ? undefined : "Already linked." };
}

export async function updateLinkAction(fd: FormData) {
  const note = str(fd, "note");
  if (!note) return;
  citations.updateSectionSourceLink(int(fd, "id"), oneOf(str(fd, "purpose"), LINK_PURPOSES, "support") as LinkPurpose, note);
  refresh();
}

export async function deleteLinkAction(fd: FormData) {
  citations.deleteSectionSourceLink(int(fd, "id"));
  refresh();
}

// ---- extracts --------------------------------------------------------------

function extractInput(fd: FormData) {
  return {
    pin_cite: str(fd, "pin_cite"),
    text: str(fd, "text"),
    note: str(fd, "note"),
    kind: oneOf(str(fd, "kind"), EXTRACT_KINDS, "support") as ExtractKind,
    tags: str(fd, "tags"),
  };
}

export async function createExtractAction(fd: FormData): Promise<{ ok: boolean; error?: string; id?: number }> {
  const paper = paperOrThrow(str(fd, "slug"));
  const sourceId = int(fd, "source_id");
  const input = extractInput(fd);
  if (!input.pin_cite) return { ok: false, error: "Pin cite is required." };
  const sectionIds = fd
    .getAll("section_ids")
    .map((v) => parseInt(String(v), 10))
    .filter((n) => Number.isFinite(n));
  const id = extracts.createExtract(sourceId, paper.id, { ...input, section_ids: sectionIds });
  refresh();
  return { ok: true, id };
}

export async function updateExtractAction(fd: FormData) {
  const id = int(fd, "id");
  const input = extractInput(fd);
  if (!input.pin_cite) return;
  extracts.updateExtract(id, input);
  refresh();
}

export async function deleteExtractAction(fd: FormData) {
  extracts.deleteExtract(int(fd, "id"));
  refresh();
}

export async function linkExtract(extractId: number, sectionId: number) {
  const ok = extracts.linkExtractToSection(extractId, sectionId);
  refresh();
  return { ok };
}

export async function linkExtractAction(fd: FormData) {
  extracts.linkExtractToSection(int(fd, "extract_id"), int(fd, "section_id"));
  refresh();
}

export async function unlinkExtractAction(fd: FormData) {
  extracts.unlinkExtractFromSection(int(fd, "extract_id"), int(fd, "section_id"));
  refresh();
}

// ---- citation log ----------------------------------------------------------

export async function addLogEntryAction(fd: FormData) {
  const paper = paperOrThrow(str(fd, "slug"));
  const sourceId = intOrNull(fd, "source_id");
  if (!sourceId) return;
  citations.addManualLogEntry(paper.id, {
    source_id: sourceId,
    pin_cite: str(fd, "pin_cite") || null,
    section_id: intOrNull(fd, "section_id"),
    extract_id: null,
    used_in: str(fd, "used_in"),
    note: str(fd, "note"),
  });
  refresh();
}

export async function updateLogEntry(id: number, input: { pin_cite?: string | null; used_in?: string; note?: string; verified?: boolean }) {
  citations.updateLogEntry(id, input);
  refresh();
}

export async function updateLogEntryAction(fd: FormData) {
  const id = int(fd, "id");
  const input: Parameters<typeof citations.updateLogEntry>[1] = {};
  if (fd.has("pin_cite")) input.pin_cite = str(fd, "pin_cite") || null;
  if (fd.has("used_in")) input.used_in = str(fd, "used_in");
  if (fd.has("note")) input.note = str(fd, "note");
  if (fd.has("verified")) input.verified = str(fd, "verified") === "1";
  citations.updateLogEntry(id, input);
  refresh();
}

export async function deleteLogEntryAction(fd: FormData) {
  citations.deleteLogEntry(int(fd, "id"));
  refresh();
}

// ---- drafts ----------------------------------------------------------------

export async function addDraftAction(fd: FormData) {
  const paper = paperOrThrow(str(fd, "slug"));
  const file = await fileBytes(fd, "file");
  if (!file) return;
  await drafts.addDraft(paper.id, paper.slug, safeFileName(file.name, ".docx"), file.bytes, str(fd, "note"));
  refresh();
}

export async function deleteDraftAction(fd: FormData) {
  drafts.deleteDraft(int(fd, "id"));
  refresh();
}

// ---- export & backup -------------------------------------------------------

export async function exportPaperAction(fd: FormData) {
  const paper = paperOrThrow(str(fd, "slug"));
  const format = str(fd, "format") === "md" ? "md" : "docx";
  const what = str(fd, "what") === "sources" ? "sources" : "paper";
  const file = what === "sources" ? await exportSourceList(paper, format) : await exportPaper(paper, format);
  redirect(`/papers/${paper.slug}/export?done=${encodeURIComponent(file)}`);
}

export async function backupAction() {
  const file = await runBackup();
  refresh();
  redirect(`/?backup=${encodeURIComponent(file)}`);
}
