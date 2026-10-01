"use client";

// Pan-and-zoom map of a unit or course, drawn with cytoscape + dagre. Data comes from the server (lib/map.ts).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import dagre from "cytoscape-dagre";
import type { MapData, MapNode, Mastery } from "@/lib/map";

let registered = false;
// cytoscape-svg reads `window` when imported, so it is loaded in the browser only.
async function registerPlugins() {
  if (registered) return;
  cytoscape.use(dagre);
  const svg = (await import("cytoscape-svg")).default;
  cytoscape.use(svg);
  registered = true;
}

const MASTERY_FILL: Record<Mastery, string> = { green: "#bbf7d0", amber: "#fde68a", red: "#fecaca", grey: "#e5e7eb" };
const MASTERY_BORDER: Record<Mastery, string> = { green: "#15803d", amber: "#b45309", red: "#b91c1c", grey: "#6b7280" };

type Props = { data: MapData; title: string; highlightTopics: string[]; initialFocus?: string };

export default function GraphView({ data, title, highlightTopics, initialFocus }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [hideCases, setHideCases] = useState(false);
  const [hideClasses, setHideClasses] = useState(false);
  const [onlyWeak, setOnlyWeak] = useState(false);
  const [focus, setFocus] = useState<string>(initialFocus ?? "");
  const [tip, setTip] = useState<{ x: number; y: number; title: string; text: string } | null>(null);
  const [ready, setReady] = useState(0);

  const elements = useMemo<ElementDefinition[]>(() => {
    const highlight = new Set(highlightTopics.map((t) => t.toLowerCase()));
    const nodes = data.nodes.map((n) => ({
      data: { ...n, highlighted: n.kind === "topic" && highlight.has(n.label.toLowerCase()) },
      classes: [n.kind, n.mastery, n.draft ? "draft" : "", n.linked ? "" : "unlinked", n.uncovered ? "uncovered" : ""].filter(Boolean).join(" "),
    }));
    const edges = data.edges.map((e) => ({ data: { id: e.id, source: e.source, target: e.target, kind: e.kind }, classes: e.kind }));
    return [...nodes, ...edges];
  }, [data, highlightTopics]);

  // Build the graph once per data set.
  useEffect(() => {
    let cancelled = false;
    let cy: Core | null = null;
    void registerPlugins().then(() => {
      if (cancelled || !containerRef.current) return;
      cy = cytoscape({
      container: containerRef.current,
      elements,
      minZoom: 0.1,
      maxZoom: 4,
      wheelSensitivity: 0.2,
      style: [
        { selector: "node", style: { label: "data(label)", "text-wrap": "wrap", "text-max-width": "160px", "font-size": "11px", "text-valign": "center", "text-halign": "center", shape: "round-rectangle", width: "label", height: "label", padding: "8px", "background-color": "#f3f4f6", "border-width": 1.5, "border-color": "#6b7280", color: "#111827" } },
        { selector: "node.unit", style: { "background-color": "#1f2937", color: "#ffffff", "border-color": "#111827", "font-size": "13px", "font-weight": "bold", padding: "12px" } },
        { selector: "node.topic", style: { shape: "ellipse", "font-size": "9px", "background-color": "#f9fafb", "border-color": "#9ca3af", color: "#4b5563", padding: "4px" } },
        { selector: "node.topic.uncovered", style: { "border-style": "dashed", "border-color": "#b91c1c", color: "#b91c1c" } },
        { selector: "node[?highlighted]", style: { "background-color": "#fee2e2", "border-width": 3, "border-color": "#b91c1c", "font-size": "11px", "font-weight": "bold" } },
        { selector: "node.rule", style: { "font-weight": "bold", "font-size": "12px", "border-width": 2 } },
        { selector: "node.element", style: { "font-size": "10px" } },
        { selector: "node.exception", style: { "font-size": "9px", shape: "diamond", padding: "10px", "text-max-width": "120px" } },
        { selector: "node.wisconsin", style: { "font-size": "9px", "background-color": "#fef3c7", "border-color": "#b45309" } },
        { selector: "node.case", style: { "background-color": "#dbeafe", "border-color": "#1d4ed8", "font-style": "italic" } },
        { selector: "node.class", style: { "background-color": "#ede9fe", "border-color": "#6d28d9", "font-size": "10px" } },
        ...(Object.keys(MASTERY_FILL) as Mastery[]).map((m) => ({ selector: `node.${m}.rule, node.${m}.element, node.${m}.exception`, style: { "background-color": MASTERY_FILL[m], "border-color": MASTERY_BORDER[m] } })),
        { selector: "node.draft", style: { "border-style": "dashed" } },
        { selector: "node.unlinked", style: { opacity: 0.75 } },
        { selector: "edge", style: { width: 1.2, "line-color": "#9ca3af", "target-arrow-color": "#9ca3af", "target-arrow-shape": "triangle", "arrow-scale": 0.7, "curve-style": "bezier" } },
        { selector: "edge.case-rule", style: { "line-color": "#1d4ed8", "target-arrow-color": "#1d4ed8", "line-style": "dashed" } },
        { selector: "edge.class-rule", style: { "line-color": "#6d28d9", "target-arrow-color": "#6d28d9", "line-style": "dashed" } },
        { selector: "edge.rule-rule", style: { "line-color": "#374151", "target-arrow-color": "#374151", "line-style": "dotted", width: 1.5 } },
        { selector: "edge.unit-topic", style: { "line-color": "#d1d5db", "target-arrow-shape": "none" } },
        { selector: ".hidden", style: { display: "none" } },
      ],
      });
      cyRef.current = cy;
      if (process.env.NODE_ENV !== "production") (window as unknown as { __cy?: Core }).__cy = cy; // for browser tests
      cy.on("tap", "node", (evt) => {
        const href = evt.target.data("href") as string | undefined;
        if (href) router.push(href);
      });
      cy.on("mouseover", "node", (evt) => {
        const n = evt.target.data() as MapNode;
        const p = evt.target.renderedPosition();
        setTip({ x: p.x, y: p.y, title: n.label, text: n.hover });
      });
      cy.on("mouseout", "node", () => setTip(null));
      cy.on("pan zoom", () => setTip(null));
      setReady((r) => r + 1);
    });
    return () => {
      cancelled = true;
      cy?.destroy();
      cyRef.current = null;
    };
  }, [elements, router]);

  // Apply filters, then lay out what is visible: dagre for linked nodes, a column on the right for unlinked ones.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.batch(() => {
      cy.elements().removeClass("hidden");
      if (hideCases) cy.nodes(".case").addClass("hidden");
      if (hideClasses) cy.nodes(".class").addClass("hidden");
      if (onlyWeak) {
        cy.nodes(".rule").forEach((n) => {
          const m = n.data("mastery") as Mastery;
          if (m === "green" || m === "grey") {
            n.addClass("hidden");
            cy.nodes(`[rule = "${n.data("rule")}"]`).addClass("hidden");
          }
        });
        cy.nodes(".case, .class, .topic").forEach((n) => {
          const edges = n.connectedEdges().filter((e) => !e.source().hasClass("hidden") && !e.target().hasClass("hidden"));
          if (n.hasClass("topic") || edges.length === 0) n.addClass("hidden");
        });
      }
      if (focus) {
        const rule = cy.getElementById(focus);
        if (rule.nonempty()) {
          const keep = rule.union(cy.nodes(`[rule = "${rule.data("rule")}"]`)).union(rule.neighborhood("node")).union(cy.getElementById(`unit:${rule.data("unitSlug")}`));
          cy.nodes().not(keep).addClass("hidden");
        }
      }
      cy.edges().forEach((e) => { if (e.source().hasClass("hidden") || e.target().hasClass("hidden")) e.addClass("hidden"); });
    });
    const visible = cy.nodes().not(".hidden");
    const linked = visible.filter((n) => (n as cytoscape.NodeSingular).connectedEdges().not(".hidden").length > 0);
    const unlinked = visible.not(linked);
    if (linked.length > 0) {
      linked.union(linked.connectedEdges().not(".hidden")).layout({ name: "dagre", rankDir: "TB", nodeSep: 18, rankSep: 50, edgeSep: 10, fit: false } as cytoscape.LayoutOptions).run();
    }
    if (unlinked.length > 0) {
      const bb = linked.length ? linked.boundingBox() : { x2: 0, y1: 0 };
      let y = bb.y1;
      unlinked.forEach((n) => {
        n.position({ x: bb.x2 + 220, y });
        y += n.height() + 24;
      });
    }
    cy.fit(visible, 30);
  }, [hideCases, hideClasses, onlyWeak, focus, elements, ready]);

  function download(name: string, href: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    a.click();
  }
  function exportSvg() {
    const cy = cyRef.current;
    if (!cy) return;
    const text = (cy as unknown as { svg: (o: object) => string }).svg({ full: true, scale: 1 });
    download(`${title}.svg`, URL.createObjectURL(new Blob([text], { type: "image/svg+xml" })));
  }
  function exportPng() {
    const cy = cyRef.current;
    if (!cy) return;
    download(`${title}.png`, cy.png({ full: true, scale: 2, bg: "#ffffff" }));
  }

  const unlinkedCount = data.nodes.filter((n) => !n.linked).length;
  const focused = data.rules.find((r) => r.id === focus);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label><input type="checkbox" checked={hideCases} onChange={(e) => setHideCases(e.target.checked)} className="mr-1" />Hide cases</label>
        <label><input type="checkbox" checked={hideClasses} onChange={(e) => setHideClasses(e.target.checked)} className="mr-1" />Hide class notes</label>
        <label><input type="checkbox" checked={onlyWeak} onChange={(e) => setOnlyWeak(e.target.checked)} className="mr-1" />Only red and amber</label>
        <label>
          Focus rule{" "}
          <select value={focus} onChange={(e) => setFocus(e.target.value)} className="rounded border border-gray-300 px-1 py-0.5">
            <option value="">(all)</option>
            {data.rules.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </label>
        {focused && <a href={focused.treeHref} className="text-blue-700 underline">Open rule tree</a>}
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={() => cyRef.current?.fit(cyRef.current.nodes().not(".hidden"), 30)} className="rounded border border-gray-300 px-2 py-0.5">Fit</button>
          <button type="button" onClick={exportSvg} className="rounded border border-gray-300 px-2 py-0.5">Export SVG</button>
          <button type="button" onClick={exportPng} className="rounded border border-gray-300 px-2 py-0.5">Export PNG</button>
        </span>
      </div>
      <div className="relative">
        <div ref={containerRef} className="h-[70vh] w-full rounded border border-gray-300 bg-white" />
        {tip && (
          <div className="pointer-events-none absolute z-10 max-w-xs rounded border border-gray-300 bg-white p-2 text-xs shadow" style={{ left: tip.x + 12, top: tip.y + 12 }}>
            <p className="mb-1 font-semibold">{tip.title}</p>
            <p className="whitespace-pre-line">{tip.text}</p>
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-700">
        <span className="font-semibold">Legend:</span>
        {(["green", "amber", "red", "grey"] as Mastery[]).map((m) => (
          <span key={m} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border" style={{ background: MASTERY_FILL[m], borderColor: MASTERY_BORDER[m] }} /> {m === "grey" ? "no data" : m}</span>
        ))}
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-dashed border-gray-700" /> draft</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-blue-700 bg-blue-100" /> case</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded border border-purple-700 bg-purple-100" /> class note</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rotate-45 border border-gray-500 bg-gray-100" /> exception</span>
        <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border border-dashed border-red-700" /> topic with no notes</span>
        <span>Rule colour blends flashcard ease with the miss rate of questions tagged with the rule&apos;s topics; elements inherit it.</span>
        <span>Click a node to open it. Scroll to zoom, drag to pan.{unlinkedCount > 0 && ` ${unlinkedCount} note${unlinkedCount === 1 ? "" : "s"} not yet linked sit in the right-hand column.`}</span>
      </div>
    </div>
  );
}
