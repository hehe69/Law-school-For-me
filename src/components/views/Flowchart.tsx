"use client";

// Draws the flowchart layout as SVG, with SVG and PNG export and printing.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import type { FlowLayout, FlowRule } from "@/lib/flowchart";
import { layoutRule } from "@/lib/flowchart";

const FILL: Record<string, string> = { rule: "#dbeafe", element: "#ffffff", exception: "#fee2e2", hypo: "#fef9c3", variation: "#dcfce7", end: "#dcfce7", fail: "#f3f4f6" };
const STROKE: Record<string, string> = { rule: "#1d4ed8", element: "#374151", exception: "#b91c1c", hypo: "#a16207", variation: "#15803d", end: "#15803d", fail: "#9ca3af" };

function edgePath(layout: FlowLayout, from: string, to: string): { d: string; lx: number; ly: number } | null {
  const a = layout.boxes.find((b) => b.id === from);
  const b = layout.boxes.find((b) => b.id === to);
  if (!a || !b) return null;
  // Same column: straight down. Otherwise: out of the right side into the left side.
  if (Math.abs(a.x - b.x) < 1) {
    const x = a.x + a.w / 2;
    return { d: `M ${x} ${a.y + a.h} L ${x} ${b.y}`, lx: x + 6, ly: (a.y + a.h + b.y) / 2 + 4 };
  }
  const x1 = a.x + a.w;
  const y1 = a.y + Math.min(a.h / 2, 20);
  const x2 = b.x;
  const y2 = b.y + Math.min(b.h / 2, 20);
  const mx = (x1 + x2) / 2;
  return { d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, lx: mx - 8, ly: (y1 + y2) / 2 - 4 };
}

function RuleSvg({ rule, layout, svgRef }: { rule: FlowRule; layout: FlowLayout; svgRef?: React.Ref<SVGSVGElement> }) {
  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} className="max-w-full" style={{ fontFamily: "Helvetica, Arial, sans-serif", fontSize: 12 }}>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151" />
        </marker>
      </defs>
      <rect x={0} y={0} width={layout.width} height={layout.height} fill="#ffffff" />
      {layout.edges.map((e, i) => {
        const p = edgePath(layout, e.from, e.to);
        if (!p) return null;
        return (
          <g key={i}>
            <path d={p.d} fill="none" stroke="#374151" strokeWidth={1.2} strokeDasharray={e.dashed ? "4 3" : undefined} markerEnd="url(#arrow)" />
            {e.label && (
              <text x={p.lx} y={p.ly} fontSize={10} fill="#4b5563">
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      {layout.boxes.map((b) => (
        <g key={b.id}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.kind === "element" ? 4 : 8} fill={FILL[b.kind]} stroke={STROKE[b.kind]} strokeWidth={b.kind === "rule" ? 1.8 : 1.2} />
          <text x={b.x + 10} y={b.y + 10 + 12} fill="#111827">
            {b.lines.map((line, i) => (
              <tspan key={i} x={b.x + 10} dy={i === 0 ? 0 : 16} fontWeight={i === 0 && b.kind !== "fail" ? 600 : 400}>
                {line}
              </tspan>
            ))}
          </text>
        </g>
      ))}
      <text x={layout.width - 10} y={layout.height - 6} textAnchor="end" fontSize={9} fill="#9ca3af">
        {rule.title}
      </text>
    </svg>
  );
}

export function Flowchart({ rules, courseSlug, outlineId, rootTitle, otherRules }: { rules: FlowRule[]; courseSlug: string; outlineId: string; rootTitle: string; otherRules: { id: string; title: string }[] }) {
  const router = useRouter();
  const refs = useRef<(SVGSVGElement | null)[]>([]);
  const layouts = rules.map((r) => layoutRule(r));

  const download = (name: string, blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const svgText = (i: number) => {
    const el = refs.current[i];
    if (!el) return null;
    const clone = el.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute("class");
    return new XMLSerializer().serializeToString(clone);
  };
  const exportSvg = (i: number) => {
    const text = svgText(i);
    if (text) download(`${slug(rules[i].title)}-flowchart.svg`, new Blob([text], { type: "image/svg+xml" }));
  };
  const exportPng = (i: number) => {
    const text = svgText(i);
    if (!text) return;
    const layout = layouts[i];
    const img = new Image();
    const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
    img.onload = () => {
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = layout.width * scale;
      canvas.height = layout.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) download(`${slug(rules[i].title)}-flowchart.png`, blob);
      }, "image/png");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <div className="flex flex-wrap items-center gap-3 print-hidden">
        <h1 className="text-xl font-semibold">Flowchart · {rootTitle}</h1>
        <span className="ml-auto" />
        <select className="input w-auto" value="" onChange={(e) => e.target.value && router.push(`/courses/${courseSlug}/outlines/${outlineId}/flowchart/${e.target.value}`)} aria-label="Other rules">
          <option value="">Other rules…</option>
          {otherRules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title || "(untitled)"}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={() => window.print()}>
          Print
        </button>
        <Link href={`/courses/${courseSlug}/outlines/${outlineId}`} className="btn">
          Editor
        </Link>
      </div>
      {rules.length === 0 && <p className="mt-4 text-sm text-gray-500">No rule nodes in this branch. Pick a rule (or a heading that contains rules).</p>}
      {rules.map((rule, i) => (
        <section key={rule.id} className="mt-6">
          <div className="mb-2 flex items-center gap-2 text-sm print-hidden">
            <span className="font-medium">{rule.title}</span>
            <span className="text-gray-400">
              {rule.elements.length} element{rule.elements.length === 1 ? "" : "s"}
            </span>
            <span className="ml-auto" />
            <button type="button" className="btn" onClick={() => exportSvg(i)}>
              Export SVG
            </button>
            <button type="button" className="btn" onClick={() => exportPng(i)}>
              Export PNG
            </button>
            <Link href={`/courses/${courseSlug}/outlines/${outlineId}?node=${rule.id}`} className="btn">
              Edit rule
            </Link>
          </div>
          <div className="overflow-auto rounded border border-gray-200 bg-white p-2">
            <RuleSvg
              rule={rule}
              layout={layouts[i]}
              svgRef={(el) => {
                refs.current[i] = el;
              }}
            />
          </div>
        </section>
      ))}
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rule";
}
