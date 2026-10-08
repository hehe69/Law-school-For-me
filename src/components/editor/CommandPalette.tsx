"use client";

// Cmd-K: jump to any node or run any command. Type to filter; arrows and Enter to pick.

import { useEffect, useMemo, useRef, useState } from "react";

export type PaletteItem = {
  id: string;
  label: string;
  /** What the query is matched against first (a node's title without its number); defaults to the label */
  keywords?: string;
  /** Smaller text after the label: a node's path, a command's shortcut */
  detail?: string;
  group: "Commands" | "Nodes";
  run: () => void;
};

type Props = {
  open: boolean;
  items: PaletteItem[];
  onClose: () => void;
};

/** 0 = the title starts with the query, 1 = the title contains every word, 2 = only the detail matches, -1 = no match. */
function score(query: string, item: PaletteItem): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const title = (item.keywords ?? item.label).toLowerCase();
  const words = q.split(/\s+/);
  if (title.startsWith(q)) return 0;
  if (words.every((w) => title.includes(w))) return 1;
  const all = `${item.label} ${item.detail ?? ""}`.toLowerCase();
  if (words.every((w) => all.includes(w))) return 2;
  return -1;
}

export function CommandPalette({ open, items, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // The editor remounts the palette (new key) each time it opens, so the query and index start fresh and
  // autoFocus lands on the input.
  const filtered = useMemo(() => {
    const q = query.startsWith(">") ? query.slice(1) : query;
    const onlyCommands = query.startsWith(">");
    const scored = items
      .filter((it) => !onlyCommands || it.group === "Commands")
      .map((it, i) => ({ it, s: score(q, it), i }))
      .filter((x) => x.s >= 0);
    // Best matches first; among equals, commands before nodes, then the original order.
    scored.sort((a, b) => a.s - b.s || (a.it.group === b.it.group ? a.i - b.i : a.it.group === "Commands" ? -1 : 1));
    return scored.map((x) => x.it).slice(0, 60);
  }, [items, query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 pt-[12vh]" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-lg border border-gray-200 bg-white shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          autoFocus
          className="w-full border-b border-gray-200 px-4 py-3 text-sm outline-none"
          placeholder="Jump to a node or run a command (type > for commands only)"
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
              const item = filtered[index];
              if (item) {
                onClose();
                item.run();
              }
            }
          }}
        />
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.length === 0 && <div className="px-4 py-3 text-sm text-gray-500">Nothing matches.</div>}
          {filtered.map((item, i) => (
            <button
              key={item.id}
              type="button"
              data-index={i}
              className={`flex w-full items-center gap-3 px-4 py-1.5 text-left text-sm ${i === index ? "bg-blue-50" : "hover:bg-gray-50"}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                onClose();
                item.run();
              }}
            >
              <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-gray-400">{item.group === "Commands" ? "command" : "node"}</span>
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.detail && <span className="shrink-0 truncate text-xs text-gray-400">{item.detail}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
