"use client";

import { memo, type KeyboardEvent, type MouseEvent, type DragEvent } from "react";
import type { OutlineNode } from "@/lib/types";
import { nodeSummary, STATUS_DOT_CLASS, STATUS_LABELS, typeDef } from "@/lib/fields";

export type DropWhere = "before" | "after" | "inside";

export type RowHandlers = {
  onTitleChange: (id: string, title: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>, id: string) => void;
  onFocusRow: (id: string, e?: MouseEvent) => void;
  onToggleCollapse: (id: string) => void;
  onCycleStatus: (id: string) => void;
  onDragStart: (e: DragEvent, id: string) => void;
  onDragOver: (e: DragEvent, id: string) => void;
  onDrop: (e: DragEvent, id: string) => void;
  onDragEnd: () => void;
  registerInput: (id: string, el: HTMLInputElement | null) => void;
};

type Props = {
  node: OutlineNode;
  depth: number;
  label: string;
  hasChildren: boolean;
  selected: boolean;
  active: boolean;
  skeleton: boolean;
  dropWhere: DropWhere | null;
  dimmed: boolean;
  handlers: RowHandlers;
};

const INDENT = 22;

function RowImpl({ node, depth, label, hasChildren, selected, active, skeleton, dropWhere, dimmed, handlers }: Props) {
  const def = typeDef(node.type);
  const summary = skeleton ? "" : nodeSummary(node);
  return (
    <div
      data-node-id={node.id}
      className={`group relative flex items-start gap-1 rounded px-1 ${selected ? "bg-blue-50" : "hover:bg-gray-50"} ${active ? "ring-1 ring-blue-300" : ""} ${dimmed ? "opacity-40" : ""}`}
      style={{ paddingLeft: depth * INDENT + 4 }}
      onMouseDown={(e) => {
        if ((e.target as HTMLElement).tagName !== "INPUT") handlers.onFocusRow(node.id, e);
      }}
      onDragOver={(e) => handlers.onDragOver(e, node.id)}
      onDrop={(e) => handlers.onDrop(e, node.id)}
    >
      {dropWhere === "before" && <div className="pointer-events-none absolute left-0 right-0 top-0 h-0.5 bg-blue-500" style={{ left: depth * INDENT + 4 }} />}
      {dropWhere === "after" && <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-0.5 bg-blue-500" style={{ left: depth * INDENT + 4 }} />}
      {dropWhere === "inside" && <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-0.5 bg-blue-500" style={{ left: (depth + 1) * INDENT + 4 }} />}

      {/* Collapse chevron */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={node.collapsed ? "Expand" : "Collapse"}
        className={`mt-1 h-4 w-4 shrink-0 rounded text-center text-[10px] leading-4 text-gray-400 hover:bg-gray-200 hover:text-gray-700 ${hasChildren ? "" : "invisible"}`}
        onClick={(e) => {
          e.stopPropagation();
          handlers.onToggleCollapse(node.id);
        }}
      >
        {node.collapsed ? "▶" : "▼"}
      </button>

      {/* Drag handle + numbering label */}
      <span
        draggable
        onDragStart={(e) => handlers.onDragStart(e, node.id)}
        onDragEnd={handlers.onDragEnd}
        title="Drag to move"
        className="mt-0.5 min-w-[2.2rem] shrink-0 cursor-grab select-none pr-1 text-right font-mono text-[13px] leading-5 text-gray-600 active:cursor-grabbing"
      >
        {label}
      </span>

      {/* Status dot */}
      <button
        type="button"
        tabIndex={-1}
        title={`Status: ${STATUS_LABELS[node.status]} (click to change)`}
        className={`mt-[7px] h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_DOT_CLASS[node.status]}`}
        onClick={(e) => {
          e.stopPropagation();
          handlers.onCycleStatus(node.id);
        }}
      />

      {/* Type badge */}
      {node.type !== "heading" && (
        <span className="mt-0.5 shrink-0 rounded border border-gray-300 px-1 font-mono text-[10px] leading-4 text-gray-500" title={def.label}>
          {def.badge}
        </span>
      )}

      <div className="flex min-w-0 flex-1 items-baseline gap-2">
        <input
          ref={(el) => handlers.registerInput(node.id, el)}
          value={node.title}
          placeholder={def.titleLabel}
          spellCheck={false}
          onChange={(e) => handlers.onTitleChange(node.id, e.target.value)}
          onKeyDown={(e) => handlers.onKeyDown(e, node.id)}
          onFocus={() => handlers.onFocusRow(node.id)}
          className={`min-w-[8rem] flex-1 bg-transparent py-0.5 text-[14px] leading-5 outline-none ${depth === 0 ? "font-semibold" : depth === 1 ? "font-medium" : ""}`}
          style={{ flexBasis: summary ? "45%" : "100%" }}
        />
        {summary && (
          <span className="hidden min-w-0 flex-1 truncate text-[12px] leading-5 text-gray-500 md:inline" title={summary}>
            {summary}
          </span>
        )}
        {node.linkedNotePath && (
          <span className="shrink-0 text-[11px] text-gray-400" title={`Linked to ${node.linkedNotePath}`}>
            ⛓
          </span>
        )}
        {node.tags.length > 0 && !skeleton && (
          <span className="hidden shrink-0 gap-1 lg:flex">
            {node.tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded bg-gray-100 px-1 text-[10px] leading-4 text-gray-500">
                {t}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

export const TreeRow = memo(RowImpl);
