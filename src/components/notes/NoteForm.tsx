"use client";

// New/edit note form. The type selector switches the fields shown; everything is controlled state so
// a failed save keeps what you typed. Saving posts to a server action which writes the markdown file.

import { useActionState, useRef, useState } from "react";
import { saveNoteAction, uploadImageAction, type NoteFormState } from "@/app/content-actions";
import type { Note, NoteType } from "@/lib/content/types";
import { slugify } from "@/lib/slug";

export type UnitOption = { slug: string; title: string; syllabusTopics: string[]; existingSlugs: string[] };
export type RuleOption = { ref: string; label: string };
export type CourseOption = { slug: string; title: string; units: UnitOption[]; ruleNotes: RuleOption[] };

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
  /** Rule notes in the course for the link pickers (ignored when pickers are given; each course carries its own) */
  ruleNotes?: RuleOption[];
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
    { key: "exceptions", label: "Exceptions", kind: "lines", hint: "one per line; start a line with @N to tie it to element N" },
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
  const fm = note.frontmatter;
  const out: Fields = {};
  for (const [k, v] of Object.entries(fm as unknown as Record<string, unknown>)) {
    if (k === "type" || k === "exceptionElements" || k === "relatedRules" || k === "wisconsinElement") continue;
    out[k] = Array.isArray(v) ? v.join("\n") : String(v ?? "");
  }
  if (fm.type === "rule") {
    // Linked exceptions show as "@N text" lines.
    out.exceptions = fm.exceptions.map((e, i) => (fm.exceptionElements[i] ? `@${fm.exceptionElements[i]} ${e}` : e)).join("\n");
    out.wisconsinElement = fm.wisconsinElement ? String(fm.wisconsinElement) : "";
  }
  return out;
}

export default function NoteForm(props: Props) {
  const { note, pickers, capture } = props;
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(saveNoteAction, { error: null });
  const [type, setType] = useState<NoteType>(note?.frontmatter.type ?? "case");
  const [fields, setFields] = useState<Fields>(() => (capture ? { date: capture.createdOn } : initialFields(note)));
  const [topics, setTopics] = useState<Set<string>>(() => new Set(note?.topics ?? []));
  const [related, setRelated] = useState<Set<string>>(() => new Set(note?.frontmatter.type === "rule" ? note.frontmatter.relatedRules : []));
  const [body, setBody] = useState(capture?.text ?? note?.body ?? "");
  const [courseSlug, setCourseSlug] = useState(props.courseSlug);
  const [unitSlug, setUnitSlug] = useState(props.unitSlug);
  const editing = Boolean(note);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [imageStatus, setImageStatus] = useState<string | null>(null);

  // Upload an image to the unit's images/ folder and insert its markdown at the cursor.
  async function addImage(file: File | undefined) {
    if (!file) return;
    setImageStatus("Uploading…");
    const fd = new FormData();
    fd.append("course", courseSlug);
    fd.append("unit", unitSlug);
    fd.append("file", file);
    const result = await uploadImageAction(fd);
    if (!result.ok) {
      setImageStatus(`Could not add image: ${result.error}`);
      return;
    }
    const el = bodyRef.current;
    const at = el ? el.selectionStart : body.length;
    const before = body.slice(0, at);
    const after = body.slice(at);
    const sep = before && !before.endsWith("\n") ? "\n\n" : "";
    setBody(`${before}${sep}${result.markdown}\n${after}`);
    setImageStatus(`Added images/${result.name}`);
  }

  // With pickers, the unit's topics and existing filenames follow the current selection.
  const pickedCourse = pickers?.find((c) => c.slug === courseSlug);
  const pickedUnit = pickedCourse?.units.find((u) => u.slug === unitSlug);
  const syllabusTopics = pickers ? (pickedUnit?.syllabusTopics ?? []) : props.syllabusTopics;
  const existingSlugs = pickers ? (pickedUnit?.existingSlugs ?? []) : props.existingSlugs;
  const ruleNotes = (pickers ? pickedCourse?.ruleNotes : props.ruleNotes) ?? [];
  const selfRef = note ? `${props.unitSlug}/notes/${note.slug}.md` : "";
  const elementLines = (fields.elements ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const modifiesIsRef = ruleNotes.some((r) => r.ref === (fields.modifiesRule ?? ""));
  const [modifiesMode, setModifiesMode] = useState<string>(() => (note?.frontmatter.type === "class" && note.frontmatter.modifiesRule && !modifiesIsRef ? "__text__" : (fields.modifiesRule ?? "")));

  function pickCourse(slug: string) {
    setCourseSlug(slug);
    const first = pickers?.find((c) => c.slug === slug)?.units[0]?.slug ?? "";
    setUnitSlug(first);
    setTopics(new Set());
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
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

      {FIELD_DEFS[type].map((f) => {
        if (type === "class" && f.key === "modifiesRule") {
          return (
            <div key={f.key}>
              <span className="font-medium">Modifies rule</span>
              <select
                name="modifiesRuleSelect"
                value={modifiesMode}
                onChange={(e) => { setModifiesMode(e.target.value); if (e.target.value !== "__text__") setFields((x) => ({ ...x, modifiesRule: e.target.value })); }}
                className="mt-1 block w-full rounded border border-gray-300 px-2 py-1"
              >
                <option value="">(none)</option>
                {ruleNotes.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}
                <option value="__text__">Free text…</option>
              </select>
              {modifiesMode === "__text__" ? (
                <input type="text" name="modifiesRule" value={modifiesIsRef ? "" : (fields.modifiesRule ?? "")} onChange={set("modifiesRule")} placeholder="Describe the rule this class changed" className={inputCls} />
              ) : (
                <input type="hidden" name="modifiesRule" value={modifiesMode} />
              )}
            </div>
          );
        }
        return (
          <label key={f.key} className="block">
            <span className="font-medium">{f.label}</span>
            {f.hint && <span className="ml-2 text-sm text-gray-500">{f.hint}</span>}
            {f.kind === "text" || f.kind === "date" ? (
              <input type={f.kind === "date" ? "date" : "text"} name={f.key} value={fields[f.key] ?? ""} onChange={set(f.key)} className={inputCls} />
            ) : (
              <textarea name={f.key} value={fields[f.key] ?? ""} onChange={set(f.key)} rows={f.kind === "lines" ? 3 : 3} className={inputCls} />
            )}
          </label>
        );
      })}

      {type === "case" && (
        <label className="block">
          <span className="font-medium">Applies rule</span> <span className="text-sm text-gray-500">optional link to a rule note</span>
          <select name="appliesRule" value={fields.appliesRule ?? ""} onChange={set("appliesRule")} className="mt-1 block w-full rounded border border-gray-300 px-2 py-1">
            <option value="">(none)</option>
            {ruleNotes.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}
          </select>
        </label>
      )}

      {type === "rule" && (
        <>
          <label className="block">
            <span className="font-medium">Wisconsin variation changes element</span>
            <select name="wisconsinElement" value={fields.wisconsinElement ?? ""} onChange={set("wisconsinElement")} className="mt-1 block rounded border border-gray-300 px-2 py-1">
              <option value="">(not tied to one element)</option>
              {elementLines.map((el, i) => <option key={i} value={i + 1}>{i + 1}. {el}</option>)}
            </select>
            <span className="ml-2 text-sm text-gray-500">Tie an exception to an element by starting its line with <code className="font-mono">@2 </code> (element 2).</span>
          </label>
          <fieldset>
            <legend className="font-medium">Related rules</legend>
            {ruleNotes.filter((r) => r.ref !== selfRef).length === 0 ? (
              <p className="text-sm text-gray-500">No other rule notes in this course yet.</p>
            ) : (
              ruleNotes.filter((r) => r.ref !== selfRef).map((r) => (
                <label key={r.ref} className="mr-4 inline-block text-sm">
                  <input
                    type="checkbox"
                    name="relatedRules"
                    value={r.ref}
                    checked={related.has(r.ref)}
                    onChange={(e) => setRelated((prev) => { const n = new Set(prev); if (e.target.checked) n.add(r.ref); else n.delete(r.ref); return n; })}
                    className="mr-1"
                  />
                  {r.label}
                </label>
              ))
            )}
          </fieldset>
        </>
      )}

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
        <textarea ref={bodyRef} name="body" value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={inputCls} />
      </label>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="cursor-pointer rounded border border-gray-300 px-3 py-1 hover:bg-gray-50">
          Add image
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.gif,.webp,.svg,image/*"
            className="hidden"
            onChange={(e) => { void addImage(e.target.files?.[0]); e.target.value = ""; }}
          />
        </label>
        <span className="text-gray-500">Uploads to the unit&apos;s images/ folder and inserts <code className="font-mono">![alt](images/file.png)</code> at the cursor.</span>
        {imageStatus && <span className="text-gray-700">{imageStatus}</span>}
      </div>

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
