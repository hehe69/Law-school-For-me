"use client";

// Study-app import: tick units or notes, choose the outline and parent, import.

import { useState } from "react";
import type { NodeType, OutlineKind } from "@/lib/types";
import type { StudyUnit } from "@/lib/studyapp";

type OutlineWithNodes = { id: string; name: string; kind: OutlineKind; isDefault: boolean; nodes: { id: string; title: string; type: NodeType; depth: number }[] };

const KIND_LABEL = { rule: "rule", case: "case", class: "class note" } as const;

export function ImportForm({
  courseId,
  units,
  importedPaths,
  outlines,
  action,
}: {
  courseId: number;
  units: StudyUnit[];
  importedPaths: string[];
  outlines: OutlineWithNodes[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const imported = new Set(importedPaths);
  const defaultOutline = outlines.find((o) => o.isDefault && o.kind === "full") ?? outlines.find((o) => o.kind === "full") ?? outlines[0];
  const [outlineId, setOutlineId] = useState(defaultOutline?.id ?? "");
  const [checkedUnits, setCheckedUnits] = useState<Set<string>>(new Set());
  const [checkedNotes, setCheckedNotes] = useState<Set<string>>(new Set());
  const outline = outlines.find((o) => o.id === outlineId);
  const toggle = (set: Set<string>, key: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(key);
    else next.delete(key);
    return next;
  };

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="courseId" value={courseId} />
      <ul className="divide-y divide-gray-200 rounded border border-gray-200 text-sm">
        {units.map((u) => (
          <li key={u.slug} className="p-3">
            <label className="flex items-center gap-2 font-medium">
              <input type="checkbox" name="unit" value={u.slug} checked={checkedUnits.has(u.slug)} onChange={(e) => setCheckedUnits(toggle(checkedUnits, u.slug, e.target.checked))} />
              {u.title}
              <span className="text-xs font-normal text-gray-400">whole unit as a heading with its notes</span>
            </label>
            {u.syllabusTopics.length > 0 && <div className="ml-6 mt-0.5 text-xs text-gray-400">Topics: {u.syllabusTopics.join(", ")}</div>}
            <ul className="ml-6 mt-1 space-y-0.5">
              {u.notes.map((n) => {
                const done = imported.has(n.path);
                return (
                  <li key={n.path} className={`flex items-center gap-2 ${done ? "text-gray-400" : ""}`}>
                    <input
                      type="checkbox"
                      name="note"
                      value={n.path}
                      disabled={done || checkedUnits.has(u.slug)}
                      checked={checkedNotes.has(n.path)}
                      onChange={(e) => setCheckedNotes(toggle(checkedNotes, n.path, e.target.checked))}
                    />
                    <span className="w-16 shrink-0 rounded bg-gray-100 px-1 text-center text-[10px] uppercase tracking-wide text-gray-500">{KIND_LABEL[n.kind]}</span>
                    <span>{n.title}</span>
                    {done && <span className="text-xs">already imported</span>}
                  </li>
                );
              })}
              {u.notes.length === 0 && <li className="text-xs text-gray-400">no notes</li>}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="import-outline">
            Into outline
          </label>
          <select id="import-outline" name="outlineId" className="input w-48" value={outlineId} onChange={(e) => setOutlineId(e.target.value)}>
            {outlines.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.kind})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="import-parent">
            Under
          </label>
          <select id="import-parent" name="parentId" className="input w-64" defaultValue="">
            <option value="">Top level (at the end)</option>
            {outline?.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {"  ".repeat(n.depth)}
                {n.title || "(untitled)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="import-status">
            Status of new nodes
          </label>
          <select id="import-status" name="status" className="input w-32" defaultValue="drafted">
            <option value="skeleton">Skeleton</option>
            <option value="drafted">Drafted</option>
            <option value="final">Final</option>
          </select>
        </div>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="topics" defaultChecked /> add the units&apos; syllabus topics to the course
        </label>
        <button type="submit" className="btn-primary" disabled={checkedUnits.size === 0 && checkedNotes.size === 0}>
          Import {checkedUnits.size + checkedNotes.size || ""}
        </button>
      </div>
    </form>
  );
}
