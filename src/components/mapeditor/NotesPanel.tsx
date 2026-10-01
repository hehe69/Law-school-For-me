"use client";

// "Add from notes": drag a note or element onto the canvas, and "Sync": what has no box, and boxes with missing notes.

import { useState } from "react";
import type { AnyNode, BoxData, NoteInfo } from "./model";
import { isGroup } from "./model";

export type DragPayload = { path: string; element?: number; withElements?: boolean };

export const DRAG_TYPE = "application/x-lawstudy-note";

type Props = { notes: NoteInfo[]; nodes: AnyNode[]; onAdd: (payload: DragPayload) => void; onSelectNode: (id: string) => void };

export default function NotesPanel({ notes, nodes, onAdd, onSelectNode }: Props) {
  const [withElements, setWithElements] = useState(true);
  const [tab, setTab] = useState<"add" | "sync">("add");
  const boxes = nodes.filter((n) => !isGroup(n)) as { id: string; data: BoxData }[];
  const linked = new Set(boxes.filter((b) => b.data.linkedNote).map((b) => `${b.data.linkedNote}#${b.data.linkedElement ?? 0}`));
  const notePaths = new Set(notes.map((n) => n.path));
  const missingNotes = boxes.filter((b) => b.data.linkedNote && !notePaths.has(b.data.linkedNote));
  const missingElements = boxes.filter((b) => b.data.linkedNote && b.data.linkedElement && notePaths.has(b.data.linkedNote) && !notes.find((n) => n.path === b.data.linkedNote)?.elements?.some((e) => e.index === b.data.linkedElement));
  const unplaced = notes.flatMap((n) => {
    const out: { label: string; payload: DragPayload; kind: string }[] = [];
    if (!linked.has(`${n.path}#0`)) out.push({ label: n.title, payload: { path: n.path }, kind: n.kind });
    for (const el of n.elements ?? []) if (!linked.has(`${n.path}#${el.index}`)) out.push({ label: `${n.title} › ${el.index}. ${el.text}`, payload: { path: n.path, element: el.index }, kind: "element" });
    return out;
  });

  const byUnit = new Map<string, NoteInfo[]>();
  for (const n of notes) byUnit.set(n.unitTitle, [...(byUnit.get(n.unitTitle) ?? []), n]);

  const start = (e: React.DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };
  const item = "flex cursor-grab items-center gap-2 rounded border border-gray-200 bg-white px-2 py-1 text-xs hover:bg-gray-50";

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-gray-50 p-2 text-sm">
      <div className="mb-2 flex gap-2 text-xs">
        <button type="button" onClick={() => setTab("add")} className={`rounded px-2 py-0.5 ${tab === "add" ? "bg-gray-800 text-white" : "border border-gray-300"}`}>Add from notes</button>
        <button type="button" onClick={() => setTab("sync")} className={`rounded px-2 py-0.5 ${tab === "sync" ? "bg-gray-800 text-white" : "border border-gray-300"}`}>Sync ({unplaced.length + missingNotes.length + missingElements.length})</button>
      </div>

      {tab === "add" && (
        <>
          <p className="mb-2 text-xs text-gray-600">Drag onto the canvas, or click + to place at the centre. Linked boxes show 🔗 and read their text from the note.</p>
          <label className="mb-2 flex items-center gap-1 text-xs"><input type="checkbox" checked={withElements} onChange={(e) => setWithElements(e.target.checked)} /> Drop rules with their elements laid out beneath</label>
          {[...byUnit.entries()].map(([unitTitle, list]) => (
            <div key={unitTitle} className="mb-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{unitTitle}</p>
              <ul className="space-y-1">
                {list.map((n) => (
                  <li key={n.path}>
                    <div draggable onDragStart={(e) => start(e, { path: n.path, withElements: n.kind === "rule" && withElements })} className={item}>
                      <span className="rounded bg-gray-200 px-1 text-[10px]">{n.kind}</span>
                      <span className="flex-1 truncate" title={n.title}>{n.title}</span>
                      {linked.has(`${n.path}#0`) && <span title="Already on the canvas">✓</span>}
                      <button type="button" onClick={() => onAdd({ path: n.path, withElements: n.kind === "rule" && withElements })} className="rounded border border-gray-300 px-1 leading-4">+</button>
                    </div>
                    {n.elements && n.elements.length > 0 && (
                      <ul className="ml-4 mt-1 space-y-0.5">
                        {n.elements.map((el) => (
                          <li key={el.index} draggable onDragStart={(e) => start(e, { path: n.path, element: el.index })} className={item}>
                            <span className="text-gray-500">{el.index}.</span>
                            <span className="flex-1 truncate" title={el.text}>{el.text}</span>
                            {linked.has(`${n.path}#${el.index}`) && <span title="Already on the canvas">✓</span>}
                            <button type="button" onClick={() => onAdd({ path: n.path, element: el.index })} className="rounded border border-gray-300 px-1 leading-4">+</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {notes.length === 0 && <p className="text-xs text-gray-500">No rule, case, or class notes yet.</p>}
        </>
      )}

      {tab === "sync" && (
        <>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Notes and elements with no box ({unplaced.length})</p>
          {unplaced.length === 0 ? <p className="mb-3 text-xs text-gray-500">Everything is on the canvas.</p> : (
            <ul className="mb-3 space-y-1">
              {unplaced.map((u) => (
                <li key={`${u.payload.path}#${u.payload.element ?? 0}`} draggable onDragStart={(e) => start(e, u.payload)} className={item}>
                  <span className="rounded bg-gray-200 px-1 text-[10px]">{u.kind}</span>
                  <span className="flex-1 truncate" title={u.label}>{u.label}</span>
                  <button type="button" onClick={() => onAdd(u.payload)} className="rounded border border-gray-300 px-1 leading-4">+</button>
                </li>
              ))}
            </ul>
          )}
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Boxes whose note is gone ({missingNotes.length + missingElements.length})</p>
          {missingNotes.length + missingElements.length === 0 ? <p className="text-xs text-gray-500">None.</p> : (
            <ul className="space-y-1">
              {[...missingNotes, ...missingElements].map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => onSelectNode(b.id)} className="text-left text-xs text-red-800 underline">{b.data.label}</button>
                  <span className="ml-1 text-xs text-gray-500">{b.data.linkedNote}{b.data.linkedElement ? ` · element ${b.data.linkedElement}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </aside>
  );
}
