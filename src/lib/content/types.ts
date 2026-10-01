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
  /** Optional reference to the rule note this case applies: "<unit>/notes/<file>.md" */
  appliesRule?: string;
};

export type RuleNote = {
  type: "rule";
  name: string;
  ruleStatement: string;
  elements: string[];
  exceptions: string[];
  /** Parallel to exceptions: 1-based index of the element each exception defeats, or null */
  exceptionElements: (number | null)[];
  wisconsinVariation: string;
  /** 1-based index of the element the Wisconsin variation changes, or null */
  wisconsinElement: number | null;
  /** Optional references to related rule notes */
  relatedRules: string[];
};

export type ClassNote = {
  type: "class";
  date: string; // YYYY-MM-DD
  topic: string;
  professorPoint: string;
  /** A rule note reference ("<unit>/notes/<file>.md") or, in older notes, free text */
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

export type McQuestion = {
  type: "mc";
  id: string;
  /** Optional image shown above the stem, a path relative to the unit folder such as "images/map.png" */
  image?: string;
  /** Disabled questions stay in questions.json but never appear in tests */
  disabled: boolean;
  stem: string;
  choices: string[];
  answer: number;
  explanation: string;
  tags: string[];
  courseSlug: string;
  unitSlug: string;
};

export type IssueSpec = {
  name: string;
  /** The ruleNote reference exactly as written in questions.json */
  ruleNote: string;
  /** Resolved content-relative path of the rule note, e.g. "property/adverse-possession/notes/elements.md" */
  ruleNotePath: string;
  modelAnalysis: string;
};

/** An issue-spotter question: a fact pattern, a timed written answer, self-graded against a list of issues. */
export type IssueQuestion = {
  type: "issue";
  id: string;
  image?: string;
  disabled: boolean;
  factPattern: string;
  issues: IssueSpec[];
  tags: string[];
  minutes: number;
  courseSlug: string;
  unitSlug: string;
};

export type Question = McQuestion | IssueQuestion;

export type Unit = {
  slug: string;
  courseSlug: string;
  title: string;
  order: number;
  syllabusTopics: string[];
  /** Free text from unit.json "emphasis": what the professor stressed. Empty when unset. */
  emphasis: string;
  notes: Note[];
  /** PDF files under readings/ */
  readings: Reading[];
  /** File names under images/ */
  images: string[];
  questions: Question[];
  /** Errors scoped to this unit (bad note, bad question) */
  errors: ContentError[];
};

export type Reading = {
  /** File name, e.g. "week-3-cases.pdf" */
  file: string;
  bytes: number;
};

export type Course = {
  slug: string;
  title: string;
  order: number;
  /** Optional exam date from course.json, YYYY-MM-DD */
  examDate: string | null;
  units: Unit[];
};

export type ContentTree = {
  courses: Course[];
  /** Every error found anywhere in content/, including unit-scoped ones */
  errors: ContentError[];
};
