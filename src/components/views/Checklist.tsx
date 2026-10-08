"use client";

// Issue checklist: every heading and rule as a tickable list grouped by top-level section. Ticks live in the
// browser (localStorage) per outline so a practice run can be reset; the page prints as one compact sheet.

import Link from "next/link";
import { useState } from "react";
import type { NodeMap, NumberingStyle, OutlineNode } from "@/lib/types";
import { childrenOf, flatten } from "@/lib/tree";
import { numberingLabel } from "@/lib/numbering";
import { fieldString } from "@/lib/fields";
import { useLocalStorage } from "@/lib/useLocalStorage";

type Props = { outlineId: string; outlineName: string; courseTitle: string; courseSlug: string; nodes: OutlineNode[]; numbering: NumberingStyle };

const NONE: string[] = [];

export function Checklist({ outlineId, outlineName, courseTitle, courseSlug, nodes, numbering }: Props) {
  const [tickedList, setTickedList] = useLocalStorage<string[]>(`checklist:${outlineId}`, NONE);
  const ticked = new Set(tickedList);
  const [showStatements, setShowStatements] = useState(false);
  const toggle = (id: string) => setTickedList((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const reset = () => setTickedList([]);

  const map: NodeMap = {};
  for (const n of nodes) map[n.id] = n;
  const groups = childrenOf(map, null).map((top, i) => ({
    top,
    label: numberingLabel(numbering, [i]),
    items: flatten(map, false, top.id)
      .slice(1)
      .filter((r) => r.node.type === "heading" || r.node.type === "rule"),
  }));
  const total = groups.reduce((n, g) => n + g.items.length + 1, 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-6">
      <div className="flex flex-wrap items-center gap-3 print-hidden">
        <h1 className="text-xl font-semibold">Issue checklist</h1>
        <span className="text-sm text-gray-500">
          {courseTitle} · {outlineName} · {ticked.size}/{total} ticked
        </span>
        <span className="ml-auto" />
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={showStatements} onChange={(e) => setShowStatements(e.target.checked)} /> rule statements
        </label>
        <button type="button" className="btn" onClick={reset}>
          Reset ticks
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          Print
        </button>
        <Link href={`/courses/${courseSlug}/outlines/${outlineId}`} className="btn">
          Editor
        </Link>
      </div>
      <h1 className="hidden text-lg font-semibold print:block">
        {courseTitle} — issue checklist ({outlineName})
      </h1>
      <div className="checklist-columns mt-4">
        {groups.map((g) => (
          <div key={g.top.id} className="checklist-group mb-4">
            <label className="flex items-start gap-2 text-sm font-semibold">
              <input type="checkbox" className="mt-1" checked={ticked.has(g.top.id)} onChange={() => toggle(g.top.id)} />
              <span>
                <span className="font-mono text-gray-500">{g.label}</span> {g.top.title || "(untitled)"}
              </span>
            </label>
            {g.items.map((r) => (
              <label key={r.node.id} className="flex items-start gap-2 text-sm" style={{ paddingLeft: 8 + (r.depth - 1) * 14 }}>
                <input type="checkbox" className="mt-1" checked={ticked.has(r.node.id)} onChange={() => toggle(r.node.id)} />
                <span className={ticked.has(r.node.id) ? "text-gray-400 line-through" : ""}>
                  <span className="font-mono text-xs text-gray-500">{numberingLabel(numbering, r.path)}</span> {r.node.title || "(untitled)"}
                  {r.node.type === "rule" && <span className="ml-1 rounded border border-gray-300 px-1 font-mono text-[10px] text-gray-500">R</span>}
                  {showStatements && r.node.type === "rule" && fieldString(r.node, "ruleStatement") && <span className="block text-xs text-gray-600">{fieldString(r.node, "ruleStatement")}</span>}
                </span>
              </label>
            ))}
          </div>
        ))}
        {groups.length === 0 && <p className="text-sm text-gray-500">The outline is empty.</p>}
      </div>
    </div>
  );
}
