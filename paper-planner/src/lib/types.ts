export const PAPER_STATUSES = ["planning", "researching", "drafting", "revising", "submitted"] as const;
export type PaperStatus = (typeof PAPER_STATUSES)[number];

export const SECTION_STATUSES = ["empty", "notes", "drafted", "revised"] as const;
export type SectionStatus = (typeof SECTION_STATUSES)[number];

export const SECTION_ROLES = ["argument", "counterargument", "response", "background"] as const;
export type SectionRole = (typeof SECTION_ROLES)[number];

export const SOURCE_TYPES = ["case", "statute", "regulation", "article", "book", "treatise", "website", "other"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const READ_STATUSES = ["unread", "skimmed", "read"] as const;
export type ReadStatus = (typeof READ_STATUSES)[number];

export const EXTRACT_KINDS = ["support", "counter", "background", "definition"] as const;
export type ExtractKind = (typeof EXTRACT_KINDS)[number];

export const LINK_PURPOSES = ["support", "counter", "background"] as const;
export type LinkPurpose = (typeof LINK_PURPOSES)[number];

export const DEFAULT_MILESTONES = ["topic approved", "research plan", "research memo", "first draft", "second draft", "final"];

export interface Paper {
  id: number;
  title: string;
  slug: string;
  venue: string;
  word_limit: number | null;
  status: PaperStatus;
  thesis: string;
  created_at: string;
}

export interface ThesisVersion {
  id: number;
  paper_id: number;
  text: string;
  note: string;
  created_at: string;
}

export interface Milestone {
  id: number;
  paper_id: number;
  name: string;
  due_date: string | null;
  done: number;
  sort_order: number;
}

export interface Tag {
  id: number;
  paper_id: number;
  name: string;
}

export interface Section {
  id: number;
  paper_id: number;
  parent_id: number | null;
  sort_order: number;
  heading: string;
  claim: string;
  status: SectionStatus;
  word_target: number | null;
  role: SectionRole;
  responds_to: number | null;
  created_at: string;
}

export interface Source {
  id: number;
  paper_id: number;
  type: SourceType;
  citation: string;
  short_cite: string;
  year: number | null;
  publisher: string;
  url: string;
  pdf_path: string | null;
  read_status: ReadStatus;
  relevance: string;
  created_at: string;
}

export interface Extract {
  id: number;
  source_id: number;
  pin_cite: string;
  text: string;
  note: string;
  kind: ExtractKind;
  created_at: string;
}

export interface SectionSource {
  id: number;
  section_id: number;
  source_id: number;
  purpose: LinkPurpose;
  note: string;
  created_at: string;
}

export interface CitationLogEntry {
  id: number;
  paper_id: number;
  source_id: number;
  pin_cite: string | null;
  section_id: number | null;
  extract_id: number | null;
  used_in: string;
  verified: number;
  note: string;
  origin: "manual" | "extract_link" | "source_link";
  created_at: string;
}

export interface OpenQuestion {
  id: number;
  paper_id: number;
  section_id: number | null;
  text: string;
  resolved: number;
  created_at: string;
}

export interface Draft {
  id: number;
  paper_id: number;
  file_path: string;
  word_count: number;
  note: string;
  created_at: string;
}

// Section with tree position and support count, in outline (depth-first) order.
export interface OutlineNode extends Section {
  depth: number;
  support: number;
  path: string; // e.g. "2.1.3" for display
}
