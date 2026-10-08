"use client";

// Undo/redo over whole tree states. The tree is an immutable map, so keeping 100 past versions is cheap
// (unchanged nodes are shared). Text edits to the same field within 1.5 s merge into one step.

import { useCallback, useRef, useState } from "react";

const LIMIT = 100;
const COALESCE_MS = 1500;

export function useHistory<T>(initial: T) {
  const [present, setPresentState] = useState<T>(initial);
  const [stacks, setStacks] = useState({ past: 0, future: 0 });
  const presentRef = useRef<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastKey = useRef<{ key: string; at: number } | null>(null);

  const setPresent = useCallback((next: T) => {
    presentRef.current = next;
    setPresentState(next);
    setStacks({ past: past.current.length, future: future.current.length });
  }, []);

  /** Record a new state. `coalesceKey` merges rapid successive edits of the same thing into one undo step. */
  const commit = useCallback(
    (next: T, coalesceKey?: string) => {
      if (next === presentRef.current) return;
      const now = Date.now();
      const merge = coalesceKey !== undefined && lastKey.current !== null && lastKey.current.key === coalesceKey && now - lastKey.current.at < COALESCE_MS;
      if (!merge) {
        past.current.push(presentRef.current);
        if (past.current.length > LIMIT) past.current.shift();
      }
      lastKey.current = coalesceKey !== undefined ? { key: coalesceKey, at: now } : null;
      future.current = [];
      setPresent(next);
    },
    [setPresent],
  );

  /** Change the state without an undo step (collapse toggles, server reloads). */
  const replace = useCallback(
    (next: T) => {
      lastKey.current = null;
      setPresent(next);
    },
    [setPresent],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return false;
    future.current.push(presentRef.current);
    lastKey.current = null;
    setPresent(prev);
    return true;
  }, [setPresent]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return false;
    past.current.push(presentRef.current);
    lastKey.current = null;
    setPresent(next);
    return true;
  }, [setPresent]);

  return {
    present,
    presentRef,
    commit,
    replace,
    undo,
    redo,
    canUndo: stacks.past > 0,
    canRedo: stacks.future > 0,
  };
}
