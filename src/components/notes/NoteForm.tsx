"use client";

// New/edit note form. The type selector switches the fields shown; everything is controlled state so
// a failed save keeps what you typed. Saving posts to a server action which writes the markdown file.

import { useActionState, useState } from "react";
import { saveNoteAction, type NoteFormState } from "@/app/content-actions";
import type { Note, NoteType } from "@/lib/content/types";
import { slugify } from "@/lib/slug";

export type UnitOption = { slug: string; title: string; syllabusTopics: string[]; existingSlugs: string[] };
export type CourseOption = { slug: string; title: string; units: UnitOption[] };

type Props = {
  courseSlug: string;
  unitSlug: string;
  syllabusTopics: string[];
  /** Slugs of note files already in this unit, for the "already exists" warning */
  existingSlugs: string[];
  /** When editing: the note to prefill */
  note?: Note;
  /** When filing a capture: lets the user pick course and unit; courseSlug/unitSlug are then just the initial choice */
  pickers?: CourseOption[];
  /** Capture being filed: prefills the body and is marked filed on save */
  capture?: { id: number; text: string; createdOn: string };
};

type Fields = Record<string, string>;

const FIELD_DEFS: Record<NoteType, { key: string; label: string; kind: "text" | "textarea" | "lines" | "date"; hint?: string }[]> = {
  case: [
    { key: "name", label: "Case name", kind: "text" },
    { key: "facts", label: "Facts", kind: "textarea" },
    { key: "issue", label: "Issue", kind: "textarea" },
    { key: "rule", label: "Rule", kind: "textarea" },
    { key: "holding", label: "Holding", kind: "textarea" },
    { key: "whyItMatters", label: "Why it matters", kind: "textarea" },
  ],
  rule: [
    { key: "name", label: "Rule name", kind: "text" },
    { key: "ruleStatement", label: "Rule statement", kind: "textarea" },
    { key: "elements", label: "Elements", kind: "lines", hint: "one per line" },
    { key: "exceptions", label: "Exceptions", kind: "lines", hint: "one per line" },
    { key: "wisconsinVariation", label: "Wisconsin variation", kind: "textarea" },
  ],
  class: [
    { key: "date", label: "Date", kind: "date" },
    { key: "topic", label: "Topic", kind: "text" },
    { key: "professorPoint", label: "Professor's point", kind: "textarea" },
    { key: "modifiesRule", label: "Modifies rule", kind: "textarea" },
  ],
};

function initialFields(note?: Note): Fields {
  if (!note) return {};
  const fm = note.frontmatter as unknown as Record<string, unknown>;
  const out: Fields = {};
  for (const [k, v] of Object.entries(fm)) {
    if (k === "type") continue;
    out[k] = Array.isArray(v) ? v.join("\n") : String(v ?? "");
  }
  return out;
}

export default function NoteForm(props: Props) {
  const { note, pickers, capture } = props;
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(saveNoteAction, { error: null });
  const [type, setType] = useState<NoteType>(note?.frontmatter.type ?? "case");
  const [fields, setFields] = useState<Fields>(() => (capture ? { date: capture.createdOn } : initialFields(note)));
  const [topics, setTopics] = useState<Set<string>>(() => new Set(note?.topics ?? []));
  const [body, setBody] = useState(capture?.text ?? note?.body ?? "");
  const [courseSlug, setCourseSlug] = useState(props.courseSlug);
  const [unitSlug, setUnitSlug] = useState(props.unitSlug);
  const editing = Boolean(note);

  // With pickers, the unit's topics and existing filenames follow the current selection.
  const pickedCourse = pickers?.find((c) => c.slug === courseSlug);
  const pickedUnit = pickedCourse?.units.find((u) => u.slug === unitSlug);
  const syllabusTopics = pickers ? (pickedUnit?.syllabusTopics ?? []) : props.syllabusTopics;
  const existingSlugs = pickers ? (pickedUnit?.existingSlugs ?? []) : props.existingSlugs;

  function pickCourse(slug: string) {
    setCourseSlug(slug);
    const first = pickers?.find((c) => c.slug === slug)?.units[0]?.slug ?? "";
    setUnitSlug(first);
    setTopics(new Set());
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const derivedSlug = editing
    ? note!.slug
    : slugify(type === "class" ? `${fields.date ?? ""} ${fields.topic ?? ""}` : (fields.name ?? ""));
  const clash = !editing && derivedSlug !== "" && existingSlugs.includes(derivedSlug);
  const inputCls = "mt-1 w-full rounded border border-gray-300 px-2 py-1";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="course" value={courseSlug} />
      <input type="hidden" name="unit" value={unitSlug} />
      {editing && <input type="hidden" name="existingSlug" value={note!.slug} />}
      {capture && <input type="hidden" name="captureId" value={capture.id} />}

      {pickers && (
        <div className="flex flex-wrap gap-4">
          <label className="block">
            <span className="font-medium">Course</span>
            <select value={courseSlug} onChange={(e) => pickCourse(e.target.value)} className="mt-1 block rounded border border-gray-300 px-2 py-1">
              {pickers.map((c) => <option key={c.slug} value={c.slug}>{c.title}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-medium">Unit</span>
            <select value={unitSlug} onChange={(e) => { setUnitSlug(e.target.value); setTopics(new Set()); }} className="mt-1 block rounded border border-gray-300 px-2 py-1">
              {(pickedCourse?.units ?? []).map((u) => <option key={u.slug} value={u.slug}>{u.title}</option>)}
            </select>
          </label>
          {!pickedUnit && <p className="self-end text-sm text-red-700">This course has no units yet.</p>}
        </div>
      )}

      <fieldset>
        <legend className="mb-1 font-medium">Type</legend>
        {(["case", "rule", "class"] as NoteType[]).map((t) => (
          <label key={t} className="mr-4">
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="mr-1" />
            {t}
          </label>
        ))}
      </fieldset>

      {FIELD_DEFS[type].map((f) => (
        <label key={f.key} className="block">
          <span className="font-medium">{f.label}</span>
          {f.hint && <span className="ml-2 text-sm text-gray-500">{f.hint}</span>}
          {f.kind === "text" || f.kind === "date" ? (
            <input type={f.kind === "date" ? "date" : "text"} name={f.key} value={fields[f.key] ?? ""} onChange={set(f.key)} className={inputCls} />
          ) : (
            <textarea name={f.key} value={fields[f.key] ?? ""} onChange={set(f.key)} rows={f.kind === "lines" ? 3 : 3} className={inputCls} />
          )}
        </label>
      ))}

      <fieldset>
        <legend className="font-medium">Topics</legend>
        {syllabusTopics.length === 0 ? (
          <p className="text-sm text-gray-500">No syllabusTopics in unit.json yet.</p>
        ) : (
          syllabusTopics.map((t) => (
            <label key={t} className="mr-4 inline-block">
              <input
                type="checkbox"
                name="topics"
                value={t}
                checked={topics.has(t)}
                onChange={(e) => setTopics((prev) => { const n = new Set(prev); if (e.target.checked) n.add(t); else n.delete(t); return n; })}
                className="mr-1"
              />
              {t}
            </label>
          ))
        )}
      </fieldset>

      <label className="block">
        <span className="font-medium">Body</span> <span className="text-sm text-gray-500">optional markdown</span>
        <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={inputCls} />
      </label>

      <p className="text-sm text-gray-600">
        File: <code className="font-mono">notes/{derivedSlug || "…"}.md</code>
        {clash && <span className="ml-2 font-medium text-red-700">A note with this filename already exists. Saving will fail; edit that note instead.</span>}
        {editing && <span className="ml-2 text-gray-500">(filename does not change on edit)</span>}
      </p>
      <p className="text-sm text-gray-600">Fields left empty are allowed: the note is saved as a draft until they are filled in.</p>

      {state.error && <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{state.error}</p>}

      <button type="submit" disabled={pending || (Boolean(pickers) && !pickedUnit)} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : editing ? "Save changes" : capture ? "File as note" : "Create note"}
      </button>
    </form>
  );
}
