"use client";

// PNG / SVG export of the whole canvas or the selection, using html-to-image on the React Flow viewport.

import { getNodesBounds, getViewportForBounds, type Node } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

export async function exportImage(format: "png" | "svg", nodes: Node[], title: string, onlyIds?: Set<string>) {
  const viewport = document.querySelector(".react-flow__viewport") as HTMLElement | null;
  if (!viewport || nodes.length === 0) return;
  const chosen = onlyIds ? nodes.filter((n) => onlyIds.has(n.id)) : nodes;
  const bounds = getNodesBounds(chosen.length ? chosen : nodes);
  const pad = 40;
  const width = Math.ceil(bounds.width + pad * 2);
  const height = Math.ceil(bounds.height + pad * 2);
  const vp = getViewportForBounds(bounds, width, height, 0.1, 4, pad);
  const filter = (el: Element) => {
    if (!onlyIds) return true;
    const node = (el as HTMLElement).closest?.(".react-flow__node");
    if (node) return onlyIds.has((node as HTMLElement).dataset.id ?? "");
    const edge = (el as HTMLElement).closest?.(".react-flow__edge");
    if (edge) return (edge as HTMLElement).dataset.id !== undefined && onlyIds.has((edge as HTMLElement).dataset.id!);
    return true;
  };
  const options = {
    backgroundColor: "#ffffff",
    width,
    height,
    filter,
    style: { width: `${width}px`, height: `${height}px`, transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})` },
  };
  const url = format === "png" ? await toPng(viewport, { ...options, pixelRatio: 2 }) : await toSvg(viewport, options);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "map"}${onlyIds ? "-selection" : ""}.${format}`;
  a.click();
}
