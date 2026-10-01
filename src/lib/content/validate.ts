// Hand-written validators. They return a list of problems (empty = valid)
// so the loader can report every issue in a file at once.

import type { NoteFrontmatter, Question } from "./types";

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

export function validateFrontmatter(
  raw: unknown,
): { ok: true; value: NoteFrontmatter } | { ok: false; problems: Problems } {
  if (!isRecord(raw)) return { ok: false, problems: ["frontmatter is missing or not a mapping"] };
  const problems: Problems = [];
  const type = raw.type;

  if (type === "case") {
    for (const k of ["name", "facts", "issue", "rule", "holding", "whyItMatters"]) requireString(raw, k, problems);
    if (problems.length) return { ok: false, problems };
    return {
      ok: true,
      value: {
        type: "case",
        name: raw.name as string,
        facts: raw.facts as string,
        issue: raw.issue as string,
        rule: raw.rule as string,
        holding: raw.holding as string,
        whyItMatters: raw.whyItMatters as string,
      },
    };
  }

  if (type === "rule") {
    for (const k of ["name", "ruleStatement", "wisconsinVariation"]) requireString(raw, k, problems);
    for (const k of ["elements", "exceptions"]) requireStringList(raw, k, problems);
    if (problems.length) return { ok: false, problems };
    return {
      ok: true,
      value: {
        type: "rule",
        name: raw.name as string,
        ruleStatement: raw.ruleStatement as string,
        elements: raw.elements as string[],
        exceptions: raw.exceptions as string[],
        wisconsinVariation: raw.wisconsinVariation as string,
      },
    };
  }

  if (type === "class") {
    const date = normaliseDate(raw.date);
    if (!date) problems.push(`"date" must be a date in YYYY-MM-DD form`);
    for (const k of ["topic", "professorPoint", "modifiesRule"]) requireString(raw, k, problems);
    if (problems.length || !date) return { ok: false, problems };
    return {
      ok: true,
      value: {
        type: "class",
        date,
        topic: raw.topic as string,
        professorPoint: raw.professorPoint as string,
        modifiesRule: raw.modifiesRule as string,
      },
    };
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

export function validateQuestion(
  raw: unknown,
  courseSlug: string,
  unitSlug: string,
): { ok: true; value: Question } | { ok: false; problems: Problems } {
  if (!isRecord(raw)) return { ok: false, problems: ["question must be an object"] };
  const problems: Problems = [];
  requireString(raw, "id", problems);
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
  if (raw.tags !== undefined) requireStringList(raw, "tags", problems);

  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    value: {
      id: (raw.id as string).trim(),
      stem: raw.stem as string,
      choices: choices as string[],
      answer: answer as number,
      explanation: raw.explanation as string,
      tags: (raw.tags as string[] | undefined) ?? [],
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
): { ok: true; title: string; order: number; syllabusTopics: string[] } | { ok: false; problems: Problems } {
  if (!isRecord(raw)) return { ok: false, problems: ["unit.json must be an object"] };
  const problems: Problems = [];
  requireString(raw, "title", problems);
  if (typeof raw.order !== "number") problems.push(`"order" must be a number`);
  if (raw.syllabusTopics !== undefined) requireStringList(raw, "syllabusTopics", problems);
  if (problems.length) return { ok: false, problems };
  return {
    ok: true,
    title: raw.title as string,
    order: raw.order as number,
    syllabusTopics: (raw.syllabusTopics as string[] | undefined) ?? [],
  };
}
