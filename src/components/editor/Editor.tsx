"use client";

// The tree editor: numbering, keyboard, drag and drop, multi-select, status, skeleton mode, undo/redo and
// autosave. The tree state is an immutable NodeMap kept in the history hook; every edit produces a new map,
// and the autosave hook sends the difference to the server.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent } from "react";
import type { ImageRow, Link as LinkRow, LinkKind, NodeMap, NodeStatus, NodeType, NumberingStyle, OutlineBundle, OutlineKind, OutlineNode, Source } from "@/lib/types";
import { NODE_STATUSES, NODE_TYPES, NUMBERING_STYLES } from "@/lib/types";
import { api } from "@/lib/client";
import {
  ancestorIds,
  childrenOf,
  collapseToLevel,
  flatten,
  indentNode,
  insertNode,
  isDescendantOf,
  maxDepth,
  moveAmongSiblings,
  moveSubtree,
  outdentNode,
  removeSubtree,
  revealNode,
  type Row,
} from "@/lib/tree";
import { numberingLabel } from "@/lib/numbering";
import { makeNode, retype } from "@/lib/nodeFactory";
import { isMod, shortcutLabel } from "@/lib/keys";
import { NODE_TYPE_DEFS, nodeText, STATUS_LABELS } from "@/lib/fields";
import { useHistory } from "./useHistory";
import { useAutosave } from "./useAutosave";
import { TreeRow, type DropWhere, type RowBadges, type RowHandlers } from "./TreeRow";
import { SidePanel } from "./SidePanel";
import { CommandPalette, type PaletteItem } from "./CommandPalette";
import { NodePicker } from "./NodePicker";
import { MoveToDialog } from "./MoveToDialog";
import type { AttachmentActions } from "./PanelSections";

type OutlineSummary = { id: string; name: string; kind: OutlineKind };

type Props = {
  bundle: OutlineBundle;
  outlines: OutlineSummary[];
  /** Node to reveal and select on load (from ?node= in the URL) */
  initialNodeId: string | null;
};

const NO_BADGES: RowBadges = { links: 0, sources: 0, images: 0 };

const NUMBERING_LABELS: Record<NumberingStyle, string> = { legal: "Legal (I. A. 1.)", decimal: "Decimal (1.1.1)", bullets: "Bullets" };
const STATUS_ORDER: NodeStatus[] = ["empty", "skeleton", "drafted", "final"];

const SHORTCUTS: [string, string][] = [
  ["Enter", "New sibling below (at the start of a title: above)"],
  ["Shift+Enter", "New sibling above"],
  ["Mod+Enter", "New child"],
  ["Tab / Shift+Tab", "Indent / outdent (whole selection)"],
  ["Mod+Up / Mod+Down", "Move node, children stay"],
  ["Mod+Shift+Up / Mod+Shift+Down", "Move node with children"],
  ["Up / Down", "Previous / next row"],
  ["Shift+Up / Shift+Down", "Extend the selection"],
  ["Mod+.", "Collapse / expand"],
  ["Backspace (empty title)", "Delete the node"],
  ["Mod+Backspace", "Delete the selection with children"],
  ["Mod+Z / Mod+Shift+Z", "Undo / redo"],
  ["Mod+K", "Command palette: jump to a node, run a command"],
  ["Mod+F", "Search"],
  ["Mod+E", "Edit fields in the side panel"],
  ["Esc", "Back to the tree from any field"],
  ["Shift+click / Mod+click", "Select a range / toggle a row"],
];

function toMap(nodes: OutlineNode[]): NodeMap {
  const map: NodeMap = {};
  for (const n of nodes) map[n.id] = n;
  return map;
}

export function Editor({ bundle, outlines, initialNodeId }: Props) {
  const router = useRouter();
  const outlineId = bundle.outline.id;
  const initialMap = useMemo(() => toMap(bundle.nodes), [bundle.nodes]);
  const history = useHistory<NodeMap>(initialMap);
  const nodes = history.present;
  const autosave = useAutosave(outlineId, initialMap, nodes);

  // Links, sources and images are saved straight away through their own routes (not part of undo).
  const [links, setLinks] = useState<LinkRow[]>(bundle.links);
  const [sources, setSources] = useState<Source[]>(bundle.sources);
  const [images, setImages] = useState<ImageRow[]>(bundle.images);
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [outline, setOutline] = useState(bundle.outline);
  const numbering = outline.numbering;
  const skeleton = outline.options.skeleton === true;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const anchorRef = useRef<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; caret: "start" | "end"; token: number } | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelFocusToken, setPanelFocusToken] = useState(0);
  const [palette, setPalette] = useState<{ open: boolean; session: number; items: PaletteItem[] }>({ open: false, session: 0, items: [] });
  const [helpOpen, setHelpOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [drag, setDrag] = useState<string[] | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; where: DropWhere } | null>(null);

  const inputs = useRef(new Map<string, HTMLInputElement>());
  const treeRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Visible rows: the tree with collapsed branches folded, or, while searching, matches with their ancestors.
  const allRows = useMemo(() => flatten(nodes, false), [nodes]);
  const rows: Row[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flatten(nodes, true);
    const keep = new Set<string>();
    for (const n of Object.values(nodes)) {
      if (nodeText(n).toLowerCase().includes(q)) {
        keep.add(n.id);
        for (const a of ancestorIds(nodes, n.id)) keep.add(a);
      }
    }
    return allRows.filter((r) => keep.has(r.node.id));
  }, [nodes, search, allRows]);

  const depth = useMemo(() => maxDepth(nodes), [nodes]);

  // Per-row counts shown as small badges.
  const badges = useMemo(() => {
    const map: Record<string, RowBadges> = {};
    const get = (id: string) => (map[id] ??= { links: 0, sources: 0, images: 0 });
    for (const l of links) {
      get(l.fromNode).links++;
      get(l.toNode).links++;
    }
    for (const s of sources) get(s.nodeId).sources++;
    for (const i of images) get(i.nodeId).images++;
    return map;
  }, [links, sources, images]);

  // Latest state for the stable handlers (updated after every render, read only from events and effects).
  const latest = useRef({ nodes, rows, selected, active, skeleton });
  useLayoutEffect(() => {
    latest.current = { nodes, rows, selected, active, skeleton };
  });
  const dragRef = useRef<string[] | null>(null);
  const dropRef = useRef<{ id: string; where: DropWhere } | null>(null);
  useLayoutEffect(() => {
    dragRef.current = drag;
    dropRef.current = dropTarget;
  });

  // ---- helpers over the current tree ----------------------------------------------------------------

  const commit = useCallback((next: NodeMap, key?: string) => history.commit(next, key), [history]);

  const requestFocus = useCallback((id: string, caret: "start" | "end" = "end") => {
    setFocusRequest((f) => ({ id, caret, token: (f?.token ?? 0) + 1 }));
  }, []);

  useEffect(() => {
    if (!focusRequest) return;
    const el = inputs.current.get(focusRequest.id);
    if (!el) return;
    el.focus();
    const pos = focusRequest.caret === "end" ? el.value.length : 0;
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      // not a text input
    }
    el.scrollIntoView({ block: "nearest" });
  }, [focusRequest]);

  const selectOnly = useCallback((id: string) => {
    setSelected(new Set([id]));
    setActive(id);
    anchorRef.current = id;
  }, []);

  const selectionIds = useCallback((fallback: string | null): string[] => {
    const { selected: sel, rows: visible } = latest.current;
    const ids = visible.map((r) => r.node.id).filter((id) => sel.has(id));
    if (ids.length > 0) return ids;
    return fallback ? [fallback] : [];
  }, []);

  /** Selected ids whose ancestors are not also selected, in document order. */
  const topLevelSelection = useCallback(
    (fallback: string | null): string[] => {
      const { nodes: cur } = latest.current;
      const ids = selectionIds(fallback);
      const set = new Set(ids);
      return ids.filter((id) => !ancestorIds(cur, id).some((a) => set.has(a)));
    },
    [selectionIds],
  );

  const updateNode = useCallback(
    (id: string, patch: Partial<OutlineNode>, key?: string) => {
      const cur = latest.current.nodes;
      const node = cur[id];
      if (!node) return;
      commit({ ...cur, [id]: { ...node, ...patch, updatedAt: new Date().toISOString() } }, key);
    },
    [commit],
  );

  const setField = useCallback(
    (id: string, fieldKey: string, value: unknown) => {
      const cur = latest.current.nodes;
      const node = cur[id];
      if (!node) return;
      commit({ ...cur, [id]: { ...node, fields: { ...node.fields, [fieldKey]: value }, updatedAt: new Date().toISOString() } }, `field:${id}:${fieldKey}`);
    },
    [commit],
  );

  const newNodeFor = useCallback(
    (like: OutlineNode | null, forChild: boolean): OutlineNode => {
      const status: NodeStatus = latest.current.skeleton ? "skeleton" : "empty";
      let type: NodeType = "heading";
      if (!forChild && like && !["image", "table", "free"].includes(like.type)) type = like.type;
      return makeNode(outlineId, type, status);
    },
    [outlineId],
  );

  const addSibling = useCallback(
    (id: string, before: boolean) => {
      const cur = latest.current.nodes;
      const node = cur[id];
      if (!node) return;
      const siblings = childrenOf(cur, node.parentId);
      const i = siblings.findIndex((n) => n.id === id);
      const fresh = newNodeFor(node, false);
      commit(insertNode(cur, fresh, node.parentId, before ? i : i + 1));
      selectOnly(fresh.id);
      requestFocus(fresh.id);
    },
    [commit, newNodeFor, requestFocus, selectOnly],
  );

  const addChild = useCallback(
    (id: string) => {
      const cur = latest.current.nodes;
      const node = cur[id];
      if (!node) return;
      const fresh = newNodeFor(node, true);
      let next = insertNode(cur, fresh, id, 0);
      if (next[id].collapsed) next = { ...next, [id]: { ...next[id], collapsed: false } };
      commit(next);
      selectOnly(fresh.id);
      requestFocus(fresh.id);
    },
    [commit, newNodeFor, requestFocus, selectOnly],
  );

  const addTopLevel = useCallback(() => {
    const cur = latest.current.nodes;
    const fresh = newNodeFor(null, true);
    commit(insertNode(cur, fresh, null, childrenOf(cur, null).length));
    selectOnly(fresh.id);
    requestFocus(fresh.id);
  }, [commit, newNodeFor, requestFocus, selectOnly]);

  const deleteIds = useCallback(
    (ids: string[]) => {
      const { nodes: cur, rows: visible } = latest.current;
      if (ids.length === 0) return;
      const firstIndex = Math.min(...ids.map((id) => visible.findIndex((r) => r.node.id === id)).filter((i) => i >= 0));
      let next = cur;
      const gone = new Set<string>();
      for (const id of ids) {
        const r = removeSubtree(next, id);
        next = r.nodes;
        for (const g of r.removed) gone.add(g);
      }
      commit(next);
      // The server cascades links, sources and images; drop them here too.
      setLinks((ls) => ls.filter((l) => !gone.has(l.fromNode) && !gone.has(l.toNode)));
      setSources((ss) => ss.filter((s) => !gone.has(s.nodeId)));
      setImages((is) => is.filter((i) => !gone.has(i.nodeId)));
      // Focus the row above the first deleted one, else the first remaining row.
      const remaining = flatten(next, true);
      const candidate = remaining.filter((r) => firstIndex < 0 || visible.findIndex((v) => v.node.id === r.node.id) < firstIndex).pop() ?? remaining[0];
      if (candidate) {
        selectOnly(candidate.node.id);
        requestFocus(candidate.node.id);
      } else {
        setSelected(new Set());
        setActive(null);
      }
    },
    [commit, requestFocus, selectOnly],
  );

  const indentSelection = useCallback(
    (fallback: string) => {
      let next = latest.current.nodes;
      for (const id of topLevelSelection(fallback)) {
        const r = indentNode(next, id);
        if (r) next = r;
      }
      if (next !== latest.current.nodes) commit(next);
    },
    [commit, topLevelSelection],
  );

  const outdentSelection = useCallback(
    (fallback: string) => {
      let next = latest.current.nodes;
      for (const id of topLevelSelection(fallback).reverse()) {
        const r = outdentNode(next, id);
        if (r) next = r;
      }
      if (next !== latest.current.nodes) commit(next);
    },
    [commit, topLevelSelection],
  );

  const moveNode = useCallback(
    (id: string, delta: -1 | 1, withChildren: boolean) => {
      const next = moveAmongSiblings(latest.current.nodes, id, delta, withChildren);
      if (next) {
        commit(next);
        requestFocus(id);
      }
    },
    [commit, requestFocus],
  );

  const toggleCollapse = useCallback(
    (id: string) => {
      const cur = latest.current.nodes;
      const node = cur[id];
      if (!node) return;
      history.replace({ ...cur, [id]: { ...node, collapsed: !node.collapsed } });
    },
    [history],
  );

  const setStatusFor = useCallback(
    (ids: string[], status: NodeStatus) => {
      const cur = latest.current.nodes;
      const next: NodeMap = { ...cur };
      const now = new Date().toISOString();
      for (const id of ids) if (next[id]) next[id] = { ...next[id], status, updatedAt: now };
      commit(next);
    },
    [commit],
  );

  const setTypeFor = useCallback(
    (ids: string[], type: NodeType) => {
      const cur = latest.current.nodes;
      const next: NodeMap = { ...cur };
      for (const id of ids) if (next[id]) next[id] = retype(next[id], type);
      commit(next);
    },
    [commit],
  );

  const jumpTo = useCallback(
    (id: string) => {
      const cur = latest.current.nodes;
      if (!cur[id]) return;
      setSearch("");
      const revealed = revealNode(cur, id);
      if (revealed !== cur) history.replace(revealed);
      selectOnly(id);
      requestFocus(id);
    },
    [history, requestFocus, selectOnly],
  );

  const focusRelative = useCallback(
    (id: string, delta: -1 | 1, extend: boolean) => {
      const { rows: visible, selected: sel, active: act } = latest.current;
      // When extending, the moving end is the active row (the focused input stays on the anchor).
      const from = extend && act ? act : id;
      const i = visible.findIndex((r) => r.node.id === from);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= visible.length) return;
      const target = visible[j].node.id;
      if (extend) {
        const anchor = anchorRef.current ?? id;
        const a = visible.findIndex((r) => r.node.id === anchor);
        const [lo, hi] = a < j ? [a, j] : [j, a];
        const range = new Set(visible.slice(lo, hi + 1).map((r) => r.node.id));
        if (!sel.size) range.add(id);
        setSelected(range);
        setActive(target);
      } else {
        requestFocus(target, "end");
      }
    },
    [requestFocus],
  );

  const patchOutline = useCallback(
    (patch: { name?: string; numbering?: NumberingStyle; options?: Record<string, unknown> }) => {
      setOutline((o) => ({ ...o, ...(patch.name !== undefined ? { name: patch.name } : {}), ...(patch.numbering ? { numbering: patch.numbering } : {}), options: { ...o.options, ...(patch.options ?? {}) } }));
      void fetch(`/api/outlines/${outlineId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    },
    [outlineId],
  );

  const undo = useCallback(() => {
    history.undo();
  }, [history]);
  const redo = useCallback(() => {
    history.redo();
  }, [history]);

  const flash = useCallback((message: string) => {
    setNotice(message);
    setTimeout(() => setNotice((n) => (n === message ? null : n)), 4000);
  }, []);

  // ---- links, sources, images (saved through their own routes) --------------------------------------

  const uploadImages = useCallback(
    async (nodeId: string, files: File[]) => {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const form = new FormData();
        form.append("file", file, file.name || "pasted.png");
        form.append("nodeId", nodeId);
        try {
          const img = await api.upload<ImageRow>("/api/upload", form);
          setImages((is) => [...is, img]);
        } catch (e) {
          flash(`Upload failed: ${(e as Error).message}`);
        }
      }
    },
    [flash],
  );

  const actions = useMemo<AttachmentActions>(
    () => ({
      addLink: async (from, to, kind, note) => {
        const link = await api.post<LinkRow>("/api/links", { fromNode: from, toNode: to, kind, note });
        setLinks((ls) => [...ls, link]);
      },
      updateLink: async (id, patch) => {
        const link = await api.patch<LinkRow>(`/api/links/${id}`, patch);
        setLinks((ls) => ls.map((l) => (l.id === id ? link : l)));
      },
      removeLink: async (id) => {
        await api.delete(`/api/links/${id}`);
        setLinks((ls) => ls.filter((l) => l.id !== id));
      },
      addSource: async (nodeId, kind, reference, url) => {
        const source = await api.post<Source>("/api/sources", { nodeId, kind, reference, url });
        setSources((ss) => [...ss, source]);
      },
      updateSource: async (id, patch) => {
        const source = await api.patch<Source>(`/api/sources/${id}`, patch);
        setSources((ss) => ss.map((s) => (s.id === id ? source : s)));
      },
      removeSource: async (id) => {
        await api.delete(`/api/sources/${id}`);
        setSources((ss) => ss.filter((s) => s.id !== id));
      },
      uploadImages,
      updateImage: async (id, patch) => {
        const img = await api.patch<ImageRow>(`/api/images/${id}`, patch);
        setImages((is) => is.map((i) => (i.id === id ? img : i)));
      },
      removeImage: async (id) => {
        await api.delete(`/api/images/${id}`);
        setImages((is) => is.filter((i) => i.id !== id));
      },
      jumpTo,
      openLinkPicker: (fromId) => setLinkFrom(fromId),
    }),
    [jumpTo, uploadImages],
  );

  /** Move a node with its subtree to another outline (or elsewhere in this one). */
  const moveTo = useCallback(
    async (nodeId: string, targetOutlineId: string, parentId: string | null) => {
      setMoveTarget(null);
      const cur = latest.current.nodes;
      const node = cur[nodeId];
      if (!node) return;
      if (targetOutlineId === outlineId) {
        const next = moveSubtree(cur, nodeId, parentId, parentId === null ? childrenOf(cur, null).length : childrenOf(cur, parentId).length);
        if (next) {
          commit(next);
          requestFocus(nodeId);
        } else flash("Cannot move a node inside itself.");
        return;
      }
      await autosave.saveNow();
      try {
        await api.post("/api/nodes/move", { nodeId, outlineId: targetOutlineId, parentId });
      } catch (e) {
        flash(`Move failed: ${(e as Error).message}`);
        return;
      }
      const removed = removeSubtree(cur, nodeId);
      history.replace(removed.nodes);
      const target = outlines.find((o) => o.id === targetOutlineId);
      flash(`Moved "${node.title || "(untitled)"}" to ${target?.name ?? "the other outline"}.`);
      const remaining = flatten(removed.nodes, true);
      if (remaining[0]) selectOnly(remaining[0].node.id);
      else {
        setSelected(new Set());
        setActive(null);
      }
    },
    [autosave, commit, flash, history, outlineId, outlines, requestFocus, selectOnly],
  );

  // Pasting an image anywhere in the editor attaches it to the active node.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      const act = latest.current.active;
      if (!act) return;
      e.preventDefault();
      void uploadImages(act, files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [uploadImages]);

  // Open on the node named in the URL (from the inbox or a link).
  useEffect(() => {
    if (!initialNodeId) return;
    const t = setTimeout(() => jumpTo(initialNodeId), 0);
    return () => clearTimeout(t);
  }, [initialNodeId, jumpTo]);

  // ---- keyboard ---------------------------------------------------------------------------------------

  const handleKey = useCallback(
    (e: KeyboardEvent<HTMLElement>, id: string, input: HTMLInputElement | null) => {
      const mod = isMod(e);
      const key = e.key;
      if (key === "Enter") {
        e.preventDefault();
        if (mod) addChild(id);
        else if (e.shiftKey) addSibling(id, true);
        else if (input) {
          const atStart = input.selectionStart === 0 && input.selectionEnd === 0 && input.value.length > 0;
          addSibling(id, atStart);
        } else requestFocus(id);
        return;
      }
      if (key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) outdentSelection(id);
        else indentSelection(id);
        return;
      }
      if (key === "ArrowUp" || key === "ArrowDown") {
        const delta: -1 | 1 = key === "ArrowUp" ? -1 : 1;
        if (mod) {
          e.preventDefault();
          moveNode(id, delta, e.shiftKey);
        } else {
          e.preventDefault();
          focusRelative(id, delta, e.shiftKey);
        }
        return;
      }
      if (key === "Backspace" || key === "Delete") {
        if (mod) {
          e.preventDefault();
          deleteIds(topLevelSelection(id));
          return;
        }
        if (input && input.value === "" && key === "Backspace") {
          const cur = latest.current.nodes;
          if (childrenOf(cur, id).length === 0) {
            e.preventDefault();
            deleteIds([id]);
          }
        }
        return;
      }
      if (key === "." && mod) {
        e.preventDefault();
        toggleCollapse(id);
        return;
      }
      if (key === "Escape") {
        e.preventDefault();
        input?.blur();
        treeRef.current?.focus();
        return;
      }
    },
    [addChild, addSibling, deleteIds, focusRelative, indentSelection, moveNode, outdentSelection, requestFocus, toggleCollapse, topLevelSelection],
  );

  // ---- command palette --------------------------------------------------------------------------------

  const buildPaletteItems = useCallback((): PaletteItem[] => {
    const { nodes: cur, active: act, skeleton: skel } = latest.current;
    const cmds: PaletteItem[] = [];
    const cmd = (id: string, label: string, run: () => void, detail?: string) => cmds.push({ id: `cmd:${id}`, label, detail, group: "Commands", run });
    if (act) {
      cmd("sibling", "New sibling below", () => addSibling(act, false), shortcutLabel("Enter"));
      cmd("child", "New child", () => addChild(act), shortcutLabel("Mod+Enter"));
      cmd("indent", "Indent", () => indentSelection(act), "Tab");
      cmd("outdent", "Outdent", () => outdentSelection(act), "Shift+Tab");
      cmd("up", "Move up (children stay)", () => moveNode(act, -1, false), shortcutLabel("Mod+Up"));
      cmd("down", "Move down (children stay)", () => moveNode(act, 1, false), shortcutLabel("Mod+Down"));
      cmd("up-kids", "Move up with children", () => moveNode(act, -1, true), shortcutLabel("Mod+Shift+Up"));
      cmd("down-kids", "Move down with children", () => moveNode(act, 1, true), shortcutLabel("Mod+Shift+Down"));
      cmd("collapse", "Collapse / expand", () => toggleCollapse(act), shortcutLabel("Mod+."));
      cmd("delete", "Delete selection (with children)", () => deleteIds(topLevelSelection(act)), shortcutLabel("Mod+Backspace"));
      cmd(
        "fields",
        "Edit fields in the side panel",
        () => {
          setPanelOpen(true);
          setPanelFocusToken((t) => t + 1);
        },
        shortcutLabel("Mod+E"),
      );
      cmd("move-to", "Move to another outline…", () => setMoveTarget(act));
      cmd("link", "Add a link to another node…", () => setLinkFrom(act));
      cmd("source", "Add a source", () => void actions.addSource(act, "casebook", "", null).then(() => setPanelOpen(true)));
      cmd("image", "Attach an image…", () => fileInputRef.current?.click());
      for (const s of NODE_STATUSES) cmd(`status:${s}`, `Set status: ${STATUS_LABELS[s]}`, () => setStatusFor(selectionIds(act), s));
      for (const t of NODE_TYPES) cmd(`type:${t}`, `Change type to: ${NODE_TYPE_DEFS[t].label}`, () => setTypeFor(selectionIds(act), t));
    } else {
      cmd("add-first", "Add a node", () => addTopLevel());
    }
    cmd("skeleton", skel ? "Turn skeleton mode off" : "Turn skeleton mode on", () => patchOutline({ options: { skeleton: !skel } }));
    for (const n of NUMBERING_STYLES) if (n !== numbering) cmd(`numbering:${n}`, `Numbering: ${NUMBERING_LABELS[n]}`, () => patchOutline({ numbering: n }));
    const levels = maxDepth(cur);
    for (let level = 1; level <= Math.max(1, levels - 1); level++) cmd(`collapse:${level}`, `Collapse to level ${level}`, () => history.replace(collapseToLevel(latest.current.nodes, level)));
    cmd("expand", "Expand all", () => history.replace(collapseToLevel(latest.current.nodes, 0)));
    cmd("undo", "Undo", undo, shortcutLabel("Mod+Z"));
    cmd("redo", "Redo", redo, shortcutLabel("Mod+Shift+Z"));
    cmd("panel", "Show / hide side panel", () => setPanelOpen((o) => !o));
    cmd("help", "Keyboard shortcuts", () => setHelpOpen(true));
    cmd("save", "Save now", () => void autosave.saveNow(), shortcutLabel("Mod+S"));
    cmd("course", "Back to the course page", () => router.push(`/courses/${bundle.course.slug}`));

    const nodeItems: PaletteItem[] = flatten(cur, false).map((r) => ({
      id: `node:${r.node.id}`,
      label: `${numberingLabel(numbering, r.path)} ${r.node.title || "(untitled)"}`,
      keywords: r.node.title,
      detail: ancestorIds(cur, r.node.id)
        .reverse()
        .map((a) => cur[a].title)
        .join(" › "),
      group: "Nodes",
      run: () => jumpTo(r.node.id),
    }));
    return [...cmds, ...nodeItems];
  }, [
    actions,
    addChild,
    addSibling,
    addTopLevel,
    autosave,
    bundle.course.slug,
    deleteIds,
    history,
    indentSelection,
    jumpTo,
    moveNode,
    numbering,
    outdentSelection,
    patchOutline,
    redo,
    router,
    selectionIds,
    setStatusFor,
    setTypeFor,
    toggleCollapse,
    topLevelSelection,
    undo,
  ]);

  const openPalette = useCallback(() => {
    setPalette((p) => (p.open ? { ...p, open: false } : { open: true, session: p.session + 1, items: buildPaletteItems() }));
  }, [buildPaletteItems]);
  const closePalette = useCallback(() => setPalette((p) => ({ ...p, open: false })), []);

  // Editor-wide shortcuts, wherever the focus is.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (!isMod(e)) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        openPalette();
      } else if (k === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (k === "e") {
        e.preventDefault();
        if (latest.current.active) {
          setPanelOpen(true);
          setPanelFocusToken((t) => t + 1);
        }
      } else if (k === "s") {
        e.preventDefault();
        void autosave.saveNow();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [autosave, openPalette, redo, undo]);

  // ---- drag and drop ----------------------------------------------------------------------------------

  const handlers = useMemo<RowHandlers>(
    () => ({
      onTitleChange: (id, title) => updateNode(id, { title }, `title:${id}`),
      onKeyDown: (e, id) => handleKey(e, id, e.currentTarget),
      onFocusRow: (id: string, e?: MouseEvent) => {
        const { rows: visible, selected: sel } = latest.current;
        if (e && e.shiftKey) {
          e.preventDefault();
          const anchor = anchorRef.current ?? id;
          const a = visible.findIndex((r) => r.node.id === anchor);
          const b = visible.findIndex((r) => r.node.id === id);
          if (a >= 0 && b >= 0) {
            const [lo, hi] = a < b ? [a, b] : [b, a];
            setSelected(new Set(visible.slice(lo, hi + 1).map((r) => r.node.id)));
            setActive(id);
          }
          return;
        }
        if (e && isMod(e)) {
          e.preventDefault();
          const next = new Set(sel);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          setSelected(next);
          setActive(id);
          anchorRef.current = id;
          return;
        }
        selectOnly(id);
      },
      onToggleCollapse: toggleCollapse,
      onCycleStatus: (id) => {
        const node = latest.current.nodes[id];
        if (!node) return;
        const next = STATUS_ORDER[(STATUS_ORDER.indexOf(node.status) + 1) % STATUS_ORDER.length];
        const ids = latest.current.selected.has(id) ? selectionIds(id) : [id];
        setStatusFor(ids, next);
      },
      onDragStart: (e: DragEvent, id: string) => {
        const ids = latest.current.selected.has(id) ? topLevelSelection(id) : [id];
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        setDrag(ids);
      },
      onDragOver: (e: DragEvent, targetId: string) => {
        const ids = dragRef.current;
        if (!ids) return;
        const cur = latest.current.nodes;
        if (ids.includes(targetId) || ids.some((d) => isDescendantOf(cur, targetId, d))) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const y = (e.clientY - rect.top) / Math.max(1, rect.height);
        const where: DropWhere = y < 0.35 ? "before" : y > 0.65 ? "after" : "inside";
        setDropTarget((t) => (t && t.id === targetId && t.where === where ? t : { id: targetId, where }));
      },
      onDrop: (e: DragEvent, targetId: string) => {
        e.preventDefault();
        const ids = dragRef.current;
        const target = dropRef.current;
        setDrag(null);
        setDropTarget(null);
        if (!ids || !target || target.id !== targetId) return;
        let next = latest.current.nodes;
        const t = next[targetId];
        if (!t) return;
        let parentId: string | null;
        let index: number;
        if (target.where === "inside") {
          parentId = targetId;
          index = 0;
          if (t.collapsed) next = { ...next, [targetId]: { ...t, collapsed: false } };
        } else {
          parentId = t.parentId;
          const siblings = childrenOf(next, parentId).filter((n) => !ids.includes(n.id));
          const i = siblings.findIndex((n) => n.id === targetId);
          index = target.where === "before" ? i : i + 1;
        }
        for (const id of ids) {
          const r = moveSubtree(next, id, parentId, index);
          if (r) {
            next = r;
            index++;
          }
        }
        commit(next);
        setSelected(new Set(ids));
        setActive(ids[0]);
      },
      onDragEnd: () => {
        setDrag(null);
        setDropTarget(null);
      },
      onFileDrop: (id, files) => {
        selectOnly(id);
        void uploadImages(id, files);
      },
      registerInput: (id, el) => {
        if (el) inputs.current.set(id, el);
        else inputs.current.delete(id);
      },
    }),
    [commit, handleKey, selectOnly, selectionIds, setStatusFor, toggleCollapse, topLevelSelection, updateNode, uploadImages],
  );

  // ---- render -----------------------------------------------------------------------------------------

  const activeNode = active ? (nodes[active] ?? null) : null;
  const saveLabel = { saved: "Saved", dirty: "Unsaved changes", saving: "Saving…", error: "Save failed, retrying…" }[autosave.state];
  const saveColor = { saved: "text-green-700", dirty: "text-gray-500", saving: "text-blue-700", error: "text-red-700" }[autosave.state];

  return (
    <div className="flex h-[calc(100vh-2.75rem)] min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-1.5 text-sm">
        <Link href={`/courses/${bundle.course.slug}`} className="text-gray-500 hover:text-gray-900" title="Back to the course">
          ← {bundle.course.title}
        </Link>
        <select
          className="input w-auto"
          value={outlineId}
          onChange={(e) => router.push(`/courses/${bundle.course.slug}/outlines/${e.target.value}`)}
          aria-label="Outline"
        >
          {outlines.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.kind})
            </option>
          ))}
        </select>
        <select className="input w-auto" value={numbering} onChange={(e) => patchOutline({ numbering: e.target.value as NumberingStyle })} aria-label="Numbering">
          {NUMBERING_STYLES.map((n) => (
            <option key={n} value={n}>
              {NUMBERING_LABELS[n]}
            </option>
          ))}
        </select>
        <label className={`btn cursor-pointer ${skeleton ? "border-amber-500 bg-amber-50" : ""}`} title="Skeleton mode: titles only, new nodes start as skeleton">
          <input type="checkbox" className="mr-1" checked={skeleton} onChange={(e) => patchOutline({ options: { skeleton: e.target.checked } })} />
          Skeleton
        </label>
        <select
          className="input w-auto"
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v === "") return;
            history.replace(collapseToLevel(latest.current.nodes, Number(v)));
          }}
          aria-label="Collapse to level"
        >
          <option value="">Collapse to…</option>
          {Array.from({ length: Math.max(1, depth - 1) }, (_, i) => i + 1).map((level) => (
            <option key={level} value={level}>
              Level {level}
            </option>
          ))}
          <option value="0">Expand all</option>
        </select>
        <button type="button" className="btn" onClick={undo} disabled={!history.canUndo} title={`Undo (${shortcutLabel("Mod+Z")})`}>
          Undo
        </button>
        <button type="button" className="btn" onClick={redo} disabled={!history.canRedo} title={`Redo (${shortcutLabel("Mod+Shift+Z")})`}>
          Redo
        </button>
        <input
          ref={searchRef}
          className="input w-44"
          placeholder={`Search (${shortcutLabel("Mod+F")})`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              setSearch("");
              if (latest.current.active) requestFocus(latest.current.active);
            } else if (e.key === "Enter") {
              e.preventDefault();
              const first = latest.current.rows.find((r) => nodeText(r.node).toLowerCase().includes(search.trim().toLowerCase()));
              if (first) jumpTo(first.node.id);
            }
          }}
        />
        <button type="button" className="btn" onClick={openPalette} title={shortcutLabel("Mod+K")}>
          {shortcutLabel("Mod+K")}
        </button>
        <button type="button" className="btn" onClick={() => setHelpOpen(true)} title="Keyboard shortcuts">
          ?
        </button>
        <span className="ml-auto text-xs text-gray-500">{allRows.length} nodes</span>
        {notice && <span className="text-xs text-amber-700">{notice}</span>}
        <span className={`text-xs ${saveColor}`} title={autosave.error ?? (autosave.savedAt ? `Last saved ${new Date(autosave.savedAt).toLocaleTimeString()}` : "")}>
          {saveLabel}
        </span>
        <button type="button" className="btn" onClick={() => setPanelOpen((o) => !o)}>
          {panelOpen ? "Hide panel" : "Show panel"}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Tree */}
        <div
          ref={treeRef}
          tabIndex={0}
          className="min-w-0 flex-1 overflow-y-auto px-3 py-3 outline-none"
          onKeyDown={(e) => {
            if (e.target !== treeRef.current) return;
            const act = latest.current.active;
            if (!act) return;
            if (e.key === "Enter" && !isMod(e) && !e.shiftKey) {
              e.preventDefault();
              requestFocus(act);
              return;
            }
            handleKey(e, act, null);
          }}
          onDragOver={(e) => {
            // Dropping on empty space at the end: after the last top-level node.
            if (!dragRef.current) return;
            if (e.target === treeRef.current) {
              e.preventDefault();
              const last = childrenOf(latest.current.nodes, null).slice(-1)[0];
              if (last && !dragRef.current.includes(last.id)) setDropTarget((t) => (t && t.id === last.id && t.where === "after" ? t : { id: last.id, where: "after" }));
            }
          }}
          onDrop={(e) => {
            if (e.target === treeRef.current && dropRef.current) handlers.onDrop(e, dropRef.current.id);
          }}
        >
          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              {search ? (
                "Nothing matches the search."
              ) : (
                <>
                  <p>This outline is empty.</p>
                  <button type="button" className="btn-primary mt-3" onClick={addTopLevel}>
                    Add the first node
                  </button>
                </>
              )}
            </div>
          ) : (
            rows.map((r) => (
              <TreeRow
                key={r.node.id}
                node={r.node}
                depth={r.depth}
                label={numberingLabel(numbering, r.path)}
                hasChildren={r.hasChildren}
                selected={selected.has(r.node.id)}
                active={active === r.node.id}
                skeleton={skeleton}
                dropWhere={dropTarget?.id === r.node.id ? dropTarget.where : null}
                dimmed={drag?.includes(r.node.id) ?? false}
                badges={badges[r.node.id] ?? NO_BADGES}
                handlers={handlers}
              />
            ))
          )}
          {rows.length > 0 && !search && (
            <button type="button" className="mt-2 ml-1 text-xs text-gray-400 hover:text-gray-700" onClick={addTopLevel}>
              + Add a top-level node
            </button>
          )}
        </div>

        {/* Side panel */}
        {panelOpen && (
          <div className="w-[400px] shrink-0 overflow-hidden">
            <SidePanel
              node={activeNode}
              nodes={allRows.map((r) => r.node)}
              nodesById={nodes}
              links={links}
              sources={sources}
              images={images}
              actions={actions}
              skeleton={skeleton}
              topicSuggestions={bundle.course.syllabusTopics}
              onPatch={updateNode}
              onField={setField}
              onRetype={(id, type) => setTypeFor([id], type)}
              onMoveTo={(id) => setMoveTarget(id)}
              onEscape={() => {
                if (latest.current.active) requestFocus(latest.current.active);
              }}
              onClose={() => setPanelOpen(false)}
              focusToken={panelFocusToken}
            />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const act = latest.current.active;
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (act && files.length) {
            setPanelOpen(true);
            void uploadImages(act, files);
          }
        }}
      />

      <CommandPalette key={palette.session} open={palette.open} items={palette.items} onClose={closePalette} />

      {moveTarget && nodes[moveTarget] && (
        <MoveToDialog
          open
          nodeTitle={nodes[moveTarget].title}
          outlines={outlines}
          currentOutlineId={outlineId}
          currentItems={allRows.filter((r) => r.node.id !== moveTarget && !ancestorIds(nodes, r.node.id).includes(moveTarget)).map((r) => ({ id: r.node.id, title: r.node.title, type: r.node.type, depth: r.depth }))}
          onClose={() => setMoveTarget(null)}
          onPick={(targetOutline, parentId) => void moveTo(moveTarget, targetOutline, parentId)}
        />
      )}

      {linkFrom && nodes[linkFrom] && (
        <NodePicker
          open
          title={`Link "${nodes[linkFrom].title || "(untitled)"}" to…`}
          items={allRows.filter((r) => r.node.id !== linkFrom).map((r) => ({ id: r.node.id, title: r.node.title, type: r.node.type, depth: r.depth }))}
          onClose={() => setLinkFrom(null)}
          onPick={(toId) => {
            const from = linkFrom;
            setLinkFrom(null);
            if (!toId) return;
            setPanelOpen(true);
            void actions.addLink(from, toId, "see also" as LinkKind, "").catch((e: Error) => flash(`Link failed: ${e.message}`));
          }}
        />
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onMouseDown={() => setHelpOpen(false)}>
          <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-5 shadow-xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium">Keyboard shortcuts</h2>
              <button type="button" className="text-sm text-gray-500 hover:text-gray-900" onClick={() => setHelpOpen(false)}>
                Close
              </button>
            </div>
            <table className="mt-3 w-full text-sm">
              <tbody>
                {SHORTCUTS.map(([combo, what]) => (
                  <tr key={combo} className="border-t border-gray-100">
                    <td className="py-1 pr-4 font-mono text-xs text-gray-700">{combo.split(" / ").map(shortcutLabel).join(" / ")}</td>
                    <td className="py-1 text-gray-600">{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
