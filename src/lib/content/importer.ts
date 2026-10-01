// Validation for the paste-a-JSON question importer. Stricter than the loader:
// exactly 5 choices, and ids must be new within the course.

import type { Course, Unit } from "./types";

export type ImportMode = "append" | "replace";

export type ImportError = {
  /** Index into the pasted array, or null for problems with the whole paste */
  index: number | null;
  message: string;
};

export type ImportQuestion = {
  id: string;
  stem: string;
  choices: string[];
  answer: number;
  explanation: string;
  tags: string[];
};

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

/** Check one pasted question. Returns the cleaned question or plain-language problems. */
export function checkImportQuestion(raw: unknown): { ok: true; value: ImportQuestion } | { ok: false; problems: string[] } {
  if (!isRecord(raw)) return { ok: false, problems: [`is ${describe(raw)}, not an object with id, stem, choices, answer, explanation`] };
  const problems: string[] = [];

  const text = (key: string): string => {
    const v = raw[key];
    if (typeof v !== "string") {
      problems.push(`"${key}" is ${describe(v)}; it must be text`);
      return "";
    }
    if (v.trim() === "") {
      problems.push(`"${key}" is empty`);
      return "";
    }
    return v;
  };

  const id = text("id").trim();
  const stem = text("stem");
  const explanation = text("explanation");

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

  let tags: string[] = [];
  if (raw.tags !== undefined) {
    if (!Array.isArray(raw.tags) || !raw.tags.every((t) => typeof t === "string")) {
      problems.push(`"tags" is ${describe(raw.tags)}; it must be a list of strings like ["tacking", "wisconsin"]`);
    } else {
      tags = raw.tags.map((t) => t.trim()).filter(Boolean);
    }
  }

  if (problems.length) return { ok: false, problems };
  return { ok: true, value: { id, stem, choices, answer, explanation, tags } };
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
    const result = checkImportQuestion(item);
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
