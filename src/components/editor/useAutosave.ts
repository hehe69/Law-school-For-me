"use client";

// Autosave: after every change, wait a moment, then send the difference between what the server has and what
// the editor shows. One request at a time; a change during a request is sent right after it. Failed saves
// retry, and the page warns before unloading with unsaved changes.

import { useCallback, useEffect, useRef, useState } from "react";
import type { NodeMap } from "@/lib/types";
import { diffNodes } from "@/lib/tree";

export type SaveState = "saved" | "dirty" | "saving" | "error";

const DEBOUNCE_MS = 400;
const RETRY_MS = 2500;

export function useAutosave(outlineId: string, initial: NodeMap, current: NodeMap) {
  const persisted = useRef<NodeMap>(initial);
  const latest = useRef<NodeMap>(current);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // flush calls itself after a save when more changes arrived meanwhile; go through a ref to avoid recursion.
  const flushRef = useRef<() => void>(() => {});

  const flush = useCallback(async () => {
    if (inflight.current) return;
    const target = latest.current;
    const diff = diffNodes(persisted.current, target);
    if (diff.upserts.length === 0 && diff.deletes.length === 0) {
      setState("saved");
      return;
    }
    inflight.current = true;
    setState("saving");
    try {
      const res = await fetch(`/api/outlines/${outlineId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(diff),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      const data = (await res.json()) as { savedAt: string };
      persisted.current = target;
      setSavedAt(data.savedAt);
      setError(null);
      inflight.current = false;
      if (latest.current !== target) setTimeout(() => flushRef.current(), 0);
      else setState("saved");
    } catch (e) {
      inflight.current = false;
      setError((e as Error).message);
      setState("error");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flushRef.current(), RETRY_MS);
    }
  }, [outlineId]);

  useEffect(() => {
    flushRef.current = () => void flush();
  }, [flush]);

  // Schedule a save whenever the tree changes.
  useEffect(() => {
    latest.current = current;
    if (current === persisted.current) {
      // Back to exactly what the server has (an undo): nothing to send.
      setState((s) => (s === "saving" ? s : "saved"));
      return;
    }
    const diff = diffNodes(persisted.current, current);
    if (diff.upserts.length === 0 && diff.deletes.length === 0) {
      setState("saved");
      return;
    }
    setState((s) => (s === "saving" ? s : "dirty"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current, flush]);

  // Last-chance save when the tab closes or is hidden.
  useEffect(() => {
    const sendNow = () => {
      const diff = diffNodes(persisted.current, latest.current);
      if (diff.upserts.length === 0 && diff.deletes.length === 0) return false;
      const blob = new Blob([JSON.stringify(diff)], { type: "application/json" });
      if (navigator.sendBeacon?.(`/api/outlines/${outlineId}/sync`, blob)) {
        persisted.current = latest.current;
        return false;
      }
      return true;
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (sendNow()) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") sendNow();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [outlineId]);

  const saveNow = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    return flush();
  }, [flush]);

  return { state, savedAt, error, saveNow };
}
