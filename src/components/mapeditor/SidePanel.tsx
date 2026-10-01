"use client";

// Right-hand panel: edit the selected box or arrow, or align a multi-selection.

import Link from "next/link";
import { useState } from "react";
import { ARROWHEADS, EDGE_DEFAULTS, EDGE_KINDS, EDGE_STYLES, KIND_DEFAULTS, NODE_KINDS, PALETTE, SHAPES, type EdgeKind, type NodeKind, type Shape } from "@/lib/content/mapschema";
import type { AnyNode, BoxData, BoxNode, EdgeData, MapEdge, NoteInfo } from "./model";
import { isGroup } from "./model";

type Props = {
  /** Changes on undo/redo so the box panel re-reads its definition draft */
  rev: number;
  nodes: AnyNode[];
  edges: MapEdge[];
  selectedNodes: AnyNode[];
  selectedEdges: MapEdge[];
  notes: Map<string, NoteInfo>;
  onBoxChange: (id: string, patch: Partial<BoxData>, commit?: boolean) => void;
  onGroupChange: (id: string, patch: { label?: string; colour?: string }) => void;
  onEdgeChange: (id: string, patch: Partial<EdgeData>) => void;
  onElementDefinition: (id: string, notePath: string, index: number, definition: string) => Promise<string | null>;
  onSelect: (nodeIds: string[], edgeIds: string[]) => void;
  onAlign: (how: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => void;
  onDistribute: (axis: "x" | "y") => void;
  onGroup: () => void;
  onUngroup: () => void;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
};

const inputCls = "mt-0.5 w-full rounded border border-gray-300 px-2 py-1 text-sm";

function ColourPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  const custom = value.startsWith("#") ? value : "#ffffff";
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1">
      {PALETTE.map((p) => (
        <button key={p.key} type="button" title={p.label} onClick={() => onChange(p.key)} className={`h-6 w-6 rounded border ${value === p.key ? "border-blue-700 ring-2 ring-blue-300" : "border-gray-400"}`} style={{ background: p.hex }} />
      ))}
      <input type="color" value={custom} onChange={(e) => onChange(e.target.value)} title="Any colour" className="h-6 w-8 cursor-pointer rounded border border-gray-400 p-0" />
    </div>
  );
}

function BoxPanel({ node, edges, nodes, notes, onBoxChange, onElementDefinition, onSelect }: { node: BoxNode } & Pick<Props, "edges" | "nodes" | "notes" | "onBoxChange" | "onElementDefinition" | "onSelect">) {
  const d = node.data;
  const note = d.linkedNote ? notes.get(d.linkedNote) : undefined;
  const isLinkedElement = Boolean(d.linkedNote && d.linkedElement);
  // Local draft of the definition; the parent keys this panel by node id and undo revision so it resets on change.
  const [def, setDef] = useState(d.definition);
  const [defStatus, setDefStatus] = useState<string | null>(null);
  const label = (id: string) => (nodes.find((n) => n.id === id)?.data as BoxData | undefined)?.label ?? id;
  const incoming = edges.filter((e) => e.target === node.id);
  const outgoing = edges.filter((e) => e.source === node.id);

  async function commitDefinition() {
    if (def === d.definition) return;
    if (isLinkedElement && d.linkedNote && d.linkedElement) {
      setDefStatus("Saving to note…");
      const err = await onElementDefinition(node.id, d.linkedNote, d.linkedElement, def);
      setDefStatus(err ? `Not saved: ${err}` : "Saved to the note.");
    } else {
      onBoxChange(node.id, { definition: def }, true);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Label</span>
        <input type="text" value={d.label} onChange={(e) => onBoxChange(node.id, { label: e.target.value })} onBlur={() => onBoxChange(node.id, {}, true)} className={inputCls} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Kind</span>
          <select value={d.kind} onChange={(e) => { const kind = e.target.value as NodeKind; onBoxChange(node.id, { kind, shape: KIND_DEFAULTS[kind].shape, colour: KIND_DEFAULTS[kind].colour }, true); }} className={inputCls}>
            {NODE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Shape</span>
          <select value={d.shape} onChange={(e) => onBoxChange(node.id, { shape: e.target.value as Shape }, true)} className={inputCls}>
            {SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Colour</span>
        <ColourPicker value={d.colour} onChange={(c) => onBoxChange(node.id, { colour: c }, true)} />
      </div>

      {note ? (
        <div className="rounded border border-gray-200 bg-gray-50 p-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Linked note</p>
          <p>
            <Link href={note.href} className="text-blue-700 underline">{note.title}</Link>
            <span className="ml-1 text-xs text-gray-500">{note.kind}{d.linkedElement ? ` · element ${d.linkedElement}` : ""}{note.draft ? " · draft" : ""}</span>
          </p>
          {!isLinkedElement && (
            <>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{note.kind === "rule" ? "Rule statement (from the note)" : "From the note"}</p>
              <p className="whitespace-pre-line text-gray-800">{d.definition || <span className="text-gray-400">(empty in the note)</span>}</p>
            </>
          )}
        </div>
      ) : d.linkedNote ? (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-800">Linked note not found: {d.linkedNote}. The box keeps its last text; unlink it or restore the note.</p>
      ) : null}

      {isLinkedElement ? (
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Element definition</span>
          <span className="ml-1 text-xs text-gray-500">(saved into the rule note)</span>
          <textarea value={def} onChange={(e) => setDef(e.target.value)} onBlur={() => void commitDefinition()} rows={6} className={inputCls} />
          {defStatus && <span className="text-xs text-gray-600">{defStatus}</span>}
        </label>
      ) : note ? (
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">My annotation</span>
          <textarea value={d.annotation ?? ""} onChange={(e) => onBoxChange(node.id, { annotation: e.target.value })} onBlur={() => onBoxChange(node.id, {}, true)} rows={5} className={inputCls} />
        </label>
      ) : (
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Definition</span>
          <span className="ml-1 text-xs text-gray-500">markdown</span>
          <textarea value={def} onChange={(e) => setDef(e.target.value)} onBlur={() => void commitDefinition()} rows={8} className={inputCls} />
        </label>
      )}

      {d.linkedNote && (
        <button type="button" onClick={() => onBoxChange(node.id, { linkedNote: undefined, linkedElement: undefined }, true)} className="text-xs text-gray-600 underline">
          Unlink from note
        </button>
      )}

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Topics</span>
        <span className="ml-1 text-xs text-gray-500">comma separated; used by Gaps highlighting</span>
        <input type="text" value={(d.topics ?? []).join(", ")} onChange={(e) => onBoxChange(node.id, { topics: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} onBlur={() => onBoxChange(node.id, {}, true)} className={inputCls} />
      </label>

      {!d.linkedNote && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={d.flashcard !== false} onChange={(e) => onBoxChange(node.id, { flashcard: e.target.checked ? undefined : false }, true)} />
          Flashcard <span className="text-xs text-gray-500">(needs a definition)</span>
        </label>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Arrows</p>
        {incoming.length === 0 && outgoing.length === 0 && <p className="text-xs text-gray-500">None. Drag from a handle on the box edge to draw one.</p>}
        <ul className="space-y-0.5 text-xs">
          {incoming.map((e) => (
            <li key={e.id}><button type="button" onClick={() => onSelect([], [e.id])} className="text-left hover:underline">← {label(e.source)} <span className="text-gray-500">({e.data?.label ?? (EDGE_DEFAULTS[e.data?.kind ?? "plain"].label || e.data?.kind)})</span></button></li>
          ))}
          {outgoing.map((e) => (
            <li key={e.id}><button type="button" onClick={() => onSelect([], [e.id])} className="text-left hover:underline">→ {label(e.target)} <span className="text-gray-500">({e.data?.label ?? (EDGE_DEFAULTS[e.data?.kind ?? "plain"].label || e.data?.kind)})</span></button></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EdgePanel({ edge, nodes, onEdgeChange }: { edge: MapEdge } & Pick<Props, "nodes" | "onEdgeChange">) {
  const d = edge.data ?? { kind: "plain" as EdgeKind, style: "solid" as const, arrowheads: "one" as const };
  const name = (id: string) => (nodes.find((n) => n.id === id)?.data as BoxData | undefined)?.label ?? id;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-gray-700">{name(edge.source)} → {name(edge.target)}</p>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Kind</span>
        <select value={d.kind} onChange={(e) => { const kind = e.target.value as EdgeKind; onEdgeChange(edge.id, { kind, style: EDGE_DEFAULTS[kind].style, arrowheads: EDGE_DEFAULTS[kind].arrowheads }); }} className={inputCls}>
          {EDGE_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Label</span>
        <span className="ml-1 text-xs text-gray-500">blank uses the kind&apos;s default: &ldquo;{EDGE_DEFAULTS[d.kind].label || "(none)"}&rdquo;</span>
        <input type="text" value={d.label ?? ""} onChange={(e) => onEdgeChange(edge.id, { label: e.target.value || undefined })} className={inputCls} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Style</span>
          <select value={d.style} onChange={(e) => onEdgeChange(edge.id, { style: e.target.value as EdgeData["style"] })} className={inputCls}>
            {EDGE_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Arrowheads</span>
          <select value={d.arrowheads} onChange={(e) => onEdgeChange(edge.id, { arrowheads: e.target.value as EdgeData["arrowheads"] })} className={inputCls}>
            {ARROWHEADS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

export default function SidePanel(props: Props) {
  const { selectedNodes, selectedEdges } = props;
  const boxes = selectedNodes.filter((n) => !isGroup(n)) as BoxNode[];
  const groups = selectedNodes.filter(isGroup);

  let body: React.ReactNode;
  if (selectedNodes.length === 1 && boxes.length === 1) {
    body = <BoxPanel key={`${boxes[0].id}:${props.rev}`} node={boxes[0]} edges={props.edges} nodes={props.nodes} notes={props.notes} onBoxChange={props.onBoxChange} onElementDefinition={props.onElementDefinition} onSelect={props.onSelect} />;
  } else if (selectedNodes.length === 1 && groups.length === 1) {
    const g = groups[0];
    body = (
      <div className="space-y-3 text-sm">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Group label</span>
          <input type="text" value={g.data.label} onChange={(e) => props.onGroupChange(g.id, { label: e.target.value })} className={inputCls} />
        </label>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Colour</span>
          <ColourPicker value={g.data.colour} onChange={(c) => props.onGroupChange(g.id, { colour: c })} />
        </div>
        <p className="text-xs text-gray-500">{g.data.memberCount} boxes inside.</p>
      </div>
    );
  } else if (selectedEdges.length === 1 && selectedNodes.length === 0) {
    body = <EdgePanel edge={selectedEdges[0]} nodes={props.nodes} onEdgeChange={props.onEdgeChange} />;
  } else if (selectedNodes.length > 1) {
    body = <p className="text-sm text-gray-700">{selectedNodes.length} boxes selected.</p>;
  } else {
    body = <p className="text-sm text-gray-500">Click a box or arrow to edit it. Double-click empty canvas to add a box. Drag from a box&apos;s edge handle to another box to draw an arrow.</p>;
  }

  const btn = "rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50";
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l border-gray-200 bg-white p-3">
      {selectedNodes.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {selectedNodes.length > 1 && (
            <>
              <span className="w-full text-xs font-semibold uppercase tracking-wide text-gray-500">Align</span>
              {(["left", "centerX", "right", "top", "centerY", "bottom"] as const).map((h) => (
                <button key={h} type="button" onClick={() => props.onAlign(h)} className={btn}>{h === "centerX" ? "centre ↔" : h === "centerY" ? "middle ↕" : h}</button>
              ))}
              {selectedNodes.length > 2 && (
                <>
                  <button type="button" onClick={() => props.onDistribute("x")} className={btn}>distribute ↔</button>
                  <button type="button" onClick={() => props.onDistribute("y")} className={btn}>distribute ↕</button>
                </>
              )}
            </>
          )}
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-gray-500">Selection</span>
          {boxes.length > 0 && <button type="button" onClick={props.onGroup} className={btn}>Group</button>}
          {(groups.length > 0 || boxes.some((b) => b.parentId)) && <button type="button" onClick={props.onUngroup} className={btn}>Ungroup</button>}
          <button type="button" onClick={props.onToggleCollapse} className={btn}>Collapse / expand</button>
          <button type="button" onClick={props.onDuplicate} className={btn}>Duplicate (⌘D)</button>
          <button type="button" onClick={props.onDelete} className={`${btn} border-red-300 text-red-800`}>Delete</button>
        </div>
      )}
      {body}
    </aside>
  );
}
