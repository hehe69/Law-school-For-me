// Validation for the paste-a-JSON question importer. Stricter than the loader:
// exactly 5 choices, and ids must be new within the course.

import type { Course, Unit } from "./types";
import { findRuleNote } from "./loader";
import { normaliseRuleNoteRef } from "./validate";

export type ImportMode = "append" | "replace";

export type ImportError = {
  /** Index into the pasted array, or null for problems with the whole paste */
  index: number | null;
  message: string;
};

export type ImportMc = { type: "mc"; id: string; stem: string; choices: string[]; answer: number; explanation: string; tags: string[] };
export type ImportIssue = {
  type: "issue";
  id: string;
  factPattern: string;
  issues: { name: string; ruleNote: string; modelAnalysis: string }[];
  tags: string[];
  minutes: number;
};
export type ImportQuestion = ImportMc | ImportIssue;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function describe(v: unknown): string {
  if (v === undefined) return "missing";
  if (v === null) return "null";
  if (Array.isArray(v)) return `a list of ${v.length}`;
  const t = typeof v;
  return `${t === "object" ? "an" : "a"} ${t}`;
}

/** Check one pasted question (either type). Returns the cleaned question or plain-language problems. */
export function checkImportQuestion(raw: unknown, course?: Course): { ok: true; value: ImportQuestion } | { ok: false; problems: string[] } {
  if (!isRecord(raw)) return { ok: false, problems: [`is ${describe(raw)}, not an object with id, stem, choices, answer, explanation (or type "issue")`] };
  const problems: string[] = [];

  const text = (obj: Record<string, unknown>, key: string, label = key): string => {
    const v = obj[key];
    if (typeof v !== "string") {
      problems.push(`"${label}" is ${describe(v)}; it must be text`);
      return "";
    }
    if (v.trim() === "") {
      problems.push(`"${label}" is empty`);
      return "";
    }
    return v;
  };

  const type = raw.type === undefined ? "mc" : raw.type;
  if (type !== "mc" && type !== "issue") {
    return { ok: false, problems: [`"type" is ${JSON.stringify(raw.type)}; it must be "issue", "mc", or left out for multiple choice`] };
  }
  const id = text(raw, "id").trim();

  let tags: string[] = [];
  if (raw.tags !== undefined) {
    if (!Array.isArray(raw.tags) || !raw.tags.every((t) => typeof t === "string")) {
      problems.push(`"tags" is ${describe(raw.tags)}; it must be a list of strings like ["tacking", "wisconsin"]`);
    } else {
      tags = raw.tags.map((t) => t.trim()).filter(Boolean);
    }
  }

  if (type === "issue") {
    const factPattern = text(raw, "factPattern");
    const minutes = raw.minutes;
    if (typeof minutes !== "number" || !(minutes > 0)) problems.push(`"minutes" is ${typeof minutes === "number" ? minutes : describe(minutes)}; it must be a positive number like 20`);
    const issues: ImportIssue["issues"] = [];
    if (!Array.isArray(raw.issues) || raw.issues.length === 0) {
      problems.push(`"issues" is ${Array.isArray(raw.issues) ? "an empty list" : describe(raw.issues)}; it needs at least one { name, ruleNote, modelAnalysis }`);
    } else {
      raw.issues.forEach((it, i) => {
        if (!isRecord(it)) {
          problems.push(`issue ${i} is ${describe(it)}, not an object`);
          return;
        }
        const name = text(it, "name", `issues[${i}].name`);
        const ruleNote = text(it, "ruleNote", `issues[${i}].ruleNote`);
        const modelAnalysis = text(it, "modelAnalysis", `issues[${i}].modelAnalysis`);
        if (course && ruleNote) {
          const resolved = normaliseRuleNoteRef(ruleNote, course.slug);
          if (!findRuleNote(course, resolved)) {
            problems.push(`issues[${i}].ruleNote "${ruleNote}" does not match any rule note in this course (expected something like "<unit>/notes/<file>.md")`);
          }
        }
        issues.push({ name, ruleNote, modelAnalysis });
      });
    }
    if (problems.length) return { ok: false, problems };
    return { ok: true, value: { type: "issue", id, factPattern, issues, tags, minutes: minutes as number } };
  }

  const stem = text(raw, "stem");
  const explanation = text(raw, "explanation");

  let choices: string[] = [];
  const rawChoices = raw.choices;
  if (!Array.isArray(rawChoices)) {
    problems.push(`"choices" is ${describe(rawChoices)}; it must be a list of exactly 5 strings`);
  } else if (rawChoices.length !== 5) {
    problems.push(`has ${rawChoices.length} choice${rawChoices.length === 1 ? "" : "s"}; exactly 5 are required`);
  } else if (!rawChoices.every((c) => typeof c === "string" && c.trim() !== "")) {
    problems.push(`every entry in "choices" must be non-empty text`);
  } else {
    choices = rawChoices;
  }

  let answer = -1;
  const rawAnswer = raw.answer;
  if (!Number.isInteger(rawAnswer)) {
    problems.push(`"answer" is ${describe(rawAnswer)}; it must be a whole number from 0 to 4 (0 = A, 4 = E)`);
  } else if ((rawAnswer as number) < 0 || (rawAnswer as number) > 4) {
    problems.push(`"answer" is ${rawAnswer}; it must be from 0 to 4 (0 = A, 4 = E)`);
  } else {
    answer = rawAnswer as number;
  }

  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { type: "mc", id, stem, choices, answer, explanation, tags } };
}

/**
 * Validate a whole pasted batch against the course. In append mode the ids must not clash with any
 * question already in the course; in replace mode this unit's current ids are free to reuse.
 */
export function checkImportBatch(
  parsed: unknown,
  course: Course,
  unit: Unit,
  mode: ImportMode,
): { ok: true; questions: ImportQuestion[] } | { ok: false; errors: ImportError[] } {
  if (!Array.isArray(parsed)) {
    return { ok: false, errors: [{ index: null, message: `the paste must be a JSON array, starting with [ and ending with ]; got ${describe(parsed)}` }] };
  }
  if (parsed.length === 0) return { ok: false, errors: [{ index: null, message: "the array is empty; nothing to import" }] };

  const errors: ImportError[] = [];
  const questions: ImportQuestion[] = [];

  // Existing ids in the course, with the unit they live in.
  const existing = new Map<string, string>();
  for (const u of course.units) {
    if (mode === "replace" && u.slug === unit.slug) continue;
    for (const q of u.questions) existing.set(q.id, u.slug);
  }

  const seenInPaste = new Map<string, number>();
  parsed.forEach((item, index) => {
    const result = checkImportQuestion(item, course);
    if (!result.ok) {
      for (const p of result.problems) errors.push({ index, message: p });
      return;
    }
    const { id } = result.value;
    const owner = existing.get(id);
    if (owner !== undefined) {
      errors.push({ index, message: `id "${id}" already exists in unit "${owner}"${owner === unit.slug ? " (choose Replace to overwrite this unit's questions)" : ""}` });
      return;
    }
    const dup = seenInPaste.get(id);
    if (dup !== undefined) {
      errors.push({ index, message: `id "${id}" is also used at index ${dup} in this paste` });
      return;
    }
    seenInPaste.set(id, index);
    questions.push(result.value);
  });

  return errors.length ? { ok: false, errors } : { ok: true, questions };
}
