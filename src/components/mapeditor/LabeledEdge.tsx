"use client";

import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { EDGE_DEFAULTS } from "@/lib/content/mapschema";
import type { MapEdge } from "./model";

export default function LabeledEdge(props: EdgeProps<MapEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, selected } = props;
  const kind = data?.kind ?? "plain";
  const def = EDGE_DEFAULTS[kind];
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const style = data?.style ?? def.style;
  const heads = data?.arrowheads ?? def.arrowheads;
  const label = data?.label ?? def.label;
  const dash = style === "dashed" ? "8 5" : style === "dotted" ? "2 4" : undefined;
  const markerId = `arrow-${kind.replace(/\s+/g, "-")}`;

  return (
    <>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={def.colour} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: selected ? "#1d4ed8" : def.colour, strokeWidth: selected ? 2.5 : 1.6, strokeDasharray: dash }}
        markerEnd={heads === "one" || heads === "both" ? `url(#${markerId})` : undefined}
        markerStart={heads === "both" ? `url(#${markerId})` : undefined}
        interactionWidth={16}
      />
      <EdgeLabelRenderer>
        <div
          className={`nodrag nopan absolute rounded px-1 text-[11px] ${label ? "bg-white/90 text-gray-800" : selected ? "bg-white/90 text-gray-400" : "text-transparent"}`}
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, pointerEvents: "all", border: selected ? "1px solid #1d4ed8" : undefined }}
          data-edge-label={id}
        >
          {label || (selected ? "(no label)" : "")}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
