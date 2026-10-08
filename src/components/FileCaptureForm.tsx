"use client";

// The "file as node" form: prefilled from the capture; pick type, status, outline and placement.

import { useState } from "react";
import type { Capture, NodeType, OutlineKind } from "@/lib/types";
import { NODE_STATUSES, NODE_TYPES } from "@/lib/types";
import { NODE_TYPE_DEFS, STATUS_LABELS } from "@/lib/fields";
import { fileCaptureAction } from "@/app/capture-actions";

type OutlineWithNodes = {
  id: string;
  name: string;
  kind: OutlineKind;
  isDefault: boolean;
  nodes: { id: string; title: string; type: NodeType; depth: number }[];
};

export function FileCaptureForm({ capture, outlines, topics }: { capture: Capture; outlines: OutlineWithNodes[]; topics: string[] }) {
  const lines = capture.text.split("\n");
  const firstLine = lines[0].trim().slice(0, 140);
  const rest = lines.slice(1).join("\n").trim();
  const defaultOutline = outlines.find((o) => o.isDefault && o.kind === "full") ?? outlines.find((o) => o.kind === "full") ?? outlines[0];
  const [outlineId, setOutlineId] = useState(defaultOutline?.id ?? "");
  const outline = outlines.find((o) => o.id === outlineId);

  return (
    <form action={fileCaptureAction} className="card mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="captureId" value={capture.id} />
      <div className="sm:col-span-2">
        <label className="label" htmlFor="title">
          Title
        </label>
        <input id="title" name="title" className="input" defaultValue={firstLine} required />
      </div>
      <div>
        <label className="label" htmlFor="type">
          Type
        </label>
        <select id="type" name="type" className="input" defaultValue="free">
          {NODE_TYPES.map((t) => (
            <option key={t} value={t}>
              {NODE_TYPE_DEFS[t].label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="status">
          Status
        </label>
        <select id="status" name="status" className="input" defaultValue="drafted">
          {NODE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="outlineId">
          Outline
        </label>
        <select id="outlineId" name="outlineId" className="input" value={outlineId} onChange={(e) => setOutlineId(e.target.value)}>
          {outlines.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.kind})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="parentId">
          Place under
        </label>
        <select id="parentId" name="parentId" className="input" defaultValue="">
          <option value="">Top level (at the end)</option>
          {outline?.nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {"  ".repeat(n.depth)}
              {n.title || "(untitled)"}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="tags">
          Tags (comma separated)
        </label>
        <input id="tags" name="tags" className="input" list="topic-list" placeholder={topics.slice(0, 3).join(", ")} />
        <datalist id="topic-list">
          {topics.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="body">
          Notes (markdown)
        </label>
        <textarea id="body" name="body" className="input" rows={6} defaultValue={rest || (lines.length === 1 ? "" : capture.text)} />
        <p className="mt-1 text-xs text-gray-400">The typed fields of the chosen type can be filled in the editor once the node exists.</p>
      </div>
      <div className="sm:col-span-2">
        <button type="submit" className="btn-primary">
          Create node and open it
        </button>
      </div>
    </form>
  );
}
