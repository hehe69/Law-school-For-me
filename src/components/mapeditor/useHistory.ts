"use client";

// Snapshot-based undo/redo. Call takeSnapshot() before any change you want to be undoable.

import { useCallback, useRef, useState } from "react";
import type { AnyNode, MapEdge } from "./model";

export const HISTORY_LIMIT = 100;

type Snapshot = { nodes: AnyNode[]; edges: MapEdge[] };

export function useHistory(getCurrent: () => Snapshot, restore: (s: Snapshot) => void) {
  const past = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const [counts, setCounts] = useState({ past: 0, future: 0 });
  const bump = () => setCounts({ past: past.current.length, future: future.current.length });

  const clone = (s: Snapshot): Snapshot => JSON.parse(JSON.stringify(s));

  const takeSnapshot = useCallback(() => {
    past.current.push(clone(getCurrent()));
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
    bump();
  }, [getCurrent]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(clone(getCurrent()));
    restore(prev);
    bump();
  }, [getCurrent, restore]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(clone(getCurrent()));
    restore(next);
    bump();
  }, [getCurrent, restore]);

  return { takeSnapshot, undo, redo, canUndo: counts.past > 0, canRedo: counts.future > 0 };
}
