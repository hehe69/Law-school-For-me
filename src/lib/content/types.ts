// Types for everything read from the content/ folder.

export type ContentError = {
  /** Path relative to the content root, e.g. "property/adverse-possession/notes/foo.md" */
  path: string;
  message: string;
};

export type CaseNote = {
  type: "case";
  name: string;
  facts: string;
  issue: string;
  rule: string;
  holding: string;
  whyItMatters: string;
};

export type RuleNote = {
  type: "rule";
  name: string;
  ruleStatement: string;
  elements: string[];
  exceptions: string[];
  wisconsinVariation: string;
};

export type ClassNote = {
  type: "class";
  date: string; // YYYY-MM-DD
  topic: string;
  professorPoint: string;
  modifiesRule: string;
};

export type NoteFrontmatter = CaseNote | RuleNote | ClassNote;
export type NoteType = NoteFrontmatter["type"];

export type NoteStatus = "complete" | "draft";

export type Note = {
  /** File name without .md */
  slug: string;
  path: string;
  frontmatter: NoteFrontmatter;
  /** "draft" when any fixed field for the type is missing or empty. Drafts render with a badge and make no flashcards. */
  status: NoteStatus;
  /** Names of the fixed fields that are missing or empty */
  missingFields: string[];
  /** Optional syllabus topics this note covers (frontmatter "topics"), used by the Gaps view */
  topics: string[];
  /** Markdown below the frontmatter, may be empty */
  body: string;
};

export type Question = {
  id: string;
  stem: string;
  choices: string[];
  answer: number;
  explanation: string;
  tags: string[];
  courseSlug: string;
  unitSlug: string;
};

export type Unit = {
  slug: string;
  courseSlug: string;
  title: string;
  order: number;
  syllabusTopics: string[];
  /** Free text from unit.json "emphasis": what the professor stressed. Empty when unset. */
  emphasis: string;
  notes: Note[];
  questions: Question[];
  /** Errors scoped to this unit (bad note, bad question) */
  errors: ContentError[];
};

export type Course = {
  slug: string;
  title: string;
  order: number;
  units: Unit[];
};

export type ContentTree = {
  courses: Course[];
  /** Every error found anywhere in content/, including unit-scoped ones */
  errors: ContentError[];
};
