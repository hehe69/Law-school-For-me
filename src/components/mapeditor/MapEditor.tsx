"use client";

// The concept-map editor. State lives in React Flow's nodes/edges; the file format is derived on save.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Background, ConnectionMode, Controls, MiniMap, Panel, ReactFlow, ReactFlowProvider, SelectionMode, applyEdgeChanges, applyNodeChanges, getNodesBounds, useReactFlow,
  type Connection, type EdgeChange, type NodeChange, type OnSelectionChangeParams,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { saveElementDefinitionAction, saveMapAction } from "@/app/map-actions";
import { EDGE_DEFAULTS, EDGE_KINDS, KIND_DEFAULTS, NODE_KINDS, type EdgeKind, type MapFile, type NodeKind } from "@/lib/content/mapschema";
import { MASTERY_FILL, type Mastery } from "@/lib/mastery";
import BoxNode from "./BoxNode";
import GroupNode from "./GroupNode";
import LabeledEdge from "./LabeledEdge";
import NotesPanel, { DRAG_TYPE, type DragPayload } from "./NotesPanel";
import SidePanel from "./SidePanel";
import { exportImage } from "./exportImage";
import { COLLAPSED_GROUP, fromFile, isGroup, linkedDefinition, makeBox, makeEdge, masteryFor, newId, toFile, type AnyNode, type BoxData, type BoxNode as BoxNodeType, type EdgeData, type GroupNode as GroupNodeType, type MapEdge, type NoteInfo } from "./model";
import { useHistory } from "./useHistory";

export type MapEditorProps = {
  courseSlug: string;
  unitSlug: string; // "" for the course map
  title: string;
  initial: MapFile;
  problems: string[];
  notes: NoteInfo[];
  mastery: Record<string, Mastery>;
  highlightTopics: string[];
  focusNote?: string;
  backHref: string;
  printHref: string;
};

const nodeTypes = { box: BoxNode, group: GroupNode };
const edgeTypes = { labeled: LabeledEdge };
const GRID = 16;

function Editor(props: MapEditorProps) {
  const { notes: noteList, mastery } = props;
  const notes = useMemo(() => new Map(noteList.map((n) => [n.path, n])), [noteList]);
  const initial = useMemo(() => {
    const { nodes, edges } = fromFile(props.initial);
    // Linked boxes read their text from the note, so the note stays the source of truth.
    for (const n of nodes) {
      if (isGroup(n) || !n.data.linkedNote) continue;
      const def = linkedDefinition(notes.get(n.data.linkedNote), n.data.linkedElement);
      if (def !== null) n.data.definition = def;
    }
    return { nodes, edges };
  }, [props.initial, notes]);

  const [nodes, setNodes] = useState<AnyNode[]>(initial.nodes);
  const [edges, setEdges] = useState<MapEdge[]>(initial.edges);
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [snap, setSnap] = useState(true);
  const [showNotes, setShowNotes] = useState(true);
  const [masteryOn, setMasteryOn] = useState(false);
  const [search, setSearch] = useState("");
  const [addMenu, setAddMenu] = useState<{ x: number; y: number; flow: { x: number; y: number } } | null>(null);
  const [edgeMenu, setEdgeMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [saveState, setSaveState] = useState<{ status: "saved" | "saving" | "dirty" | "error"; at?: string; message?: string }>({ status: "saved" });
  const dirty = useRef(false);
  const [rev, setRev] = useState(0); // bumps on undo/redo so the side panel re-reads its draft
  const flow = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const exportMenu = useRef<HTMLDetailsElement>(null);

  const history = useHistory(
    useCallback(() => ({ nodes: nodesRef.current, edges: edgesRef.current }), []),
    useCallback((s) => { setNodes(s.nodes); setEdges(s.edges); dirty.current = true; setRev((r) => r + 1); setSaveState((x) => ({ ...x, status: "dirty" })); }, []),
  );
  const { takeSnapshot } = history;

  // ---- autosave
  useEffect(() => {
    if (!dirty.current) return;
    setSaveState((s) => ({ ...s, status: "dirty" }));
    const t = setTimeout(async () => {
      setSaveState((s) => ({ ...s, status: "saving" }));
      const result = await saveMapAction(props.courseSlug, props.unitSlug, toFile(nodesRef.current, edgesRef.current));
      if (result.ok) {
        dirty.current = false;
        setSaveState({ status: "saved", at: result.savedAt });
      } else {
        setSaveState({ status: "error", message: result.error });
      }
    }, 600);
    return () => clearTimeout(t);
  }, [nodes, edges, props.courseSlug, props.unitSlug]);
  const markDirty = useCallback(() => { dirty.current = true; }, []);

  // ---- change handlers
  const onNodesChange = useCallback((changes: NodeChange<AnyNode>[]) => {
    if (changes.some((c) => c.type === "remove" || (c.type === "dimensions" && c.resizing === false) || (c.type === "position" && c.dragging === false))) markDirty();
    setNodes((ns) => applyNodeChanges(changes, ns) as AnyNode[]);
  }, [markDirty]);
  const onEdgesChange = useCallback((changes: EdgeChange<MapEdge>[]) => {
    if (changes.some((c) => c.type === "remove")) markDirty();
    setEdges((es) => applyEdgeChanges(changes, es) as MapEdge[]);
  }, [markDirty]);
  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || c.source === c.target) return;
    takeSnapshot();
    const e = makeEdge(c.source, c.target, "plain");
    e.sourceHandle = c.sourceHandle ?? undefined;
    e.targetHandle = c.targetHandle ?? undefined;
    setEdges((es) => [...es, e]);
    markDirty();
    // Ask for the kind next to where the connection ended.
    const tgt = nodesRef.current.find((n) => n.id === c.target);
    if (tgt) {
      const p = flow.flowToScreenPosition({ x: tgt.position.x + (tgt.width ?? 100) / 2, y: tgt.position.y + (tgt.height ?? 50) });
      const r = wrapper.current?.getBoundingClientRect();
      setEdgeMenu({ id: e.id, x: p.x - (r?.left ?? 0), y: p.y - (r?.top ?? 0) });
    }
  }, [flow, markDirty, takeSnapshot]);
  const onSelectionChange = useCallback(({ nodes: ns, edges: es }: OnSelectionChangeParams) => {
    setSelectedNodeIds(ns.map((n) => n.id));
    setSelectedEdgeIds(es.map((e) => e.id));
  }, []);

  const updateBox = useCallback((id: string, patch: Partial<BoxData>, commit = false) => {
    if (commit) takeSnapshot();
    setNodes((ns) => ns.map((n) => (n.id === id && !isGroup(n) ? { ...n, data: { ...n.data, ...patch } } : n)));
    if (commit) markDirty();
  }, [markDirty, takeSnapshot]);
  const updateGroup = useCallback((id: string, patch: { label?: string; colour?: string }) => {
    setNodes((ns) => ns.map((n) => (n.id === id && isGroup(n) ? { ...n, data: { ...n.data, ...patch } } : n)));
    markDirty();
  }, [markDirty]);
  const updateEdge = useCallback((id: string, patch: Partial<EdgeData>) => {
    takeSnapshot();
    setEdges((es) => es.map((e) => (e.id === id ? { ...e, data: { ...(e.data as EdgeData), ...patch } } : e)));
    markDirty();
  }, [markDirty, takeSnapshot]);

  const select = useCallback((nodeIds: string[], edgeIds: string[]) => {
    setNodes((ns) => ns.map((n) => ({ ...n, selected: nodeIds.includes(n.id) })));
    setEdges((es) => es.map((e) => ({ ...e, selected: edgeIds.includes(e.id) })));
  }, []);

  // ---- adding boxes
  const addBox = useCallback((kind: NodeKind, at: { x: number; y: number }, extra: Partial<BoxData> = {}, label?: string) => {
    takeSnapshot();
    const box = makeBox(kind, label ?? kind, at.x, at.y, extra);
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), { ...box, selected: true }]);
    markDirty();
    return box;
  }, [markDirty, takeSnapshot]);

  const centre = useCallback(() => {
    const r = wrapper.current?.getBoundingClientRect();
    return flow.screenToFlowPosition({ x: (r?.left ?? 0) + (r?.width ?? 800) / 2, y: (r?.top ?? 0) + (r?.height ?? 600) / 2 });
  }, [flow]);

  /** Create linked boxes from a note or element, optionally a rule with its elements beneath (the old auto layout). */
  const addFromNote = useCallback((payload: DragPayload, at: { x: number; y: number }) => {
    const note = notes.get(payload.path);
    if (!note) return;
    takeSnapshot();
    const created: AnyNode[] = [];
    const created2: MapEdge[] = [];
    if (payload.element) {
      const el = note.elements?.find((e) => e.index === payload.element);
      if (!el) return;
      created.push(makeBox("element", el.text, at.x, at.y, { linkedNote: note.path, linkedElement: el.index, definition: el.definition || el.text }));
    } else {
      const kind: NodeKind = note.kind === "rule" ? "rule" : note.kind === "case" ? "case" : "free";
      const rule = makeBox(kind, note.title, at.x, at.y, { linkedNote: note.path, definition: note.definition });
      created.push(rule);
      if (payload.withElements && note.elements?.length) {
        const w = KIND_DEFAULTS.element.width;
        const gap = 24;
        const total = note.elements.length * w + (note.elements.length - 1) * gap;
        let x = at.x + (rule.width ?? 220) / 2 - total / 2;
        for (const el of note.elements) {
          const box = makeBox("element", el.text, x, at.y + 130, { linkedNote: note.path, linkedElement: el.index, definition: el.definition || el.text });
          created.push(box);
          created2.push(makeEdge(rule.id, box.id, "contains"));
          let ey = at.y + 130 + KIND_DEFAULTS.element.height + 40;
          for (const ex of el.exceptions) {
            const exBox = makeBox("exception", ex, x, ey, {});
            created.push(exBox);
            created2.push(makeEdge(exBox.id, box.id, "defeats"));
            ey += KIND_DEFAULTS.exception.height + 20;
          }
          x += w + gap;
        }
      }
    }
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), ...created.map((n, i) => ({ ...n, selected: i === 0 }))]);
    setEdges((es) => [...es, ...created2]);
    markDirty();
  }, [markDirty, notes, takeSnapshot]);

  const onDrop = useCallback((e: React.DragEvent) => {
    const raw = e.dataTransfer.getData(DRAG_TYPE);
    if (!raw) return;
    e.preventDefault();
    addFromNote(JSON.parse(raw) as DragPayload, flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
  }, [addFromNote, flow]);

  // ---- selection operations
  const selectedNodes = useMemo(() => nodes.filter((n) => selectedNodeIds.includes(n.id)), [nodes, selectedNodeIds]);
  const selectedEdges = useMemo(() => edges.filter((e) => selectedEdgeIds.includes(e.id)), [edges, selectedEdgeIds]);
  const absPos = useCallback((n: AnyNode) => {
    const p = n.parentId ? nodesRef.current.find((x) => x.id === n.parentId) : undefined;
    return p ? { x: p.position.x + n.position.x, y: p.position.y + n.position.y } : n.position;
  }, []);

  const deleteSelection = useCallback(() => {
    if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return;
    takeSnapshot();
    const gone = new Set(selectedNodeIds);
    // Deleting a group frees its members.
    setNodes((ns) => ns.filter((n) => !gone.has(n.id)).map((n) => (n.parentId && gone.has(n.parentId) ? { ...n, parentId: undefined, position: absPos(n), hidden: false } : n)));
    setEdges((es) => es.filter((e) => !selectedEdgeIds.includes(e.id) && !gone.has(e.source) && !gone.has(e.target)));
    markDirty();
  }, [absPos, markDirty, selectedEdgeIds, selectedNodeIds, takeSnapshot]);

  const duplicateSelection = useCallback(() => {
    const boxes = selectedNodes.filter((n) => !isGroup(n)) as BoxNodeType[];
    if (boxes.length === 0) return;
    takeSnapshot();
    const idMap = new Map(boxes.map((b) => [b.id, newId("n")]));
    const copies: AnyNode[] = boxes.map((b) => ({ ...b, id: idMap.get(b.id)!, position: { x: b.position.x + 30, y: b.position.y + 30 }, selected: true, data: { ...b.data, linkedNote: undefined, linkedElement: undefined } }));
    const edgeCopies = edges.filter((e) => idMap.has(e.source) && idMap.has(e.target)).map((e) => ({ ...e, id: newId("e"), source: idMap.get(e.source)!, target: idMap.get(e.target)!, selected: false }));
    setNodes((ns) => [...ns.map((n) => ({ ...n, selected: false })), ...copies]);
    setEdges((es) => [...es, ...edgeCopies]);
    markDirty();
  }, [edges, markDirty, selectedNodes, takeSnapshot]);

  const nudge = useCallback((dx: number, dy: number) => {
    if (selectedNodeIds.length === 0) return;
    takeSnapshot();
    setNodes((ns) => ns.map((n) => (selectedNodeIds.includes(n.id) ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } : n)));
    markDirty();
  }, [markDirty, selectedNodeIds, takeSnapshot]);

  const align = useCallback((how: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => {
    const sel = selectedNodes.filter((n) => !n.parentId);
    if (sel.length < 2) return;
    takeSnapshot();
    const w = (n: AnyNode) => n.width ?? 100;
    const h = (n: AnyNode) => n.height ?? 50;
    const left = Math.min(...sel.map((n) => n.position.x));
    const right = Math.max(...sel.map((n) => n.position.x + w(n)));
    const top = Math.min(...sel.map((n) => n.position.y));
    const bottom = Math.max(...sel.map((n) => n.position.y + h(n)));
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    setNodes((ns) => ns.map((n) => {
      if (!sel.some((s) => s.id === n.id)) return n;
      const p = { ...n.position };
      if (how === "left") p.x = left; else if (how === "right") p.x = right - w(n); else if (how === "centerX") p.x = cx - w(n) / 2;
      if (how === "top") p.y = top; else if (how === "bottom") p.y = bottom - h(n); else if (how === "centerY") p.y = cy - h(n) / 2;
      return { ...n, position: p };
    }));
    markDirty();
  }, [markDirty, selectedNodes, takeSnapshot]);

  const distribute = useCallback((axis: "x" | "y") => {
    const sel = [...selectedNodes.filter((n) => !n.parentId)].sort((a, b) => (axis === "x" ? a.position.x - b.position.x : a.position.y - b.position.y));
    if (sel.length < 3) return;
    takeSnapshot();
    const size = (n: AnyNode) => (axis === "x" ? n.width ?? 100 : n.height ?? 50);
    const first = sel[0];
    const last = sel[sel.length - 1];
    const span = (axis === "x" ? last.position.x : last.position.y) - (axis === "x" ? first.position.x : first.position.y);
    const inner = sel.slice(1, -1).reduce((s, n) => s + size(n), 0);
    const gap = (span - size(first) - inner) / (sel.length - 1);
    let cursor = (axis === "x" ? first.position.x : first.position.y) + size(first) + gap;
    const target = new Map<string, number>();
    for (const n of sel.slice(1, -1)) { target.set(n.id, cursor); cursor += size(n) + gap; }
    setNodes((ns) => ns.map((n) => (target.has(n.id) ? { ...n, position: axis === "x" ? { ...n.position, x: target.get(n.id)! } : { ...n.position, y: target.get(n.id)! } } : n)));
    markDirty();
  }, [markDirty, selectedNodes, takeSnapshot]);

  const groupSelection = useCallback(() => {
    const boxes = selectedNodes.filter((n) => !isGroup(n) && !n.parentId);
    if (boxes.length === 0) return;
    takeSnapshot();
    const b = getNodesBounds(boxes);
    const pad = 24;
    const g: GroupNodeType = {
      id: newId("g"), type: "group", position: { x: b.x - pad, y: b.y - pad - 20 }, width: b.width + pad * 2, height: b.height + pad * 2 + 20, zIndex: -1,
      data: { label: "Group", colour: "grey", collapsed: false, expandedWidth: b.width + pad * 2, expandedHeight: b.height + pad * 2 + 20, memberCount: boxes.length },
    };
    const ids = new Set(boxes.map((n) => n.id));
    setNodes((ns) => [g, ...ns.map((n) => (ids.has(n.id) ? { ...n, parentId: g.id, position: { x: n.position.x - g.position.x, y: n.position.y - g.position.y }, selected: false } : n))].map((n) => (n.id === g.id ? { ...n, selected: true } : n)));
    markDirty();
  }, [markDirty, selectedNodes, takeSnapshot]);

  const ungroupSelection = useCallback(() => {
    const groupIds = new Set(selectedNodes.filter(isGroup).map((g) => g.id));
    for (const n of selectedNodes) if (n.parentId) groupIds.add(n.parentId);
    if (groupIds.size === 0) return;
    takeSnapshot();
    setNodes((ns) => ns.filter((n) => !groupIds.has(n.id)).map((n) => (n.parentId && groupIds.has(n.parentId) ? { ...n, parentId: undefined, position: absPos(n), hidden: false } : n)));
    markDirty();
  }, [absPos, markDirty, selectedNodes, takeSnapshot]);

  /** Collapse: a group hides its members; a box hides everything reachable through "contains" arrows. */
  const toggleCollapse = useCallback(() => {
    if (selectedNodes.length === 0) return;
    takeSnapshot();
    setNodes((ns) => {
      let next = ns;
      for (const s of selectedNodes) {
        if (isGroup(s)) {
          const collapsed = !s.data.collapsed;
          next = next.map((n): AnyNode => {
            if (n.id === s.id) {
              return {
                ...s,
                width: collapsed ? COLLAPSED_GROUP.width : s.data.expandedWidth,
                height: collapsed ? COLLAPSED_GROUP.height : s.data.expandedHeight,
                data: { ...s.data, collapsed, expandedWidth: collapsed ? (s.width ?? s.data.expandedWidth) : s.data.expandedWidth, expandedHeight: collapsed ? (s.height ?? s.data.expandedHeight) : s.data.expandedHeight },
              };
            }
            return n.parentId === s.id ? { ...n, hidden: collapsed } : n;
          });
        } else {
          next = next.map((n): AnyNode => (n.id === s.id && !isGroup(n) ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n));
        }
      }
      return next;
    });
    markDirty();
  }, [markDirty, selectedNodes, takeSnapshot]);

  const onElementDefinition = useCallback(async (id: string, notePath: string, index: number, definition: string) => {
    const r = await saveElementDefinitionAction(notePath, index, definition);
    if (!r.ok) return r.error;
    updateBox(id, { definition }, true);
    return null;
  }, [updateBox]);

  // ---- keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) history.redo(); else history.undo(); return; }
      if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); history.redo(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSelection(); return; }
      if (e.key === "Escape") { select([], []); setAddMenu(null); setEdgeMenu(null); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelection(); return; }
      const step = e.shiftKey ? GRID * 2 : snap ? GRID : 1;
      if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-step, 0); }
      if (e.key === "ArrowRight") { e.preventDefault(); nudge(step, 0); }
      if (e.key === "ArrowUp") { e.preventDefault(); nudge(0, -step); }
      if (e.key === "ArrowDown") { e.preventDefault(); nudge(0, step); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deleteSelection, duplicateSelection, history, nudge, select, snap]);

  // ---- derived display: search, topic highlight, mastery, collapsed subtrees, missing links
  const highlightTopics = useMemo(() => new Set(props.highlightTopics.map((t) => t.toLowerCase())), [props.highlightTopics]);
  const displayNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const hiddenBy = new Map<string, number>();
    const hidden = new Set<string>();
    const contains = edges.filter((e) => e.data?.kind === "contains");
    for (const n of nodes) {
      if (isGroup(n) || !n.data.collapsed) continue;
      const stack = [n.id];
      let count = 0;
      while (stack.length) {
        const cur = stack.pop()!;
        for (const e of contains) if (e.source === cur && !hidden.has(e.target)) { hidden.add(e.target); count += 1; stack.push(e.target); }
      }
      hiddenBy.set(n.id, count);
    }
    return nodes.map((n) => {
      if (isGroup(n)) return n;
      const d = n.data;
      const match = q ? d.label.toLowerCase().includes(q) || d.definition.toLowerCase().includes(q) : false;
      const topicHit = (d.topics ?? []).some((t) => highlightTopics.has(t.toLowerCase()));
      const m = masteryOn ? masteryFor(d, mastery) : undefined;
      return {
        ...n,
        hidden: n.hidden || hidden.has(n.id),
        data: { ...d, highlight: match || topicHit, dim: q ? !match : false, displayColour: m ? MASTERY_FILL[m] : undefined, hiddenCount: hiddenBy.get(n.id), linkMissing: Boolean(d.linkedNote && !notes.has(d.linkedNote)) },
      };
    });
  }, [edges, highlightTopics, mastery, masteryOn, nodes, notes, search]);
  const displayEdges = useMemo(() => {
    const hiddenIds = new Set(displayNodes.filter((n) => n.hidden).map((n) => n.id));
    return edges.map((e) => ({ ...e, hidden: hiddenIds.has(e.source) || hiddenIds.has(e.target) }));
  }, [displayNodes, edges]);

  // Focus a linked note's box on first load (from a rule tree page link).
  useEffect(() => {
    if (!props.focusNote) return;
    const n = initial.nodes.find((x) => !isGroup(x) && x.data.linkedNote === props.focusNote && !x.data.linkedElement);
    const t = setTimeout(() => {
      if (n) { select([n.id], []); flow.fitView({ nodes: [{ id: n.id }], padding: 1.5, duration: 300 }); }
      else flow.fitView({ padding: 0.2 });
    }, 50);
    return () => clearTimeout(t);
  }, [flow, initial.nodes, props.focusNote, select]);

  const btn = "rounded border border-gray-300 bg-white px-2 py-0.5 text-xs hover:bg-gray-50 disabled:opacity-40";
  const matches = search.trim() ? displayNodes.filter((n) => !isGroup(n) && n.data.highlight).length : 0;

  return (
    <div className="relative left-1/2 -my-6 flex h-[calc(100vh-57px)] w-screen -translate-x-1/2 flex-col bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-1.5 text-sm">
        <Link href={props.backHref} className="text-blue-700 underline">← {props.title}</Link>
        <span className="font-semibold">Map</span>
        <div className="relative">
          <details className="group">
            <summary className={`${btn} cursor-pointer list-none`}>+ Add box</summary>
            <div className="absolute z-30 mt-1 grid w-56 grid-cols-2 gap-1 rounded border border-gray-300 bg-white p-2 shadow">
              {NODE_KINDS.map((k) => (
                <button key={k} type="button" onClick={(e) => { addBox(k, centre()); (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; }} className="rounded px-2 py-1 text-left text-xs hover:bg-gray-100">{k}</button>
              ))}
            </div>
          </details>
        </div>
        <button type="button" onClick={history.undo} disabled={!history.canUndo} className={btn}>Undo</button>
        <button type="button" onClick={history.redo} disabled={!history.canRedo} className={btn}>Redo</button>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} /> Snap to grid</label>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={masteryOn} onChange={(e) => setMasteryOn(e.target.checked)} /> Colour by mastery</label>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={showNotes} onChange={(e) => setShowNotes(e.target.checked)} /> Notes panel</label>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search boxes" className="w-40 rounded border border-gray-300 px-2 py-0.5 text-xs" />
        {search.trim() && <span className="text-xs text-gray-600">{matches} match{matches === 1 ? "" : "es"}</span>}
        <button type="button" onClick={() => flow.fitView({ padding: 0.2, maxZoom: 1.25, duration: 200 })} className={btn}>Fit</button>
        <details className="relative" ref={exportMenu}>
          <summary className={`${btn} cursor-pointer list-none`}>Export</summary>
          <div className="absolute right-0 z-30 mt-1 w-48 rounded border border-gray-300 bg-white p-2 text-xs shadow">
            {([["png", false, "PNG, whole canvas"], ["svg", false, "SVG, whole canvas"], ["png", true, "PNG, selection"], ["svg", true, "SVG, selection"]] as const).map(([fmt, sel, label]) => (
              <button
                key={label}
                type="button"
                disabled={sel && selectedNodeIds.length === 0}
                onClick={() => { if (exportMenu.current) exportMenu.current.open = false; void exportImage(fmt, nodes, props.title, sel ? new Set(selectedNodeIds) : undefined); }}
                className="block w-full rounded px-2 py-1 text-left hover:bg-gray-100 disabled:opacity-40"
              >
                {label}
              </button>
            ))}
            <a href={`${props.printHref}?print=fit`} target="_blank" rel="noopener" className="block rounded px-2 py-1 hover:bg-gray-100">Print, fit to page</a>
            <a href={`${props.printHref}?print=tile`} target="_blank" rel="noopener" className="block rounded px-2 py-1 hover:bg-gray-100">Print, tiled at full size</a>
          </div>
        </details>
        <span data-testid="save-state" className={`ml-auto text-xs ${saveState.status === "error" ? "text-red-700" : "text-gray-500"}`}>
          {saveState.status === "saved" && (saveState.at ? `Saved ${new Date(saveState.at).toLocaleTimeString()}` : "Saved")}
          {saveState.status === "dirty" && "Unsaved changes…"}
          {saveState.status === "saving" && "Saving…"}
          {saveState.status === "error" && `Save failed: ${saveState.message}`}
        </span>
      </div>
      {props.problems.length > 0 && <p className="border-b border-red-200 bg-red-50 px-3 py-1 text-xs text-red-800">map.json had problems: {props.problems.join("; ")}. Those entries were dropped and will not be written back.</p>}
      {props.highlightTopics.length > 0 && <p className="border-b border-red-200 bg-red-50 px-3 py-1 text-xs text-red-900">Highlighting boxes tagged with: {props.highlightTopics.join(", ")}. <Link href="/gaps" className="underline">Back to Gaps</Link></p>}

      <div className="flex min-h-0 flex-1">
        {showNotes && <NotesPanel notes={noteList} nodes={nodes} onAdd={(p) => addFromNote(p, centre())} onSelectNode={(id) => { select([id], []); flow.fitView({ nodes: [{ id }], padding: 1.5, duration: 200 }); }} />}
        <div
          ref={wrapper}
          className="relative min-w-0 flex-1"
          onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } }}
          onDrop={onDrop}
          onDoubleClick={(e) => {
            if (!(e.target as HTMLElement).classList.contains("react-flow__pane")) return;
            const r = wrapper.current!.getBoundingClientRect();
            setAddMenu({ x: e.clientX - r.left, y: e.clientY - r.top, flow: flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }) });
          }}
        >
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onNodeDragStart={takeSnapshot}
            onSelectionDragStart={takeSnapshot}
            onBeforeDelete={async () => { takeSnapshot(); return true; }}
            connectionMode={ConnectionMode.Loose}
            snapToGrid={snap}
            snapGrid={[GRID, GRID]}
            selectionOnDrag
            selectionMode={SelectionMode.Partial}
            panOnDrag={[1, 2]}
            panOnScroll
            zoomOnDoubleClick={false}
            deleteKeyCode={null}
            multiSelectionKeyCode={["Shift", "Meta"]}
            minZoom={0.1}
            maxZoom={3}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.25 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={GRID} color="#e5e7eb" />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeColor={(n) => (n.type === "group" ? "#d1d5db" : "#9ca3af")} />
            <Panel position="bottom-center" className="rounded bg-white/90 px-2 py-0.5 text-[11px] text-gray-600">
              Double-click: add box · drag handle: arrow · Shift+drag or drag on empty: marquee · Delete · arrows nudge · ⌘D duplicate · ⌘Z undo · Esc deselect · right/middle drag: pan
            </Panel>
          </ReactFlow>
          {addMenu && (
            <div data-testid="add-menu" className="absolute z-30 grid w-56 grid-cols-2 gap-1 rounded border border-gray-300 bg-white p-2 shadow" style={{ left: addMenu.x, top: addMenu.y }}>
              <p className="col-span-2 text-xs font-semibold text-gray-600">Add box</p>
              {NODE_KINDS.map((k) => (
                <button key={k} type="button" onClick={() => { addBox(k, addMenu.flow); setAddMenu(null); }} className="rounded px-2 py-1 text-left text-xs hover:bg-gray-100">{k}</button>
              ))}
              <button type="button" onClick={() => setAddMenu(null)} className="col-span-2 text-xs text-gray-500">cancel</button>
            </div>
          )}
          {edgeMenu && (
            <div data-testid="edge-menu" className="absolute z-30 w-56 rounded border border-gray-300 bg-white p-2 shadow" style={{ left: Math.max(0, edgeMenu.x - 112), top: edgeMenu.y + 8 }}>
              <p className="mb-1 text-xs font-semibold text-gray-600">Arrow kind</p>
              <div className="grid grid-cols-2 gap-1">
                {EDGE_KINDS.map((k) => (
                  <button key={k} type="button" onClick={() => { updateEdge(edgeMenu.id, { kind: k as EdgeKind, style: EDGE_DEFAULTS[k].style, arrowheads: EDGE_DEFAULTS[k].arrowheads }); setEdgeMenu(null); select([], [edgeMenu.id]); }} className="rounded px-2 py-1 text-left text-xs hover:bg-gray-100">{k}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        <SidePanel
          rev={rev}
          nodes={nodes}
          edges={edges}
          selectedNodes={selectedNodes}
          selectedEdges={selectedEdges}
          notes={notes}
          onBoxChange={updateBox}
          onGroupChange={updateGroup}
          onEdgeChange={updateEdge}
          onElementDefinition={onElementDefinition}
          onSelect={select}
          onAlign={align}
          onDistribute={distribute}
          onGroup={groupSelection}
          onUngroup={ungroupSelection}
          onToggleCollapse={toggleCollapse}
          onDelete={deleteSelection}
          onDuplicate={duplicateSelection}
        />
      </div>
    </div>
  );
}

export default function MapEditor(props: MapEditorProps) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
