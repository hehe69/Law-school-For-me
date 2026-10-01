"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type cytoscape from "cytoscape";
import type { MapData, MapNode } from "@/lib/queries/map";
import { LINK_PURPOSES } from "@/lib/types";
import { linkExtract, linkSource } from "@/app/actions";

const ROLE_BG: Record<string, string> = {
  argument: "#dbeafe",
  counterargument: "#fee2e2",
  response: "#dcfce7",
  background: "#e5e7eb",
};
const ROLE_BORDER: Record<string, string> = {
  argument: "#2563eb",
  counterargument: "#dc2626",
  response: "#16a34a",
  background: "#6b7280",
};
const READ_BG: Record<string, string> = { unread: "#f3f4f6", skimmed: "#fef9c3", read: "#dcfce7" };
const READ_BORDER: Record<string, string> = { unread: "#9ca3af", skimmed: "#ca8a04", read: "#16a34a" };

interface Filters {
  hideSources: boolean;
  hideExtracts: boolean;
  onlyUnsupported: boolean;
  branch: number | null;
}

interface PendingLink {
  sourceId: number;
  sectionId: number;
  sourceLabel: string;
  sectionLabel: string;
  x: number;
  y: number;
}

// Keep the inline link form inside the map container.
function clampForm(x: number, y: number, width: number) {
  return { left: Math.max(8, Math.min(x, width - 330)), top: Math.max(8, y) };
}

export function ArgumentMap({ slug, initial }: { slug: string; initial: MapData }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [data, setData] = useState<MapData>(initial);
  const [filters, setFilters] = useState<Filters>({ hideSources: false, hideExtracts: false, onlyUnsupported: false, branch: null });
  const [pending, setPending] = useState<PendingLink | null>(null);
  const [status, setStatus] = useState<string>("");
  const [ready, setReady] = useState(false);
  const grabPos = useRef<Map<string, { x: number; y: number }>>(new Map());

  const reload = useCallback(async () => {
    const res = await fetch(`/api/map/${slug}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, [slug]);

  // Which nodes are visible under the current filters.
  const elements = useMemo(() => buildElements(data, filters), [data, filters]);

  // Create the cytoscape instance once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ default: cytoscape }, { default: dagre }, { default: svg }] = await Promise.all([
        import("cytoscape"),
        import("cytoscape-dagre"),
        import("cytoscape-svg"),
      ]);
      if (cancelled || !containerRef.current) return;
      try {
        cytoscape.use(dagre);
      } catch {
        /* already registered */
      }
      try {
        cytoscape.use(svg);
      } catch {
        /* already registered */
      }
      const cy = cytoscape({
        container: containerRef.current,
        style: styleSheet(),
        minZoom: 0.1,
        maxZoom: 4,
      });
      cyRef.current = cy;
      // Handy for poking at the graph from the browser console.
      (window as unknown as { __cy?: cytoscape.Core }).__cy = cy;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, []);

  // Rebuild elements and layout whenever data or filters change.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    cy.elements().remove();
    cy.add(elements);
    runLayout(cy);
  }, [elements, ready]);

  // Interaction handlers (bound once; read latest state through refs).
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !ready) return;
    const onTap = (evt: cytoscape.EventObject) => {
      const n = evt.target as cytoscape.NodeSingular;
      const href = n.data("href") as string | undefined;
      if (href) router.push(href);
    };
    const onGrab = (evt: cytoscape.EventObject) => {
      const n = evt.target as cytoscape.NodeSingular;
      grabPos.current.set(n.id(), { ...n.position() });
    };
    const onDragFree = (evt: cytoscape.EventObject) => {
      const n = evt.target as cytoscape.NodeSingular;
      const kind = n.data("kind") as string;
      if (kind !== "source" && kind !== "extract") return;
      const pos = n.position();
      const target = cy
        .nodes('[kind = "section"]')
        .filter((s) => {
          const bb = s.boundingBox({ includeLabels: false });
          return pos.x >= bb.x1 && pos.x <= bb.x2 && pos.y >= bb.y1 && pos.y <= bb.y2;
        })
        .first();
      const snapBack = () => {
        const p = grabPos.current.get(n.id());
        if (p) n.position(p);
      };
      if (!target || target.length === 0) {
        snapBack();
        return;
      }
      const sectionId = target.data("dbId") as number;
      const dbId = n.data("dbId") as number;
      const already = cy.edges().filter((e) => e.data("source") === target.id() && e.data("target") === n.id()).length > 0;
      if (already) {
        setStatus(`${n.data("label")} is already linked to “${target.data("label")}”.`);
        snapBack();
        return;
      }
      if (kind === "extract") {
        setStatus("Linking…");
        linkExtract(dbId, sectionId).then(async (r) => {
          setStatus(r.ok ? `Linked extract ${n.data("label")} to “${target.data("label")}”. Citation log row created.` : "Could not link.");
          await reload();
        });
      } else {
        const rp = n.renderedPosition();
        const pos = clampForm(rp.x, rp.y, cy.width());
        setPending({
          sourceId: dbId,
          sectionId,
          sourceLabel: n.data("label"),
          sectionLabel: target.data("label"),
          x: pos.left,
          y: pos.top,
        });
      }
    };
    cy.on("tap", "node", onTap);
    cy.on("grab", "node", onGrab);
    cy.on("dragfree", "node", onDragFree);
    return () => {
      cy.off("tap", "node", onTap);
      cy.off("grab", "node", onGrab);
      cy.off("dragfree", "node", onDragFree);
    };
  }, [ready, router, reload]);

  const cancelPending = () => {
    setPending(null);
    const cy = cyRef.current;
    if (cy) runLayout(cy);
  };

  const submitPending = async (fd: FormData) => {
    if (!pending) return;
    const purpose = String(fd.get("purpose") ?? "support");
    const note = String(fd.get("note") ?? "");
    const r = await linkSource(pending.sectionId, pending.sourceId, purpose, note);
    if (!r.ok) {
      setStatus(r.error ?? "Could not link.");
      return;
    }
    setStatus(`Linked ${pending.sourceLabel} to “${pending.sectionLabel}”. Citation log row created.`);
    setPending(null);
    await reload();
  };

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportSvg = () => {
    const cy = cyRef.current;
    if (!cy) return;
    const svg = cy.svg({ full: true, scale: 1, bg: "#ffffff" });
    download(new Blob([svg], { type: "image/svg+xml" }), `${slug}-argument-map.svg`);
  };
  const exportPng = () => {
    const cy = cyRef.current;
    if (!cy) return;
    const blob = cy.png({ full: true, scale: 2, bg: "#ffffff", output: "blob" });
    download(blob, `${slug}-argument-map.png`);
  };

  const sectionNodes = data.sections;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={filters.hideSources} onChange={(e) => setFilters({ ...filters, hideSources: e.target.checked })} />
          hide sources
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={filters.hideExtracts} onChange={(e) => setFilters({ ...filters, hideExtracts: e.target.checked })} />
          hide extracts
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={filters.onlyUnsupported} onChange={(e) => setFilters({ ...filters, onlyUnsupported: e.target.checked })} />
          show only unsupported
        </label>
        <label className="flex items-center gap-1">
          only branch
          <select value={filters.branch ?? ""} onChange={(e) => setFilters({ ...filters, branch: e.target.value ? parseInt(e.target.value, 10) : null })}>
            <option value="">(whole map)</option>
            {sectionNodes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.path} {s.heading}
              </option>
            ))}
          </select>
        </label>
        <span className="flex gap-1 ml-auto">
          <button type="button" onClick={() => cyRef.current && runLayout(cyRef.current)}>
            Re-layout
          </button>
          <button type="button" onClick={() => cyRef.current?.fit(undefined, 30)}>
            Fit
          </button>
          <button type="button" onClick={exportSvg}>
            Export SVG
          </button>
          <button type="button" onClick={exportPng}>
            Export PNG
          </button>
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-700 items-center">
        <Legend color={ROLE_BG.argument} border={ROLE_BORDER.argument} label="argument" />
        <Legend color={ROLE_BG.counterargument} border={ROLE_BORDER.counterargument} label="counterargument" />
        <Legend color={ROLE_BG.response} border={ROLE_BORDER.response} label="response" />
        <Legend color={ROLE_BG.background} border={ROLE_BORDER.background} label="background" />
        <span className="mx-1">|</span>
        <Legend color={READ_BG.unread} border={READ_BORDER.unread} label="unread source" round />
        <Legend color={READ_BG.skimmed} border={READ_BORDER.skimmed} label="skimmed" round />
        <Legend color={READ_BG.read} border={READ_BORDER.read} label="read" round />
        <span className="mx-1">|</span>
        <span>
          <span className="inline-block w-4 border-t-2 border-dashed border-red-500 align-middle mr-1" />
          dashed border = no support; red dashed edge = counterargument ↔ response
        </span>
        <span className="mx-1">|</span>
        <span>Drag a source or extract onto a section to link it. Click a node to open its page.</span>
      </div>
      <div className="relative border border-gray-300 rounded bg-white" style={{ height: "calc(100vh - 230px)", minHeight: 480 }}>
        <div ref={containerRef} className="w-full h-full" />
        {pending && (
          <form
            action={submitPending}
            className="absolute z-10 card shadow-lg text-sm w-80 space-y-1"
            style={{ left: pending.x, top: pending.y }}
          >
            <div className="font-medium">
              Link {pending.sourceLabel} → “{pending.sectionLabel}”
            </div>
            <select name="purpose" className="w-full">
              {LINK_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <textarea name="note" rows={2} required placeholder="What this source proves for this section (required)" className="w-full" autoFocus />
            <div className="flex gap-2">
              <button type="submit" className="primary">
                Link
              </button>
              <button type="button" onClick={cancelPending}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
      {status && <p className="text-xs text-gray-700">{status}</p>}
    </div>
  );
}

function Legend({ color, border, label, round }: { color: string; border: string; label: string; round?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-3 h-3 ${round ? "rounded-full" : "rounded-sm"}`} style={{ background: color, border: `1.5px solid ${border}` }} />
      {label}
    </span>
  );
}

function buildElements(data: MapData, f: Filters): cytoscape.ElementDefinition[] {
  const nodeById = new Map(data.nodes.map((n) => [n.id, n]));
  const sections = data.nodes.filter((n) => n.kind === "section");
  const childrenOf = new Map<number | null, MapNode[]>();
  for (const s of sections) childrenOf.set(s.parentSection ?? null, [...(childrenOf.get(s.parentSection ?? null) ?? []), s]);

  let keep = new Set<string>(data.nodes.map((n) => n.id));
  const faded = new Set<string>();

  if (f.branch !== null) {
    const ids = new Set<string>();
    const walk = (id: number) => {
      ids.add(`sec-${id}`);
      for (const c of childrenOf.get(id) ?? []) walk(c.dbId);
    };
    walk(f.branch);
    keep = new Set([...ids]);
    // sources/extracts hanging off kept sections
    for (const e of data.edges) if ((e.kind === "source" || e.kind === "extract") && ids.has(e.source)) keep.add(e.target);
  }
  if (f.onlyUnsupported) {
    const ids = new Set<string>(["thesis"]);
    const parentOf = new Map(sections.map((s) => [s.id, s.parentSection ? `sec-${s.parentSection}` : "thesis"]));
    for (const s of sections) {
      if (!s.unsupported) continue;
      ids.add(s.id);
      let p = parentOf.get(s.id);
      while (p && p !== "thesis") {
        if (!ids.has(p)) faded.add(p);
        ids.add(p);
        p = parentOf.get(p);
      }
    }
    keep = new Set([...keep].filter((id) => ids.has(id)));
  }
  if (f.hideSources) for (const n of data.nodes) if (n.kind === "source") keep.delete(n.id);
  if (f.hideExtracts) for (const n of data.nodes) if (n.kind === "extract") keep.delete(n.id);

  const hasStaging = data.nodes.some((n) => keep.has(n.id) && n.staging);
  const els: cytoscape.ElementDefinition[] = [];
  if (hasStaging) {
    els.push({ data: { id: "staging", label: "Staging: unlinked", kind: "staging" }, classes: "staging-box", grabbable: false, selectable: false });
  }
  for (const n of data.nodes) {
    if (!keep.has(n.id)) continue;
    const classes: string[] = [n.kind];
    if (n.unsupported) classes.push("unsupported");
    if (n.staging) classes.push("staging");
    if (faded.has(n.id)) classes.push("faded");
    els.push({
      data: {
        id: n.id,
        label: n.kind === "thesis" ? trimLabel(n.label, 140) : n.kind === "section" ? trimLabel(n.label, 60) : trimLabel(n.label, 40),
        title: n.title ?? n.label,
        kind: n.kind,
        dbId: n.dbId,
        href: n.href,
        role: n.role ?? "",
        readStatus: n.readStatus ?? "",
        parent: n.staging ? "staging" : undefined,
      },
      classes: classes.join(" "),
      grabbable: n.kind === "source" || n.kind === "extract",
    });
  }
  for (const e of data.edges) {
    if (!keep.has(e.source) || !keep.has(e.target)) continue;
    if (!nodeById.has(e.source) || !nodeById.has(e.target)) continue;
    els.push({ data: { id: e.id, source: e.source, target: e.target, kind: e.kind }, classes: e.kind });
  }
  return els;
}

function trimLabel(s: string, n: number) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function runLayout(cy: cytoscape.Core) {
  const staged = cy.nodes(".staging");
  const box = cy.nodes(".staging-box");
  const main = cy.elements().not(staged).not(box);
  if (main.nodes().length > 0) {
    main.layout({ name: "dagre", rankDir: "TB", nodeSep: 24, rankSep: 70, edgeSep: 10, animate: false, fit: false } as cytoscape.LayoutOptions).run();
  }
  if (staged.length > 0) {
    const bb = main.nodes().length > 0 ? main.nodes().boundingBox({ includeLabels: true }) : { x1: 0, y1: 0, x2: 0, y2: 0 };
    // One column (two when there are many) hugging the right edge of the laid-out tree.
    const perRow = staged.length > 8 ? 2 : 1;
    const x0 = bb.x2 + 140;
    let y = bb.y1 + 40;
    staged.forEach((n, i) => {
      const col = i % perRow;
      n.position({ x: x0 + col * 170, y });
      if (col === perRow - 1) y += 56;
    });
  }
  cy.fit(undefined, 30);
}

function styleSheet(): cytoscape.StylesheetJson {
  return [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-wrap": "wrap",
        "text-max-width": "150px",
        "font-size": "11px",
        "text-valign": "center",
        "text-halign": "center",
        shape: "round-rectangle",
        width: "label",
        height: "label",
        padding: "8px",
        "background-color": "#f9fafb",
        "border-width": 1.5,
        "border-color": "#9ca3af",
        color: "#111827",
      } as cytoscape.Css.Node,
    },
    {
      selector: "node.thesis",
      style: {
        "background-color": "#111827",
        "border-color": "#111827",
        color: "#ffffff",
        "font-size": "12px",
        "font-weight": "bold",
        "text-max-width": "280px",
        padding: "12px",
      } as cytoscape.Css.Node,
    },
    ...Object.keys(ROLE_BG).map((role) => ({
      selector: `node.section[role = "${role}"]`,
      style: { "background-color": ROLE_BG[role], "border-color": ROLE_BORDER[role], "font-weight": "bold" } as cytoscape.Css.Node,
    })),
    {
      selector: "node.section.unsupported",
      style: { "border-style": "dashed", "border-width": 2.5, "border-color": "#dc2626" } as cytoscape.Css.Node,
    },
    ...Object.keys(READ_BG).map((rs) => ({
      selector: `node.source[readStatus = "${rs}"]`,
      style: { "background-color": READ_BG[rs], "border-color": READ_BORDER[rs], shape: "ellipse", padding: "10px" } as cytoscape.Css.Node,
    })),
    {
      selector: "node.extract",
      style: {
        shape: "round-tag",
        "background-color": "#fdf2f8",
        "border-color": "#be185d",
        "font-size": "9px",
        padding: "4px",
        "text-max-width": "110px",
      } as cytoscape.Css.Node,
    },
    {
      selector: "node.faded",
      style: { opacity: 0.35 } as cytoscape.Css.Node,
    },
    {
      selector: "node.staging-box",
      style: {
        shape: "round-rectangle",
        "background-color": "#fffbeb",
        "background-opacity": 0.6,
        "border-color": "#f59e0b",
        "border-style": "dashed",
        "border-width": 1.5,
        label: "data(label)",
        "text-valign": "top",
        "text-halign": "center",
        "font-size": "11px",
        color: "#92400e",
        padding: "16px",
      } as cytoscape.Css.Node,
    },
    {
      selector: "node:active, node:grabbed",
      style: { "overlay-opacity": 0.1 } as cytoscape.Css.Node,
    },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "line-color": "#9ca3af",
        "curve-style": "bezier",
        "target-arrow-shape": "none",
      } as cytoscape.Css.Edge,
    },
    { selector: "edge.tree", style: { "line-color": "#4b5563", width: 2 } as cytoscape.Css.Edge },
    { selector: "edge.source", style: { "line-style": "dotted", "line-color": "#6b7280" } as cytoscape.Css.Edge },
    { selector: "edge.extract", style: { "line-style": "dotted", "line-color": "#be185d", width: 1 } as cytoscape.Css.Edge },
    {
      selector: "edge.responds",
      style: {
        "line-style": "dashed",
        "line-color": "#dc2626",
        width: 2,
        "target-arrow-shape": "triangle",
        "target-arrow-color": "#dc2626",
        "curve-style": "unbundled-bezier",
        "control-point-distances": [60],
        "control-point-weights": [0.5],
      } as cytoscape.Css.Edge,
    },
  ];
}
