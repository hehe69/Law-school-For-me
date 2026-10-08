"use client";

// Exam mode: the outline as a large, searchable, read-only document over the whole screen, with up to five
// pinned sections in a sidebar, a split view of two sections, Cmd-K jumping and a dark / light toggle.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeMap, OutlineBundle, OutlineNode } from "@/lib/types";
import { ancestorIds, childrenOf, flatten } from "@/lib/tree";
import { numberingLabel } from "@/lib/numbering";
import { nodeText } from "@/lib/fields";
import { isMod, shortcutLabel } from "@/lib/keys";
import type { Term } from "@/lib/glossary";
import { api } from "@/lib/client";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { NodeDocument } from "@/components/doc/NodeDocument";
import { CommandPalette, type PaletteItem } from "@/components/editor/CommandPalette";

const MAX_PINS = 5;

export function ExamMode({ bundle, terms }: { bundle: OutlineBundle; terms: Term[] }) {
  const { outline, course } = bundle;
  const nodes = bundle.nodes;
  const map = useMemo(() => {
    const m: NodeMap = {};
    for (const n of nodes) m[n.id] = n;
    return m;
  }, [nodes]);
  const rows = useMemo(() => flatten(map, false), [map]);
  const sections = useMemo(() => childrenOf(map, null), [map]);
  const [pins, setPins] = useState<string[]>(() => (outline.options.pins ?? []).filter((id) => map[id]));
  const [split, setSplit] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Theme preference lives in the browser.
  const [theme, setTheme] = useLocalStorage<"light" | "dark">("exam-theme", "light");
  const dark = theme === "dark";
  const [palette, setPalette] = useState<{ open: boolean; session: number }>({ open: false, session: 0 });
  const searchRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const toggleTheme = useCallback(() => setTheme(dark ? "light" : "dark"), [dark, setTheme]);

  const savePins = useCallback(
    (next: string[]) => {
      setPins(next);
      void api.patch(`/api/outlines/${outline.id}`, { options: { pins: next } });
    },
    [outline.id],
  );
  const togglePin = useCallback(
    (id: string) => {
      const next = pins.includes(id) ? pins.filter((p) => p !== id) : pins.length >= MAX_PINS ? pins : [...pins, id];
      savePins(next);
    },
    [pins, savePins],
  );

  const jumpTo = useCallback((id: string) => {
    setFocusId(null);
    requestAnimationFrame(() => {
      const el = document.getElementById(`node-${id}`);
      if (!el) return;
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      el.classList.remove("exam-hit");
      void el.offsetWidth;
      el.classList.add("exam-hit");
    });
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return rows.filter((r) => nodeText(r.node).toLowerCase().includes(q)).slice(0, 40);
  }, [rows, query]);

  const paletteItems = useMemo<PaletteItem[]>(
    () => [
      { id: "cmd:theme", label: dark ? "Light theme" : "Dark theme", group: "Commands", run: toggleTheme },
      { id: "cmd:split-off", label: "Close the split view", group: "Commands", run: () => setSplit(null) },
      { id: "cmd:all", label: "Show the whole outline", group: "Commands", run: () => setFocusId(null) },
      ...rows.map((r) => ({
        id: `node:${r.node.id}`,
        label: `${numberingLabel(outline.numbering, r.path)} ${r.node.title || "(untitled)"}`,
        keywords: r.node.title,
        detail: ancestorIds(map, r.node.id)
          .reverse()
          .map((a) => map[a].title)
          .join(" › "),
        group: "Nodes" as const,
        run: () => jumpTo(r.node.id),
      })),
    ],
    [rows, outline.numbering, map, jumpTo, dark, toggleTheme],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isMod(e) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => ({ open: !p.open, session: p.session + 1 }));
      } else if (isMod(e) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const titleOf = (id: string) => map[id]?.title || "(untitled)";
  const sectionTools = (node: OutlineNode) => (
    <span className="flex gap-1 print-hidden">
      <button type="button" className="btn py-0 text-xs" onClick={() => togglePin(node.id)} title={pins.includes(node.id) ? "Unpin" : pins.length >= MAX_PINS ? "Five pins already" : "Pin to the sidebar"}>
        {pins.includes(node.id) ? "Unpin" : "Pin"}
      </button>
      <button type="button" className="btn py-0 text-xs" onClick={() => setSplit(node.id)} title="Show this section in the right half">
        Split
      </button>
      <button type="button" className="btn py-0 text-xs" onClick={() => setFocusId(node.id)} title="Show only this section">
        Only
      </button>
    </span>
  );

  return (
    <div className={`fixed inset-0 z-40 flex flex-col ${dark ? "exam-dark" : "bg-white text-gray-900"}`}>
      <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5 text-sm ${dark ? "border-gray-700" : "border-gray-200"}`}>
        <span className="font-semibold">{course.title}</span>
        <span className="text-gray-500">· {outline.name} · exam mode</span>
        <input
          ref={searchRef}
          className="input w-56"
          placeholder={`Search (${shortcutLabel("Mod+F")})`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) jumpTo(results[0].node.id);
          }}
        />
        <button type="button" className="btn" onClick={() => setPalette((p) => ({ open: true, session: p.session + 1 }))}>
          Jump {shortcutLabel("Mod+K")}
        </button>
        <select
          className="input w-auto"
          value={split ?? ""}
          onChange={(e) => setSplit(e.target.value || null)}
          aria-label="Split with"
        >
          <option value="">Split with…</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title || "(untitled)"}
            </option>
          ))}
        </select>
        {focusId && (
          <button type="button" className="btn" onClick={() => setFocusId(null)}>
            Show all
          </button>
        )}
        <span className="ml-auto" />
        <button type="button" className="btn" onClick={toggleTheme}>
          {dark ? "Light" : "Dark"}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void document.documentElement.requestFullscreen?.();
          }}
        >
          Full screen
        </button>
        <Link href={`/courses/${course.slug}/outlines/${outline.id}`} className="btn">
          Exit
        </Link>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className={`w-64 shrink-0 overflow-y-auto border-r p-3 text-sm ${dark ? "border-gray-700" : "border-gray-200"}`}>
          {query.trim() ? (
            <>
              <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">
                {results.length} match{results.length === 1 ? "" : "es"}
              </div>
              {results.map((r) => (
                <button key={r.node.id} type="button" className="block w-full truncate rounded px-1 py-0.5 text-left hover:bg-gray-500/10" onClick={() => jumpTo(r.node.id)} style={{ paddingLeft: 4 + r.depth * 8 }}>
                  {numberingLabel(outline.numbering, r.path)} {r.node.title || "(untitled)"}
                </button>
              ))}
            </>
          ) : (
            <>
              <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">Pinned ({pins.length}/{MAX_PINS})</div>
              {pins.length === 0 && <p className="text-xs text-gray-500">Pin up to five sections with the Pin button on a section heading.</p>}
              {pins.map((id) => (
                <div key={id} className="flex items-center gap-1">
                  <button type="button" className="min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left hover:bg-gray-500/10" onClick={() => jumpTo(id)}>
                    {titleOf(id)}
                  </button>
                  <button type="button" className="text-xs text-gray-500 hover:text-gray-300" title="Open in the split" onClick={() => setSplit(id)}>
                    ⇥
                  </button>
                  <button type="button" className="text-xs text-gray-500 hover:text-red-500" title="Unpin" onClick={() => togglePin(id)}>
                    ×
                  </button>
                </div>
              ))}
              <div className="mb-1 mt-4 text-xs uppercase tracking-wide text-gray-500">Sections</div>
              {sections.map((s, i) => (
                <button key={s.id} type="button" className="block w-full truncate rounded px-1 py-0.5 text-left hover:bg-gray-500/10" onClick={() => jumpTo(s.id)}>
                  {numberingLabel(outline.numbering, [i])} {s.title || "(untitled)"}
                </button>
              ))}
            </>
          )}
        </aside>

        <div ref={mainRef} className="min-w-0 flex-1 overflow-y-auto px-8 py-4">
          {nodes.length === 0 ? (
            <p className="text-gray-500">This outline is empty.</p>
          ) : (
            <NodeDocument nodes={nodes} images={bundle.images} sources={bundle.sources} numbering={outline.numbering} rootId={focusId} terms={terms} large sectionTools={sectionTools} />
          )}
        </div>

        {split && map[split] && (
          <div className={`min-w-0 flex-1 overflow-y-auto border-l px-8 py-4 ${dark ? "border-gray-700" : "border-gray-200"}`}>
            <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
              <span>Split: {titleOf(split)}</span>
              <button type="button" className="btn py-0 text-xs" onClick={() => setSplit(null)}>
                Close
              </button>
            </div>
            <NodeDocument nodes={nodes} images={bundle.images} sources={bundle.sources} numbering={outline.numbering} rootId={split} terms={terms} large />
          </div>
        )}
      </div>

      <CommandPalette key={palette.session} open={palette.open} items={paletteItems} onClose={() => setPalette((p) => ({ ...p, open: false }))} />
    </div>
  );
}
