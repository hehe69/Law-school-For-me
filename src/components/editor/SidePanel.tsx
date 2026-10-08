"use client";

// The right-hand panel: title, type, status, tags, typed fields and the markdown body of the active node.
// Links, sources and images join it in phase 2.

import { useEffect, useRef, type KeyboardEvent } from "react";
import type { NodeStatus, NodeType, OutlineNode } from "@/lib/types";
import { NODE_STATUSES, NODE_TYPES } from "@/lib/types";
import { asElements, NODE_TYPE_DEFS, STATUS_LABELS, typeDef } from "@/lib/fields";
import { FieldEditor } from "./FieldEditor";

type Props = {
  node: OutlineNode | null;
  nodes: OutlineNode[];
  skeleton: boolean;
  topicSuggestions: string[];
  onPatch: (id: string, patch: Partial<OutlineNode>, coalesceKey?: string) => void;
  onField: (id: string, key: string, value: unknown) => void;
  onRetype: (id: string, type: NodeType) => void;
  onEscape: () => void;
  onClose: () => void;
  /** Set when the panel should focus its first field (after "edit fields" from the tree) */
  focusToken: number;
};

export function SidePanel({ node, nodes, skeleton, topicSuggestions, onPatch, onField, onRetype, onEscape, onClose, focusToken }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusToken > 0) titleRef.current?.focus();
  }, [focusToken]);

  if (!node) {
    return (
      <aside className="flex w-full flex-col border-l border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
        <p>Select a node to edit its fields.</p>
        <button type="button" className="btn mt-3 self-start" onClick={onClose}>
          Hide panel
        </button>
      </aside>
    );
  }

  const def = typeDef(node.type);
  const esc = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onEscape();
    }
  };
  const elements = node.type === "rule" ? asElements(node.fields.elements) : undefined;

  return (
    <aside className="flex w-full flex-col overflow-y-auto border-l border-gray-200 bg-gray-50 p-4 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">{def.label}</span>
        <button type="button" className="text-xs text-gray-500 hover:text-gray-900" onClick={onClose}>
          Hide panel
        </button>
      </div>

      <label className="label mt-3" htmlFor="panel-title">
        {def.titleLabel}
      </label>
      <input id="panel-title" ref={titleRef} className="input" value={node.title} onChange={(e) => onPatch(node.id, { title: e.target.value }, `title:${node.id}`)} onKeyDown={esc} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="panel-type">
            Type
          </label>
          <select id="panel-type" className="input" value={node.type} onChange={(e) => onRetype(node.id, e.target.value as NodeType)} onKeyDown={esc}>
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>
                {NODE_TYPE_DEFS[t].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="panel-status">
            Status
          </label>
          <select id="panel-status" className="input" value={node.status} onChange={(e) => onPatch(node.id, { status: e.target.value as NodeStatus })} onKeyDown={esc}>
            {NODE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {skeleton ? (
        <p className="mt-4 rounded border border-dashed border-gray-300 p-3 text-xs text-gray-500">Skeleton mode hides every field except the title. Turn it off in the toolbar to fill the fields.</p>
      ) : (
        <>
          <div className="mt-3">
            <label className="label" htmlFor="panel-tags">
              Tags
            </label>
            <input
              id="panel-tags"
              className="input"
              list="topic-suggestions"
              placeholder="comma separated"
              value={node.tags.join(", ")}
              onChange={(e) =>
                onPatch(
                  node.id,
                  {
                    tags: Array.from(
                      new Set(
                        e.target.value
                          .split(",")
                          .map((t) => t.trim())
                          .filter(Boolean),
                      ),
                    ),
                  },
                  `tags:${node.id}`,
                )
              }
              onKeyDown={esc}
            />
            <datalist id="topic-suggestions">
              {topicSuggestions.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>

          {def.fields.map((spec) => (
            <div key={spec.key} className="mt-3">
              <label className="label">{spec.label}</label>
              <FieldEditor spec={spec} value={node.fields[spec.key]} onChange={(v) => onField(node.id, spec.key, v)} onEscape={onEscape} nodes={nodes} elements={elements} />
              {spec.hint && <p className="mt-1 text-xs text-gray-400">{spec.hint}</p>}
            </div>
          ))}

          <div className="mt-3">
            <label className="label" htmlFor="panel-body">
              {node.type === "free" ? "Markdown" : "Notes (markdown)"}
            </label>
            <textarea
              id="panel-body"
              className="input min-h-[6rem] resize-y font-[inherit]"
              rows={Math.min(16, Math.max(4, node.body.split("\n").length + 1))}
              value={node.body}
              onChange={(e) => onPatch(node.id, { body: e.target.value }, `body:${node.id}`)}
              onKeyDown={esc}
            />
          </div>
        </>
      )}

      <div className="mt-4 border-t border-gray-200 pt-3 text-xs text-gray-400">
        Last edited {new Date(node.updatedAt).toLocaleString()} · Esc returns to the tree
      </div>
    </aside>
  );
}
