"use client";

// Read-only print view: "fit" scales the whole canvas onto one landscape page; "tile" draws it at full size and
// lets the browser paginate.

import { useEffect, useMemo } from "react";
import { ReactFlow, ReactFlowProvider, getNodesBounds } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { MapFile } from "@/lib/content/mapschema";
import BoxNode from "./BoxNode";
import GroupNode from "./GroupNode";
import LabeledEdge from "./LabeledEdge";
import { fromFile } from "./model";

const nodeTypes = { box: BoxNode, group: GroupNode };
const edgeTypes = { labeled: LabeledEdge };

export default function MapPrint({ file, mode, title }: { file: MapFile; mode: "fit" | "tile"; title: string }) {
  const { nodes, edges } = useMemo(() => fromFile(file), [file]);
  const bounds = useMemo(() => getNodesBounds(nodes), [nodes]);
  const size = mode === "fit" ? { width: 1100, height: 760 } : { width: Math.ceil(bounds.width + 80), height: Math.ceil(bounds.height + 80) };
  useEffect(() => {
    const t = setTimeout(() => window.print(), 800);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="bg-white">
      <style>{`@media print { @page { size: ${mode === "fit" ? "landscape" : "auto"}; margin: 10mm; } header, .no-print { display: none !important; } }`}</style>
      <p className="no-print mb-2 text-sm text-gray-600">{title} · print preview ({mode === "fit" ? "fit to one page" : "tiled at full size"}). The print dialog opens automatically; close it to come back.</p>
      <div style={{ width: size.width, height: size.height }}>
        <ReactFlowProvider>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={mode === "fit" ? { padding: 0.05 } : { padding: 0.02, minZoom: 1, maxZoom: 1 }}
            minZoom={0.05}
            maxZoom={1}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            proOptions={{ hideAttribution: true }}
          />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
