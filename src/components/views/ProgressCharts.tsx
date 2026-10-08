"use client";

// Progress charts: status bars per section (labels and a table beside the colour, never colour alone) and a
// single-series word-count timeline with a crosshair tooltip.

import { useState } from "react";
import type { NodeStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/fields";

// Status palette (reserved, shown with labels): empty grey, skeleton amber, drafted blue, final green.
export const STATUS_FILL: Record<NodeStatus, string> = { empty: "#9ca3af", skeleton: "#d97706", drafted: "#2563eb", final: "#15803d" };
const ORDER: NodeStatus[] = ["final", "drafted", "skeleton", "empty"];

export function StatusBar({ counts, compact }: { counts: Record<NodeStatus, number> & { total: number }; compact?: boolean }) {
  if (counts.total === 0) return <div className="text-xs text-gray-400">no nodes</div>;
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={ORDER.map((s) => `${STATUS_LABELS[s]} ${counts[s]}`).join(", ")}>
        {ORDER.filter((s) => counts[s] > 0).map((s) => (
          <div key={s} style={{ width: `${(counts[s] / counts.total) * 100}%`, background: STATUS_FILL[s] }} title={`${STATUS_LABELS[s]}: ${counts[s]}`} />
        ))}
      </div>
      {!compact && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
          {ORDER.map((s) => (
            <span key={s} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: STATUS_FILL[s] }} />
              {STATUS_LABELS[s]} {counts[s]} ({Math.round((counts[s] / counts.total) * 100)}%)
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export type TimelinePoint = { date: string; words: number; label: string };

export function WordTimeline({ points }: { points: TimelinePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const height = 220;
  const pad = { l: 48, r: 24, t: 16, b: 32 };
  if (points.length < 2) {
    return (
      <div className="text-sm text-gray-500">
        {points.length === 1 ? `${points[0].words} words now.` : "No data yet."} The timeline fills in as daily snapshots accumulate (one is taken when you open an outline that changed since the last one) and when you take
        manual snapshots.
      </div>
    );
  }
  const times = points.map((p) => new Date(p.date).getTime());
  const t0 = Math.min(...times);
  const t1 = Math.max(...times);
  const maxWords = Math.max(1, ...points.map((p) => p.words));
  const niceMax = Math.ceil(maxWords / 100) * 100 || 100;
  const x = (t: number) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (width - pad.l - pad.r);
  const y = (w: number) => height - pad.b - (w / niceMax) * (height - pad.t - pad.b);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(times[i]).toFixed(1)} ${y(p.words).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
  const fmtDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const last = points.length - 1;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[720px]"
        role="img"
        aria-label="Word count over time"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * width;
          let best = 0;
          for (let i = 1; i < points.length; i++) if (Math.abs(x(times[i]) - px) < Math.abs(x(times[best]) - px)) best = i;
          setHover(best);
        }}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#6b7280">
              {t}
            </text>
          </g>
        ))}
        <text x={pad.l} y={height - 8} fontSize={10} fill="#6b7280">
          {fmtDate(t0)}
        </text>
        <text x={width - pad.r} y={height - 8} fontSize={10} fill="#6b7280" textAnchor="end">
          {fmtDate(t1)}
        </text>
        <path d={path} fill="none" stroke="#2563eb" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={i} cx={x(times[i])} cy={y(p.words)} r={hover === i ? 5 : 4} fill={hover === i ? "#2563eb" : "#ffffff"} stroke="#2563eb" strokeWidth={2} />
        ))}
        <text x={x(times[last]) - 8} y={y(points[last].words) - 10} fontSize={11} fill="#374151" textAnchor="end">
          {points[last].words} words
        </text>
        {hover !== null && (
          <g>
            <line x1={x(times[hover])} x2={x(times[hover])} y1={pad.t} y2={height - pad.b} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />
            <foreignObject x={Math.min(x(times[hover]) + 8, width - 180)} y={pad.t} width={172} height={48}>
              <div className="rounded border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 shadow">
                <div className="font-medium">{points[hover].words} words</div>
                <div className="text-gray-500">
                  {fmtDate(times[hover])}
                  {points[hover].label ? ` · ${points[hover].label}` : ""}
                </div>
              </div>
            </foreignObject>
          </g>
        )}
      </svg>
      <details className="mt-1 text-xs text-gray-500">
        <summary className="cursor-pointer">Table</summary>
        <table className="mt-1 text-xs">
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td className="pr-3">{new Date(p.date).toLocaleString()}</td>
                <td className="pr-3 text-right">{p.words}</td>
                <td className="text-gray-400">{p.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
