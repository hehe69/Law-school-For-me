"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { OutlineNode } from "@/lib/types";
import { LINK_PURPOSES, SECTION_ROLES, SECTION_STATUSES } from "@/lib/types";
import type { SectionLinkRow } from "@/lib/queries/citations";
import type { ExtractRow } from "@/lib/queries/extracts";
import {
  createSectionAction,
  deleteLinkAction,
  deleteSectionAction,
  linkSourceAction,
  moveSectionAction,
  unlinkExtractAction,
  updateLinkAction,
  updateSectionAction,
  updateSectionFields,
} from "@/app/actions";
import { InlineText } from "./InlineText";
import { AutoSubmitSelect } from "./AutoSubmitSelect";
import { ConfirmButton } from "./ConfirmButton";
import { KindBadge, ROLE_COLORS, RoleBadge, SupportBadge } from "./badges";

export interface SectionDetails {
  links: SectionLinkRow[];
  extracts: ExtractRow[];
}

interface Props {
  slug: string;
  nodes: OutlineNode[];
  details: Record<number, SectionDetails>;
  sources: { id: number; short_cite: string; citation: string }[];
  counters: { id: number; heading: string }[];
  focusId?: number;
}

type DropTarget = { kind: "before" | "into" | "end"; id: number | null; parent: number | null; index: number };

export function OutlineTree({ slug, nodes, details, sources, counters, focusId }: Props) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(focusId ? [focusId] : []));
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();

  const byParent = useMemo(() => {
    const m = new Map<number | null, OutlineNode[]>();
    for (const n of nodes) m.set(n.parent_id, [...(m.get(n.parent_id) ?? []), n]);
    return m;
  }, [nodes]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const headingById = (id: number | null) => (id ? byId.get(id)?.heading : undefined);
  const responsesTo = useMemo(() => {
    const m = new Map<number, OutlineNode[]>();
    for (const n of nodes) if (n.role === "response" && n.responds_to) m.set(n.responds_to, [...(m.get(n.responds_to) ?? []), n]);
    return m;
  }, [nodes]);

  const isDescendant = (candidate: number, ancestor: number) => {
    let cur: number | null = candidate;
    while (cur !== null) {
      if (cur === ancestor) return true;
      cur = byId.get(cur)?.parent_id ?? null;
    }
    return false;
  };

  const move = (id: number, parent: number | null, index: number) => {
    start(async () => {
      await moveSectionAction(id, parent, index);
    });
  };

  // Keyboard-free fallbacks: up/down/indent/outdent.
  const siblingsOf = (n: OutlineNode) => byParent.get(n.parent_id) ?? [];
  const nudge = (n: OutlineNode, dir: -1 | 1) => {
    const sibs = siblingsOf(n);
    const i = sibs.findIndex((s) => s.id === n.id);
    const j = i + dir;
    if (j < 0 || j >= sibs.length) return;
    move(n.id, n.parent_id, j);
  };
  const indent = (n: OutlineNode) => {
    const sibs = siblingsOf(n);
    const i = sibs.findIndex((s) => s.id === n.id);
    if (i <= 0) return;
    const newParent = sibs[i - 1];
    move(n.id, newParent.id, (byParent.get(newParent.id) ?? []).length);
  };
  const outdent = (n: OutlineNode) => {
    if (n.parent_id === null) return;
    const parent = byId.get(n.parent_id);
    if (!parent) return;
    const psibs = byParent.get(parent.parent_id) ?? [];
    const pi = psibs.findIndex((s) => s.id === parent.id);
    move(n.id, parent.parent_id, pi + 1);
  };

  const onDrop = (t: DropTarget) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOver(null);
    const id = dragging ?? parseInt(e.dataTransfer.getData("text/plain"), 10);
    setDragging(null);
    if (!Number.isFinite(id)) return;
    const n = byId.get(id);
    if (!n) return;
    let parent = t.parent;
    let index = t.index;
    if (t.kind === "into") {
      parent = t.id;
      index = (byParent.get(t.id) ?? []).length;
    }
    if (parent !== null && (parent === id || isDescendant(parent, id))) return;
    // The server list excludes the moved node, so shift when moving down within the same parent.
    if (parent === n.parent_id) {
      const cur = siblingsOf(n).findIndex((s) => s.id === id);
      if (cur >= 0 && cur < index) index -= 1;
    }
    if (parent === n.parent_id && index === siblingsOf(n).findIndex((s) => s.id === id)) return;
    move(id, parent, index);
  };
  const dragProps = (key: string, t: DropTarget) => ({
    onDragOver: (e: React.DragEvent) => {
      if (dragging === null) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      if (over !== key) setOver(key);
    },
    onDragLeave: () => {
      if (over === key) setOver(null);
    },
    onDrop: onDrop(t),
  });

  const renderList = (parent: number | null, depth: number) => {
    const list = byParent.get(parent) ?? [];
    return (
      <div className={depth > 0 ? "ml-6 border-l border-gray-200 pl-2" : ""}>
        {list.map((n, i) => (
          <div key={n.id}>
            <DropLine active={over === `before-${n.id}`} {...dragProps(`before-${n.id}`, { kind: "before", id: n.id, parent, index: i })} />
            {renderNode(n, depth)}
          </div>
        ))}
        <DropLine active={over === `end-${parent}`} {...dragProps(`end-${parent}`, { kind: "end", id: null, parent, index: list.length })} tall={list.length === 0} />
      </div>
    );
  };

  const renderNode = (n: OutlineNode, depth: number) => {
    const isOpen = expanded.has(n.id);
    const d = details[n.id] ?? { links: [], extracts: [] };
    const answers = responsesTo.get(n.id) ?? [];
    const intoKey = `into-${n.id}`;
    const roleColor = ROLE_COLORS[n.role] ?? "";
    return (
      <div id={`section-${n.id}`} className={`rounded mb-1 ${focusId === n.id ? "ring-2 ring-yellow-400" : ""}`}>
        <div
          className={`flex items-start gap-2 px-2 py-1 rounded border ${over === intoKey ? "bg-blue-50 border-blue-400" : "border-transparent hover:border-gray-200"} ${
            dragging === n.id ? "opacity-40" : ""
          } ${n.role === "response" ? "border-l-4 border-l-green-400" : n.role === "counterargument" ? "border-l-4 border-l-red-400" : ""}`}
          {...dragProps(intoKey, { kind: "into", id: n.id, parent: n.parent_id, index: 0 })}
        >
          <span
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", String(n.id));
              e.dataTransfer.effectAllowed = "move";
              setDragging(n.id);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            className="cursor-grab select-none text-gray-400 pt-0.5"
            title="Drag to reorder or re-parent (drop on a section to make it a child)"
          >
            ⋮⋮
          </span>
          <button type="button" className="px-1 py-0 text-xs" onClick={() => toggle(n.id)} title={isOpen ? "Collapse" : "Expand"}>
            {isOpen ? "▾" : "▸"}
          </button>
          <span className="text-xs text-gray-500 pt-1 w-10 shrink-0">{n.path}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <InlineText
                value={n.heading}
                onSave={(v) => updateSectionFields(n.id, { heading: v || "Untitled" })}
                className="font-medium"
              />
              <RoleBadge role={n.role} />
              <SupportBadge support={n.support} />
              {n.word_target ? <span className="text-xs text-gray-500">{n.word_target} words</span> : null}
            </div>
            <div className="text-sm text-gray-700">
              <InlineText value={n.claim} onSave={(v) => updateSectionFields(n.id, { claim: v })} placeholder="one-line claim" />
            </div>
            {n.role === "response" && (
              <div className="text-xs text-green-800 mt-0.5 flex items-center gap-1 flex-wrap">
                <span className="whitespace-nowrap">↳ responds to</span>
                <form action={updateSectionAction} className="inline" key={String(n.responds_to)}>
                  <input type="hidden" name="id" value={n.id} />
                  <AutoSubmitSelect name="responds_to" defaultValue={n.responds_to ?? ""} className="text-xs py-0">
                    <option value="">(pick a counterargument)</option>
                    {counters
                      .filter((c) => c.id !== n.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.heading}
                        </option>
                      ))}
                  </AutoSubmitSelect>
                </form>
                {n.responds_to && (
                  <a href={`#section-${n.responds_to}`} className="text-xs whitespace-nowrap" title={headingById(n.responds_to)}>
                    jump ↑
                  </a>
                )}
              </div>
            )}
            {n.role === "counterargument" && answers.length > 0 && (
              <div className="text-xs text-red-800 mt-0.5">
                answered by:{" "}
                {answers.map((a, i) => (
                  <span key={a.id}>
                    {i > 0 && ", "}
                    <a href={`#section-${a.id}`}>{a.heading}</a>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <form action={updateSectionAction} key={n.status}>
              <input type="hidden" name="id" value={n.id} />
              <AutoSubmitSelect name="status" defaultValue={n.status} className="text-xs py-0" title="Status">
                {SECTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </AutoSubmitSelect>
            </form>
            <form action={updateSectionAction} key={n.role}>
              <input type="hidden" name="id" value={n.id} />
              <AutoSubmitSelect name="role" defaultValue={n.role} className={`text-xs py-0 ${roleColor}`} title="Role">
                {SECTION_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </AutoSubmitSelect>
            </form>
            <span className="flex gap-0.5">
              <button type="button" className="px-1 py-0 text-xs" title="Move up" onClick={() => nudge(n, -1)}>
                ↑
              </button>
              <button type="button" className="px-1 py-0 text-xs" title="Move down" onClick={() => nudge(n, 1)}>
                ↓
              </button>
              <button type="button" className="px-1 py-0 text-xs" title="Outdent" onClick={() => outdent(n)} disabled={n.parent_id === null}>
                ←
              </button>
              <button type="button" className="px-1 py-0 text-xs" title="Indent (make child of previous sibling)" onClick={() => indent(n)}>
                →
              </button>
            </span>
            <form action={deleteSectionAction}>
              <input type="hidden" name="id" value={n.id} />
              <ConfirmButton
                message={`Delete "${n.heading}"? Its child sections move up to its parent. Its source links and extract links are removed (citation log rows are kept).`}
                className="px-1 py-0 text-xs text-gray-500"
              >
                ×
              </ConfirmButton>
            </form>
          </div>
        </div>

        {isOpen && (
          <div className="ml-16 mr-2 mb-2 text-sm space-y-3 border border-gray-200 rounded p-2 bg-gray-50">
            <div className="grid md:grid-cols-3 gap-2 text-xs">
              <form action={updateSectionAction} className="flex items-center gap-1" key={String(n.word_target)}>
                <input type="hidden" name="id" value={n.id} />
                <label>Word target</label>
                <input name="word_target" type="number" min="0" defaultValue={n.word_target ?? ""} className="w-24 text-xs" />
                <button type="submit" className="text-xs">
                  Save
                </button>
              </form>
            </div>

            <div>
              <h4 className="font-medium text-xs uppercase text-gray-500 mb-1">Linked sources ({d.links.length})</h4>
              {d.links.length === 0 && <p className="text-xs text-gray-500">No sources linked yet.</p>}
              <ul className="space-y-1">
                {d.links.map((l) => (
                  <li key={l.id} className="flex gap-2 items-start">
                    <Link href={`/papers/${slug}/sources/${l.source_id}`} className="shrink-0">
                      {l.short_cite}
                    </Link>
                    <form action={updateLinkAction} className="flex gap-1 flex-1 items-center" key={`${l.purpose}|${l.note}`}>
                      <input type="hidden" name="id" value={l.id} />
                      <select name="purpose" defaultValue={l.purpose} className="text-xs py-0">
                        {LINK_PURPOSES.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <input name="note" defaultValue={l.note} className="flex-1 text-xs" title="What this source proves for this section" required />
                      <button type="submit" className="text-xs">
                        Save
                      </button>
                    </form>
                    <form action={deleteLinkAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <ConfirmButton message="Remove this source link? (Its citation log row stays.)" className="text-xs px-1 py-0 text-gray-500">
                        unlink
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
              <form action={linkSourceAction} className="flex gap-1 mt-1 items-center flex-wrap">
                <input type="hidden" name="section_id" value={n.id} />
                <select name="source_id" required className="text-xs">
                  <option value="">Link a source…</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.short_cite}
                    </option>
                  ))}
                </select>
                <select name="purpose" className="text-xs">
                  {LINK_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input name="note" placeholder="What this source proves for this section (required)" required className="flex-1 min-w-48 text-xs" />
                <button type="submit" className="text-xs">
                  Link
                </button>
              </form>
            </div>

            <div>
              <h4 className="font-medium text-xs uppercase text-gray-500 mb-1">Extracts ({d.extracts.length})</h4>
              {d.extracts.length === 0 && (
                <p className="text-xs text-gray-500">
                  No extracts linked. Use the <Link href={`/papers/${slug}/quotes?mode=linker`}>linker</Link>.
                </p>
              )}
              <ul className="space-y-1">
                {d.extracts.map((e) => (
                  <li key={e.id} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Link href={`/papers/${slug}/quotes?extract=${e.id}`}>
                        {e.short_cite}, {e.pin_cite}
                      </Link>{" "}
                      <KindBadge kind={e.kind} />
                      <div className="text-gray-700 italic">“{e.text}”</div>
                      {e.note && <div className="text-xs text-gray-600">{e.note}</div>}
                    </div>
                    <form action={unlinkExtractAction}>
                      <input type="hidden" name="extract_id" value={e.id} />
                      <input type="hidden" name="section_id" value={n.id} />
                      <ConfirmButton message="Unlink this extract from the section? (Its citation log row stays.)" className="text-xs px-1 py-0 text-gray-500">
                        unlink
                      </ConfirmButton>
                    </form>
                  </li>
                ))}
              </ul>
            </div>

            <form action={createSectionAction} className="flex gap-1 items-center flex-wrap">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="parent_id" value={n.id} />
              <input name="heading" placeholder="New child section heading" required className="text-xs" />
              <input name="claim" placeholder="one-line claim" className="text-xs flex-1 min-w-40" />
              <select name="role" className="text-xs">
                {SECTION_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button type="submit" className="text-xs">
                Add child
              </button>
            </form>
          </div>
        )}
        {renderList(n.id, depth + 1)}
      </div>
    );
  };

  const toggle = (id: number) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div>
      <div className="flex gap-2 text-xs mb-2">
        <button type="button" onClick={() => setExpanded(new Set(nodes.map((n) => n.id)))}>
          Expand all
        </button>
        <button type="button" onClick={() => setExpanded(new Set())}>
          Collapse all
        </button>
      </div>
      {nodes.length === 0 && <p className="text-gray-500 text-sm mb-2">No sections yet. Add the first one below.</p>}
      {renderList(null, 0)}
    </div>
  );
}

function DropLine({ active, tall, ...rest }: { active: boolean; tall?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={`${tall ? "h-4" : "h-2"} -my-0.5 rounded transition-colors ${active ? "bg-blue-400" : "bg-transparent"}`}
    />
  );
}
