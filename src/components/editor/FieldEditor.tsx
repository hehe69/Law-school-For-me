"use client";

// Generic editor for one typed field, driven by the FieldSpec. Used by the side panel.

import { useState, type KeyboardEvent } from "react";
import type { FieldSpec } from "@/lib/fields";
import { asElements, asExceptions, asList, asTable, FLAG_COLORS, type ElementField, type ExceptionField, type TableField } from "@/lib/fields";
import type { OutlineNode } from "@/lib/types";

type Props = {
  spec: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
  onEscape: () => void;
  /** For "node" fields: the nodes to pick from (same outline) */
  nodes: OutlineNode[];
  /** For "exceptions": the elements of this rule, to tie an exception to one */
  elements?: ElementField[];
};

const FLAG_COLOR_CLASS: Record<string, string> = {
  red: "bg-red-500",
  amber: "bg-amber-400",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  grey: "bg-gray-400",
};

function escapeKey(e: KeyboardEvent, onEscape: () => void) {
  if (e.key === "Escape") {
    e.preventDefault();
    onEscape();
  }
}

export function FieldEditor({ spec, value, onChange, onEscape, nodes, elements }: Props) {
  switch (spec.kind) {
    case "text":
    case "date":
      return (
        <input
          type={spec.kind === "date" ? "date" : "text"}
          className="input"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => escapeKey(e, onEscape)}
        />
      );
    case "textarea":
      return <MarkdownArea value={typeof value === "string" ? value : ""} onChange={onChange} onEscape={onEscape} hidden={spec.hiddenByDefault} />;
    case "list":
      return <ListEditor items={asList(value)} onChange={onChange} onEscape={onEscape} />;
    case "elements":
      return <ElementsEditor items={asElements(value)} onChange={onChange} onEscape={onEscape} />;
    case "exceptions":
      return <ExceptionsEditor items={asExceptions(value)} elements={elements ?? []} onChange={onChange} onEscape={onEscape} />;
    case "node":
      return (
        <select className="input" value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value || null)} onKeyDown={(e) => escapeKey(e, onEscape)}>
          <option value="">— none —</option>
          {nodes
            .filter((n) => n.type === "rule" || n.type === "heading" || n.type === "statute")
            .map((n) => (
              <option key={n.id} value={n.id}>
                {n.title || "(untitled)"}
              </option>
            ))}
        </select>
      );
    case "table":
      return <TableEditor table={asTable(value)} onChange={onChange} onEscape={onEscape} />;
    case "color":
      return (
        <div className="flex gap-2">
          {FLAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => onChange(c)}
              className={`h-6 w-6 rounded-full ${FLAG_COLOR_CLASS[c]} ${value === c ? "ring-2 ring-offset-2 ring-gray-700" : "opacity-70 hover:opacity-100"}`}
            />
          ))}
        </div>
      );
    default:
      return null;
  }
}

function MarkdownArea({ value, onChange, onEscape, hidden }: { value: string; onChange: (v: string) => void; onEscape: () => void; hidden?: boolean }) {
  const [revealed, setRevealed] = useState(!hidden);
  if (!revealed) {
    return (
      <button type="button" className="btn" onClick={() => setRevealed(true)}>
        Reveal {value.trim() ? "" : "(empty)"}
      </button>
    );
  }
  return (
    <textarea
      className="input min-h-[4.5rem] resize-y font-[inherit]"
      rows={Math.min(12, Math.max(3, value.split("\n").length + 1))}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => escapeKey(e, onEscape)}
    />
  );
}

function ListEditor({ items, onChange, onEscape }: { items: string[]; onChange: (v: string[]) => void; onEscape: () => void }) {
  const update = (i: number, text: string) => onChange(items.map((it, j) => (j === i ? text : it)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="w-5 text-right text-xs text-gray-400">{i + 1}.</span>
          <input
            className="input"
            value={item}
            onChange={(e) => update(i, e.target.value)}
            onKeyDown={(e) => {
              escapeKey(e, onEscape);
              if (e.key === "Enter") {
                e.preventDefault();
                onChange([...items.slice(0, i + 1), "", ...items.slice(i + 1)]);
              }
              if (e.key === "Backspace" && item === "" && items.length > 0) {
                e.preventDefault();
                remove(i);
              }
            }}
          />
          <button type="button" className="text-gray-400 hover:text-red-600" title="Remove" onClick={() => remove(i)}>
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...items, ""])}>
        + Add
      </button>
    </div>
  );
}

function ElementsEditor({ items, onChange, onEscape }: { items: ElementField[]; onChange: (v: ElementField[]) => void; onEscape: () => void }) {
  const update = (i: number, patch: Partial<ElementField>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded border border-gray-200 p-2">
          <div className="flex items-center gap-1">
            <span className="w-5 text-right text-xs text-gray-400">{i + 1}.</span>
            <input
              className="input"
              placeholder="Element"
              value={item.text}
              onChange={(e) => update(i, { text: e.target.value })}
              onKeyDown={(e) => {
                escapeKey(e, onEscape);
                if (e.key === "Enter") {
                  e.preventDefault();
                  onChange([...items.slice(0, i + 1), { text: "", definition: "" }, ...items.slice(i + 1)]);
                }
              }}
            />
            <button type="button" className="px-1 text-gray-400 hover:text-gray-700" title="Move up" onClick={() => move(i, -1)}>
              ↑
            </button>
            <button type="button" className="px-1 text-gray-400 hover:text-gray-700" title="Move down" onClick={() => move(i, 1)}>
              ↓
            </button>
            <button type="button" className="px-1 text-gray-400 hover:text-red-600" title="Remove" onClick={() => remove(i)}>
              ×
            </button>
          </div>
          <input
            className="input mt-1 text-xs"
            placeholder="Definition (optional)"
            value={item.definition}
            onChange={(e) => update(i, { definition: e.target.value })}
            onKeyDown={(e) => escapeKey(e, onEscape)}
          />
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...items, { text: "", definition: "" }])}>
        + Add element
      </button>
    </div>
  );
}

function ExceptionsEditor({
  items,
  elements,
  onChange,
  onEscape,
}: {
  items: ExceptionField[];
  elements: ElementField[];
  onChange: (v: ExceptionField[]) => void;
  onEscape: () => void;
}) {
  const update = (i: number, patch: Partial<ExceptionField>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="rounded border border-gray-200 p-2">
          <div className="flex items-center gap-1">
            <input
              className="input"
              placeholder="Exception"
              value={item.text}
              onChange={(e) => update(i, { text: e.target.value })}
              onKeyDown={(e) => {
                escapeKey(e, onEscape);
                if (e.key === "Enter") {
                  e.preventDefault();
                  onChange([...items.slice(0, i + 1), { text: "", element: null }, ...items.slice(i + 1)]);
                }
              }}
            />
            <button type="button" className="px-1 text-gray-400 hover:text-red-600" title="Remove" onClick={() => remove(i)}>
              ×
            </button>
          </div>
          <select className="input mt-1 text-xs" value={item.element ?? ""} onChange={(e) => update(i, { element: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Defeats: (not tied to an element)</option>
            {elements.map((el, j) => (
              <option key={j} value={j + 1}>
                Defeats element {j + 1}: {el.text || "(untitled)"}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...items, { text: "", element: null }])}>
        + Add exception
      </button>
    </div>
  );
}

function TableEditor({ table, onChange, onEscape }: { table: TableField; onChange: (v: TableField) => void; onEscape: () => void }) {
  const cols = Math.max(table.columns.length, ...table.rows.map((r) => r.length), 1);
  const columns = Array.from({ length: cols }, (_, i) => table.columns[i] ?? "");
  const rows = table.rows.map((r) => Array.from({ length: cols }, (_, i) => r[i] ?? ""));
  const setColumn = (i: number, v: string) => onChange({ columns: columns.map((c, j) => (j === i ? v : c)), rows });
  const setCell = (r: number, c: number, v: string) => onChange({ columns, rows: rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? v : cell)) : row)) });
  return (
    <div className="space-y-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="border border-gray-300 p-0">
                <input className="w-full bg-gray-50 px-1 py-1 font-medium outline-none" placeholder={`Column ${i + 1}`} value={c} onChange={(e) => setColumn(i, e.target.value)} onKeyDown={(e) => escapeKey(e, onEscape)} />
              </th>
            ))}
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border border-gray-300 p-0">
                  <input className="w-full px-1 py-1 outline-none" value={cell} onChange={(e) => setCell(r, c, e.target.value)} onKeyDown={(e) => escapeKey(e, onEscape)} />
                </td>
              ))}
              <td className="text-center">
                <button type="button" className="text-gray-400 hover:text-red-600" title="Remove row" onClick={() => onChange({ columns, rows: rows.filter((_, i) => i !== r) })}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={() => onChange({ columns, rows: [...rows, columns.map(() => "")] })}>
          + Row
        </button>
        <button type="button" className="btn" onClick={() => onChange({ columns: [...columns, ""], rows: rows.map((r) => [...r, ""]) })}>
          + Column
        </button>
        <button
          type="button"
          className="btn"
          disabled={columns.length <= 1}
          onClick={() => onChange({ columns: columns.slice(0, -1), rows: rows.map((r) => r.slice(0, -1)) })}
        >
          − Column
        </button>
      </div>
    </div>
  );
}
