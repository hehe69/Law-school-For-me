"use client";

// A modal list of nodes to pick one from: for cross-links and for "move to". Type to filter, arrows + Enter.

import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeType } from "@/lib/types";
import { NODE_TYPE_DEFS } from "@/lib/fields";

export type PickerItem = { id: string; title: string; type: NodeType; depth: number };

type Props = {
  open: boolean;
  title: string;
  items: PickerItem[];
  /** Adds a "Top level" choice that picks null */
  allowTopLevel?: boolean;
  onPick: (id: string | null) => void;
  onClose: () => void;
  /** Extra controls rendered above the list (an outline selector) */
  header?: React.ReactNode;
};

export function NodePicker({ open, title, items, allowTopLevel, onPick, onClose, header }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: (PickerItem | null)[] = [];
    if (allowTopLevel && (!q || "top level".includes(q))) list.push(null);
    if (!q) return [...list, ...items].slice(0, 200);
    // Exact titles first, then titles that start with the query, then titles that contain it, in document order.
    const exact: PickerItem[] = [];
    const starts: PickerItem[] = [];
    const contains: PickerItem[] = [];
    for (const it of items) {
      const t = it.title.toLowerCase();
      if (t === q) exact.push(it);
      else if (t.startsWith(q)) starts.push(it);
      else if (t.includes(q)) contains.push(it);
    }
    return [...list, ...exact, ...starts, ...contains].slice(0, 200);
  }, [items, query, allowTopLevel]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[12vh]" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="border-b border-gray-200 px-4 py-2 text-sm font-medium">{title}</div>
        {header && <div className="border-b border-gray-200 px-4 py-2">{header}</div>}
        <input
          autoFocus
          className="w-full border-b border-gray-200 px-4 py-2 text-sm outline-none"
          placeholder="Type to filter…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIndex(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (index < filtered.length) onPick(filtered[index]?.id ?? null);
            }
          }}
        />
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && <div className="px-4 py-3 text-sm text-gray-500">Nothing matches.</div>}
          {filtered.map((it, i) => (
            <button
              key={it ? it.id : "top"}
              type="button"
              data-index={i}
              className={`flex w-full items-center gap-2 px-4 py-1 text-left text-sm ${i === index ? "bg-blue-50" : "hover:bg-gray-50"}`}
              style={{ paddingLeft: 16 + (it ? it.depth * 14 : 0) }}
              onMouseEnter={() => setIndex(i)}
              onClick={() => onPick(it?.id ?? null)}
            >
              {it ? (
                <>
                  <span className="w-5 shrink-0 rounded border border-gray-300 text-center font-mono text-[10px] leading-4 text-gray-500">{NODE_TYPE_DEFS[it.type].badge}</span>
                  <span className="truncate">{it.title || "(untitled)"}</span>
                </>
              ) : (
                <span className="italic text-gray-600">Top level</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
