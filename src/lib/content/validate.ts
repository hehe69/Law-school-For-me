// Hand-written validators. They return a list of problems (empty = valid)
// so the loader can report every issue in a file at once.

import type { IssueSpec, NoteFrontmatter, Question } from "./types";

type Problems = string[];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function requireString(obj: Record<string, unknown>, key: string, problems: Problems) {
  const v = obj[key];
  if (typeof v !== "string" || v.trim() === "") {
    problems.push(`"${key}" must be a non-empty string`);
  }
}

function requireStringList(obj: Record<string, unknown>, key: string, problems: Problems) {
  const v = obj[key];
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    problems.push(`"${key}" must be a list of strings (use [] for none)`);
  }
}

/** YAML turns unquoted 2026-09-15 into a Date; normalise either form to YYYY-MM-DD. */
function normaliseDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  return null;
}

/** A string field that may be missing (draft) but, when present, must be a string. */
function optString(obj: Record<string, unknown>, key: string, problems: Problems, missing: string[]): string {
  const v = obj[key];
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
    missing.push(key);
    return "";
  }
  if (typeof v !== "string") {
    problems.push(`"${key}" must be a string`);
    return "";
  }
  return v;
}

/** A list field that may be missing (draft) but, when present, must be a list of strings. [] counts as present. */
function optStringList(obj: Record<string, unknown>, key: string, problems: Problems, missing: string[]): string[] {
  const v = obj[key];
  if (v === undefined || v === null) {
    missing.push(key);
    return [];
  }
  if (!Array.isArray(v) || !v.every((x) => typeof x === "string")) {
    problems.push(`"${key}" must be a list of strings (use [] for none)`);
    return [];
  }
  return v;
}

export const NOTE_FIELDS: Record<NoteFrontmatter["type"], string[]> = {
  case: ["name", "facts", "issue", "rule", "holding", "whyItMatters"],
  rule: ["name", "ruleStatement", "elements", "exceptions", "wisconsinVariation"],
  class: ["date", "topic", "professorPoint", "modifiesRule"],
};

/**
 * Parse a note's frontmatter. The type must be valid and every present field must have the
 * right shape; fields that are absent or empty are reported in `missing` and make the note a draft.
 */
export function parseFrontmatter(
  raw: unknown,
): { ok: true; value: NoteFrontmatter; missing: string[] } | { ok: false; problems: Problems } {
  if (!isRecord(raw)) return { ok: false, problems: ["frontmatter is missing or not a mapping"] };
  const problems: Problems = [];
  const missing: string[] = [];
  const type = raw.type;

  if (type === "case") {
    const value: NoteFrontmatter = {
      type: "case",
      name: optString(raw, "name", problems, missing),
      facts: optString(raw, "facts", problems, missing),
      issue: optString(raw, "issue", problems, missing),
      rule: optString(raw, "rule", problems, missing),
      holding: optString(raw, "holding", problems, missing),
      whyItMatters: optString(raw, "whyItMatters", problems, missing),
    };
    return problems.length ? { ok: false, problems } : { ok: true, value, missing };
  }

  if (type === "rule") {
    const value: NoteFrontmatter = {
      type: "rule",
      name: optString(raw, "name", problems, missing),
      ruleStatement: optString(raw, "ruleStatement", problems, missing),
      elements: optStringList(raw, "elements", problems, missing),
      exceptions: optStringList(raw, "exceptions", problems, missing),
      wisconsinVariation: optString(raw, "wisconsinVariation", problems, missing),
    };
    return problems.length ? { ok: false, problems } : { ok: true, value, missing };
  }

  if (type === "class") {
    let date = "";
    if (raw.date === undefined || raw.date === null || raw.date === "") {
      missing.push("date");
    } else {
      const d = normaliseDate(raw.date);
      if (d) date = d;
      else problems.push(`"date" must be a date in YYYY-MM-DD form`);
    }
    const value: NoteFrontmatter = {
      type: "class",
      date,
      topic: optString(raw, "topic", problems, missing),
      professorPoint: optString(raw, "professorPoint", problems, missing),
      modifiesRule: optString(raw, "modifiesRule", problems, missing),
    };
    return problems.length ? { ok: false, problems } : { ok: true, value, missing };
  }

  return { ok: false, problems: [`"type" must be one of: case, rule, class (got ${JSON.stringify(type)})`] };
}

/** Optional "topics" list on any note type. Missing means []. */
export function validateTopics(raw: unknown): { ok: true; value: string[] } | { ok: false; problems: Problems } {
  if (!isRecord(raw) || raw.topics === undefined) return { ok: true, value: [] };
  const problems: Problems = [];
  requireStringList(raw, "topics", problems);
  if (problems.length) return { ok: false, problems };
  return { ok: true, value: (raw.topics as string[]).map((t) => t.trim()).filter(Boolean) };
}

/**
 * Turn a ruleNote reference into a content-relative note path. Accepts "unit/notes/x.md",
 * "<course>/unit/notes/x.md", or "content/<course>/unit/notes/x.md".
 */
export function normaliseRuleNoteRef(ref: string, courseSlug: string): string {
  let r = ref.trim().replace(/\\/g, "/").replace(/^\.?\//, "");
  if (r.startsWith("content/")) r = r.slice("content/".length);
  if (!r.startsWith(`${courseSlug}/`)) r = `${courseSlug}/${r}`;
  return r;
}

export function validateQuestion(
  raw: unknown,
  courseSlug: string,
  unitSlug: string,
): { ok: true; value: Question } | { ok: false; problems: Problems } {
  if (!isRecord(raw)) return { ok: false, problems: ["question must be an object"] };
  const problems: Problems = [];
  const type = raw.type === undefined ? "mc" : raw.type;
  if (type !== "mc" && type !== "issue") {
    return { ok: false, problems: [`"type" must be "mc" or "issue" (or absent for multiple choice), got ${JSON.stringify(raw.type)}`] };
  }
  requireString(raw, "id", problems);
  if (raw.tags !== undefined) requireStringList(raw, "tags", problems);
  const tags = Array.isArray(raw.tags) ? (raw.tags as string[]) : [];

  if (type === "issue") {
    requireString(raw, "factPattern", problems);
    const minutes = raw.minutes;
    if (typeof minutes !== "number" || !(minutes > 0)) problems.push(`"minutes" must be a positive number`);
    const issues: IssueSpec[] = [];
    if (!Array.isArray(raw.issues) || raw.issues.length === 0) {
      problems.push(`"issues" must be a non-empty list of { name, ruleNote, modelAnalysis }`);
    } else {
      raw.issues.forEach((it, i) => {
        if (!isRecord(it)) {
          problems.push(`issue ${i} must be an object`);
          return;
        }
        const sub: Problems = [];
        for (const k of ["name", "ruleNote", "modelAnalysis"]) requireString(it, k, sub);
        if (sub.length) problems.push(`issue ${i}: ${sub.join("; ")}`);
        else issues.push({ name: it.name as string, ruleNote: it.ruleNote as string, ruleNotePath: normaliseRuleNoteRef(it.ruleNote as string, courseSlug), modelAnalysis: it.modelAnalysis as string });
      });
    }
    if (problems.length) return { ok: false, problems };
    return {
      ok: true,
      value: { type: "issue", id: (raw.id as string).trim(), factPattern: raw.factPattern as string, issues, tags, minutes: minutes as number, courseSlug, unitSlug },
    };
  }

  requireString(raw, "stem", problems);
  requireString(raw, "explanation", problems);
  const choices = raw.choices;
  if (!Array.isArray(choices) || choices.length < 2 || !choices.every((c) => typeof c === "string")) {
    problems.push(`"choices" must be a list of at least 2 strings`);
  }
  const answer = raw.answer;
  if (!Number.isInteger(answer)) {
    problems.push(`"answer" must be an integer index into choices`);
  } else if (Array.isArray(choices) && ((answer as number) < 0 || (answer as number) >= choices.length)) {
    problems.push(`"answer" ${answer} is out of range for ${choices.length} choices`);
  }
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    value: {
      type: "mc",
      id: (raw.id as string).trim(),
      stem: raw.stem as string,
      choices: choices as string[],
      answer: answer as number,
      explanation: raw.explanation as string,
      tags,
      courseSlug,
      unitSlug,
    },
  };
}

export function validateCourseJson(raw: unknown): { ok: true; title: string; order: number } | { ok: false; problems: Problems } {
  if (!isRecord(raw)) return { ok: false, problems: ["course.json must be an object"] };
  const problems: Problems = [];
  requireString(raw, "title", problems);
  if (typeof raw.order !== "number") problems.push(`"order" must be a number`);
  if (problems.length) return { ok: false, problems };
  return { ok: true, title: raw.title as string, order: raw.order as number };
}

export function validateUnitJson(
  raw: unknown,
): { ok: true; title: string; order: number; syllabusTopics: string[]; emphasis: string } | { ok: false; problems: Problems } {
  if (!isRecord(raw)) return { ok: false, problems: ["unit.json must be an object"] };
  const problems: Problems = [];
  requireString(raw, "title", problems);
  if (typeof raw.order !== "number") problems.push(`"order" must be a number`);
  if (raw.syllabusTopics !== undefined) requireStringList(raw, "syllabusTopics", problems);
  if (raw.emphasis !== undefined && raw.emphasis !== null && typeof raw.emphasis !== "string") problems.push(`"emphasis" must be a string`);
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    title: raw.title as string,
    order: raw.order as number,
    syllabusTopics: (raw.syllabusTopics as string[] | undefined) ?? [],
    emphasis: typeof raw.emphasis === "string" ? raw.emphasis : "",
  };
}
