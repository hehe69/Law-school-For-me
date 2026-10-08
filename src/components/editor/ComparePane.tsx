"use client";

// A friend's outline (.docx or .md) parsed into a read-only tree beside the editor. Never merged, never saved.

import { useState } from "react";
import type { ImportedNode } from "@/lib/importers";
import { Markdown } from "@/components/Markdown";

type Props = { name: string; tree: ImportedNode[]; count: number; onClose: () => void; onReplace: () => void };

function Branch({ node, depth, query }: { node: ImportedNode; depth: number; query: string }) {
  const [open, setOpen] = useState(true);
  const q = query.toLowerCase();
  const matches = (n: ImportedNode): boolean => !q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.children.some(matches);
  if (!matches(node)) return null;
  const show = q ? true : open;
  return (
    <div style={{ paddingLeft: depth ? 14 : 0 }}>
      <div className="flex items-start gap-1 py-0.5">
        <button type="button" className={`mt-0.5 w-4 shrink-0 text-[10px] text-gray-400 ${node.children.length ? "" : "invisible"}`} onClick={() => setOpen((o) => !o)}>
          {show ? "▼" : "▶"}
        </button>
        <div className="min-w-0">
          <div className={`text-sm ${depth === 0 ? "font-semibold" : depth === 1 ? "font-medium" : ""}`}>{node.title || "(untitled)"}</div>
          {node.body && show && <Markdown text={node.body} className="text-gray-600" />}
        </div>
      </div>
      {show && node.children.map((c, i) => <Branch key={i} node={c} depth={depth + 1} query={query} />)}
    </div>
  );
}

export function ComparePane({ name, tree, count, onClose, onReplace }: Props) {
  const [query, setQuery] = useState("");
  return (
    <div className="flex h-full min-h-0 flex-col border-r border-gray-200 bg-gray-50">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-2 py-1 text-xs">
        <span className="font-medium text-gray-700">Comparing: {name}</span>
        <span className="text-gray-400">{count} items · read only</span>
        <input className="input w-36 py-0 text-xs" placeholder="Filter…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="btn py-0 text-xs" onClick={onReplace}>
          Open another file
        </button>
        <button type="button" className="ml-auto text-gray-500 hover:text-gray-900" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {tree.length === 0 && <p className="text-sm text-gray-500">Nothing could be read from the file.</p>}
        {tree.map((n, i) => (
          <Branch key={i} node={n} depth={0} query={query} />
        ))}
      </div>
    </div>
  );
}
