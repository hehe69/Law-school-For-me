"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ExtractRow } from "@/lib/queries/extracts";
import { linkExtract } from "@/app/actions";
import { KindBadge } from "./badges";

interface SectionOpt {
  id: number;
  heading: string;
  claim: string;
  path: string;
  depth: number;
  support: number;
}

// Two columns: unlinked quotes on the left, outline sections (with claims) on the right.
// Click a quote then a claim, or drag a quote onto a claim, to link them.
export function Linker({ slug, quotes, sections }: { slug: string; quotes: ExtractRow[]; sections: SectionOpt[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const [lastMsg, setLastMsg] = useState<string | null>(null);

  const doLink = (extractId: number, sectionId: number) => {
    const q = quotes.find((x) => x.id === extractId);
    const s = sections.find((x) => x.id === sectionId);
    start(async () => {
      const res = await linkExtract(extractId, sectionId);
      if (res.ok) {
        setHidden((h) => new Set(h).add(extractId));
        setLastMsg(`Linked “${q?.short_cite}, ${q?.pin_cite}” to ${s?.heading}. A citation log row was created.`);
      }
      setSelected(null);
    });
  };

  const visible = quotes.filter((q) => !hidden.has(q.id));

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600">
        Click a quote, then click the section it supports; or drag a quote onto a section. {pending && "Saving…"}
      </p>
      {lastMsg && <p className="text-xs text-green-800">{lastMsg}</p>}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm mb-1">Unlinked quotes ({visible.length})</h3>
          {visible.length === 0 && <p className="text-sm text-gray-500">Every extract is linked to at least one section.</p>}
          <ul className="space-y-1">
            {visible.map((q) => (
              <li
                key={q.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", String(q.id));
                  e.dataTransfer.effectAllowed = "link";
                  setDragging(q.id);
                  setSelected(q.id);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                onClick={() => setSelected(selected === q.id ? null : q.id)}
                className={`card cursor-pointer text-sm ${selected === q.id ? "ring-2 ring-blue-500 bg-blue-50" : ""} ${dragging === q.id ? "opacity-40" : ""}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">
                    {q.short_cite}, {q.pin_cite}
                  </span>
                  <KindBadge kind={q.kind} />
                </div>
                <div className="italic text-gray-800 font-serif">“{q.text}”</div>
                {q.note && <div className="text-xs text-gray-600">{q.note}</div>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm mb-1">Sections</h3>
          {sections.length === 0 && (
            <p className="text-sm text-gray-500">
              No sections yet. <Link href={`/papers/${slug}/outline`}>Add some in the outline.</Link>
            </p>
          )}
          <ul className="space-y-1">
            {sections.map((s) => (
              <li
                key={s.id}
                style={{ marginLeft: s.depth * 16 }}
                onDragOver={(e) => {
                  if (dragging === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "link";
                  setOver(s.id);
                }}
                onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = dragging ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
                  setOver(null);
                  setDragging(null);
                  if (Number.isFinite(id)) doLink(id, s.id);
                }}
                onClick={() => {
                  if (selected !== null) doLink(selected, s.id);
                }}
                className={`card text-sm ${selected !== null ? "cursor-pointer hover:bg-blue-50" : ""} ${over === s.id ? "bg-blue-100 border-blue-500" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{s.path}</span>
                  <span className="font-medium">{s.heading}</span>
                  <span className={`badge ml-auto ${s.support === 0 ? "border-dashed border-red-400 text-red-700" : "border-gray-300"}`}>support {s.support}</span>
                </div>
                <div className="text-gray-700">{s.claim || <span className="text-gray-400 italic">no claim yet</span>}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
