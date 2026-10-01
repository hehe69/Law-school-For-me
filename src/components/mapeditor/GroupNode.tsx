"use client";

import { NodeResizer, type NodeProps } from "@xyflow/react";
import type { GroupNode as GroupNodeType } from "./model";
import { colourHex } from "./model";

export default function GroupNode({ data, selected }: NodeProps<GroupNodeType>) {
  const hex = colourHex(data.colour);
  return (
    <div className="h-full w-full rounded-lg" style={{ background: `${hex}66`, border: selected ? "2px solid #1d4ed8" : `2px dashed ${hex === "#ffffff" ? "#9ca3af" : hex}` }}>
      <NodeResizer isVisible={selected && !data.collapsed} minWidth={120} minHeight={80} lineStyle={{ borderColor: "#1d4ed8" }} />
      <div className="flex items-center gap-2 px-2 py-1 text-xs font-semibold text-gray-800">
        <span>{data.label || "Group"}</span>
        <span className="font-normal text-gray-500">({data.memberCount})</span>
        {data.collapsed && <span className="rounded bg-gray-800 px-1 text-[10px] text-white">collapsed</span>}
      </div>
    </div>
  );
}
