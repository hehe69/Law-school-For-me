"use client";

// "Move to": send a node (with its children) into another outline of the course, under a chosen parent.

import { useEffect, useState } from "react";
import type { OutlineKind } from "@/lib/types";
import { api } from "@/lib/client";
import { NodePicker, type PickerItem } from "./NodePicker";

export type OutlineChoice = { id: string; name: string; kind: OutlineKind };

type Props = {
  open: boolean;
  nodeTitle: string;
  outlines: OutlineChoice[];
  currentOutlineId: string;
  /** Nodes of the current outline (used without a fetch when the target is the current outline) */
  currentItems: PickerItem[];
  onClose: () => void;
  onPick: (outlineId: string, parentId: string | null) => void;
};

export function MoveToDialog({ open, nodeTitle, outlines, currentOutlineId, currentItems, onClose, onPick }: Props) {
  const defaultTarget = outlines.find((o) => o.kind === "full" && o.id !== currentOutlineId) ?? outlines.find((o) => o.id !== currentOutlineId) ?? outlines[0];
  const [target, setTarget] = useState(defaultTarget?.id ?? currentOutlineId);
  // Nodes of another outline are fetched; the current outline's come from props.
  const [remote, setRemote] = useState<{ outlineId: string; items: PickerItem[] } | null>(null);
  const items: PickerItem[] | null = target === currentOutlineId ? currentItems : remote?.outlineId === target ? remote.items : null;

  useEffect(() => {
    if (!open || target === currentOutlineId) return;
    let cancelled = false;
    api
      .get<PickerItem[]>(`/api/outlines/${target}/nodes`)
      .then((list) => {
        if (!cancelled) setRemote({ outlineId: target, items: list });
      })
      .catch(() => {
        if (!cancelled) setRemote({ outlineId: target, items: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [open, target, currentOutlineId]);

  if (!open) return null;
  return (
    <NodePicker
      open={open}
      title={`Move "${nodeTitle || "(untitled)"}" to…`}
      items={items ?? []}
      allowTopLevel
      onPick={(parentId) => onPick(target, parentId)}
      onClose={onClose}
      header={
        <label className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Outline</span>
          <select className="input w-auto" value={target} onChange={(e) => setTarget(e.target.value)}>
            {outlines.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.kind}){o.id === currentOutlineId ? " — this one" : ""}
              </option>
            ))}
          </select>
          {items === null && <span className="text-xs text-gray-400">loading…</span>}
          <span className="ml-auto text-xs text-gray-400">Pick the new parent; the node goes last under it.</span>
        </label>
      }
    />
  );
}
