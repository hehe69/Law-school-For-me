// Shared types for everything stored in the database. Pure types only: this file is imported by both the
// server (SQLite) and the browser (editor state).

export const NODE_TYPES = [
  "heading",
  "rule",
  "element",
  "exception",
  "case",
  "statute",
  "policy",
  "hypo",
  "professor-note",
  "definition",
  "table",
  "flag",
  "image",
  "free",
] as const;
export type NodeType = (typeof NODE_TYPES)[number];

export const NODE_STATUSES = ["empty", "skeleton", "drafted", "final"] as const;
export type NodeStatus = (typeof NODE_STATUSES)[number];

export const OUTLINE_KINDS = ["full", "attack", "scratch"] as const;
export type OutlineKind = (typeof OUTLINE_KINDS)[number];

export const NUMBERING_STYLES = ["legal", "decimal", "bullets"] as const;
export type NumberingStyle = (typeof NUMBERING_STYLES)[number];

export const LINK_KINDS = ["see also", "conflicts with", "exception to", "modifies", "applies", "leads to"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const SOURCE_KINDS = ["transcript", "casebook", "statute", "handout", "other"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export type Course = {
  id: number;
  title: string;
  slug: string;
  order: number;
  /** YYYY-MM-DD or null */
  examDate: string | null;
  examFormat: string;
  /** Printed page limit for the outline, or null when the course has none */
  pageLimit: number | null;
  /** Slug of the matching course in the study app's content folder, or null */
  studyCourseSlug: string | null;
  syllabusTopics: string[];
  createdAt: string;
};

export type OutlineOptions = {
  /** Skeleton mode: the tree shows titles only and new nodes start as "skeleton". */
  skeleton?: boolean;
  /** Attack outlines: how they were generated (phase 4). */
  attack?: Record<string, unknown>;
  /** Exam mode pins, node ids (phase 4). */
  pins?: string[];
};

export type Outline = {
  id: string;
  courseId: number;
  name: string;
  kind: OutlineKind;
  numbering: NumberingStyle;
  isDefault: boolean;
  /** For attack outlines: the full outline they were generated from */
  sourceOutlineId: string | null;
  options: OutlineOptions;
  createdAt: string;
  updatedAt: string;
};

/** A node as the editor holds it; the same shape goes over the wire to the sync route. */
export type OutlineNode = {
  id: string;
  outlineId: string;
  parentId: string | null;
  /** 0-based position among siblings */
  position: number;
  type: NodeType;
  status: NodeStatus;
  title: string;
  /** Markdown */
  body: string;
  /** Typed fields, see fields.ts for the shape per type */
  fields: Record<string, unknown>;
  tags: string[];
  collapsed: boolean;
  pinned: boolean;
  /** Flashcards on for this node (rule and element nodes only) */
  flashcard: boolean;
  /** Study-app note this node was imported from, e.g. "property/adverse-possession/notes/elements.md" */
  linkedNotePath: string | null;
  /** 1-based element of the linked rule note, for element nodes imported with a rule */
  linkedElementIndex: number | null;
  /** Hash of the note's content at import time, for "check for changes" */
  linkedNoteHash: string | null;
  /** Attack outlines: the full-outline node this line came from */
  sourceNodeId: string | null;
  /** Hash of the source node's content when this line was generated */
  sourceHash: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NodeMap = Record<string, OutlineNode>;

export type Link = {
  id: string;
  fromNode: string;
  toNode: string;
  kind: LinkKind;
  note: string;
  createdAt: string;
};

export type Source = {
  id: string;
  nodeId: string;
  kind: SourceKind;
  reference: string;
  url: string | null;
  position: number;
};

export type ImageRow = {
  id: string;
  nodeId: string;
  /** Path relative to the uploads folder, e.g. "property/abc.png" */
  filePath: string;
  caption: string;
  /** Preferred display width in pixels, or null for natural width */
  widthHint: number | null;
  position: number;
  createdAt: string;
};

export type Syllabus = {
  courseId: number;
  filePath: string;
  uploadedAt: string;
};

export type Snapshot = {
  id: string;
  outlineId: string;
  createdAt: string;
  label: string;
  automatic: boolean;
  wordCount: number;
};

export type DrillResult = {
  id: number;
  nodeId: string;
  mode: "recite" | "hypo";
  correct: boolean;
  createdAt: string;
};

export type Capture = {
  id: number;
  courseId: number;
  text: string;
  createdAt: string;
  filed: boolean;
  filedNodeId: string | null;
};

/** What the editor page loads for one outline. */
export type OutlineBundle = {
  course: Course;
  outline: Outline;
  nodes: OutlineNode[];
  links: Link[];
  sources: Source[];
  images: ImageRow[];
};

/** Body of POST /api/outlines/[id]/sync. */
export type SyncRequest = {
  upserts: OutlineNode[];
  deletes: string[];
};
