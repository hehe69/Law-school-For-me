"use client";

import { Handle, NodeResizer, Position, useConnection, type NodeProps } from "@xyflow/react";
import type { BoxNode as BoxNodeType } from "./model";
import { colourHex } from "./model";

const SHAPE_CLIP: Record<string, string | undefined> = {
  diamond: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
  hexagon: "polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)",
};

export default function BoxNode({ data, selected, width, height }: NodeProps<BoxNodeType>) {
  // While an arrow is being dragged, the whole box accepts the drop (not just the small edge handles).
  const connecting = useConnection().inProgress;
  const fill = data.displayColour ?? colourHex(data.colour);
  const firstLine = (data.definition || data.annotation || "").split("\n").find((l) => l.trim()) ?? "";
  const clip = SHAPE_CLIP[data.shape];
  const radius = data.shape === "circle" ? "50%" : data.shape === "rounded" ? "14px" : data.shape === "note-card" ? "2px 2px 2px 14px" : "3px";
  const border = selected ? "2px solid #1d4ed8" : data.highlight ? "3px solid #b91c1c" : data.linkMissing ? "2px dashed #b91c1c" : "1.5px solid rgba(0,0,0,0.45)";

  return (
    <div className="group relative h-full w-full" style={{ opacity: data.dim ? 0.3 : 1, width, height }} title={firstLine || undefined}>
      <NodeResizer isVisible={selected} minWidth={60} minHeight={36} lineStyle={{ borderColor: "#1d4ed8" }} handleStyle={{ width: 8, height: 8, background: "#1d4ed8" }} />
      <div
        className="flex h-full w-full items-center justify-center px-3 py-1 text-center text-[12px] leading-snug text-gray-900"
        style={{
          background: fill,
          clipPath: clip,
          borderRadius: clip ? undefined : radius,
          border: clip ? undefined : border,
          outline: clip && selected ? "2px solid #1d4ed8" : clip && data.highlight ? "3px solid #b91c1c" : undefined,
          boxShadow: data.shape === "note-card" ? "inset 6px 0 0 rgba(0,0,0,0.35), 2px 2px 0 rgba(0,0,0,0.15)" : undefined,
        }}
      >
        <span className="line-clamp-4 break-words">
          {data.label || <span className="text-gray-400">(untitled)</span>}
        </span>
      </div>
      {data.linkedNote && (
        <span className="absolute -right-1 -top-1 rounded-full border border-gray-400 bg-white px-1 text-[10px] leading-4" title={data.linkMissing ? `Linked note missing: ${data.linkedNote}` : `Linked to ${data.linkedNote}${data.linkedElement ? ` (element ${data.linkedElement})` : ""}`}>
          {data.linkMissing ? "⚠" : "🔗"}
        </span>
      )}
      {data.collapsed && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-gray-800 px-1.5 text-[10px] leading-4 text-white" title="Collapsed: contents hidden">
          +{data.hiddenCount ?? 0}
        </span>
      )}
      {firstLine && (
        <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden max-w-xs whitespace-pre-line rounded border border-gray-300 bg-white p-1.5 text-left text-[11px] text-gray-800 shadow group-hover:block">
          {firstLine}
        </div>
      )}
      <Handle
        id="body"
        type="target"
        position={Position.Top}
        isConnectableStart={false}
        className="!absolute !inset-0 !h-full !w-full !transform-none !rounded-none !border-0 !bg-transparent"
        style={{ opacity: 0, pointerEvents: connecting ? "all" : "none" }}
      />
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <Handle
          key={side}
          id={side}
          type="source"
          position={side === "top" ? Position.Top : side === "right" ? Position.Right : side === "bottom" ? Position.Bottom : Position.Left}
          className="!h-2.5 !w-2.5 !border !border-blue-700 !bg-white opacity-0 transition-opacity group-hover:opacity-100"
        />
      ))}
    </div>
  );
}
