"use client";

// Side panel sections that live outside the tree sync: cross-links with backlinks, sources, and images.

import { useRef, useState } from "react";
import type { ImageRow, Link, LinkKind, OutlineNode, Source, SourceKind } from "@/lib/types";
import { LINK_KINDS, SOURCE_KINDS } from "@/lib/types";

export type AttachmentActions = {
  addLink: (from: string, to: string, kind: LinkKind, note: string) => Promise<void>;
  updateLink: (id: string, patch: { kind?: LinkKind; note?: string }) => Promise<void>;
  removeLink: (id: string) => Promise<void>;
  addSource: (nodeId: string, kind: SourceKind, reference: string, url: string | null) => Promise<void>;
  updateSource: (id: string, patch: { kind?: SourceKind; reference?: string; url?: string | null }) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  uploadImages: (nodeId: string, files: File[]) => Promise<void>;
  updateImage: (id: string, patch: { caption?: string; widthHint?: number | null }) => Promise<void>;
  removeImage: (id: string) => Promise<void>;
  jumpTo: (id: string) => void;
  openLinkPicker: (fromId: string) => void;
  /** Re-read the study-app note this node was imported from */
  refreshFromNote: (id: string) => Promise<void>;
};

export function LinkedNoteSection({ node, actions, onUnlink }: { node: OutlineNode; actions: AttachmentActions; onUnlink: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!node.linkedNotePath) return null;
  return (
    <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 text-xs">
      <div className="flex items-center gap-1 text-blue-900">
        <span>⛓</span>
        <span className="min-w-0 flex-1 truncate font-mono" title={node.linkedNotePath}>
          {node.linkedNotePath}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          className="btn py-0 text-xs"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setMessage(null);
            actions
              .refreshFromNote(node.id)
              .then(() => setMessage("Refreshed from the note."))
              .catch((e: Error) => setMessage(e.message))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Refreshing…" : "Refresh from note"}
        </button>
        <button type="button" className="text-gray-500 hover:text-gray-900" onClick={onUnlink} title="Keep the node, forget the note">
          Unlink
        </button>
        {message && <span className="text-gray-600">{message}</span>}
      </div>
    </div>
  );
}

const titleOf = (nodes: Record<string, OutlineNode>, id: string) => nodes[id]?.title || (nodes[id] ? "(untitled)" : "(in another outline)");

export function LinksSection({ node, links, nodes, actions }: { node: OutlineNode; links: Link[]; nodes: Record<string, OutlineNode>; actions: AttachmentActions }) {
  const outgoing = links.filter((l) => l.fromNode === node.id);
  const incoming = links.filter((l) => l.toNode === node.id);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <span className="label mb-0">Links</span>
        <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => actions.openLinkPicker(node.id)}>
          + Add link
        </button>
      </div>
      {outgoing.length === 0 && incoming.length === 0 && <p className="mt-1 text-xs text-gray-400">No links yet. A link shows as a chip on both nodes.</p>}
      {outgoing.map((l) => (
        <div key={l.id} className="mt-1 rounded border border-gray-200 bg-white p-1.5 text-xs">
          <div className="flex items-center gap-1">
            <select className="input w-auto py-0 text-xs" value={l.kind} onChange={(e) => void actions.updateLink(l.id, { kind: e.target.value as LinkKind })}>
              {LINK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button type="button" className="min-w-0 flex-1 truncate rounded bg-blue-50 px-1.5 py-0.5 text-left text-blue-800 hover:bg-blue-100" title="Jump to this node" onClick={() => actions.jumpTo(l.toNode)}>
              → {titleOf(nodes, l.toNode)}
            </button>
            <button type="button" className="px-1 text-gray-400 hover:text-red-600" title="Remove link" onClick={() => void actions.removeLink(l.id)}>
              ×
            </button>
          </div>
          <input className="input mt-1 py-0 text-xs" placeholder="Note (optional)" defaultValue={l.note} onBlur={(e) => e.target.value !== l.note && void actions.updateLink(l.id, { note: e.target.value })} />
        </div>
      ))}
      {incoming.length > 0 && (
        <div className="mt-2">
          <span className="text-[11px] uppercase tracking-wide text-gray-400">Backlinks</span>
          {incoming.map((l) => (
            <div key={l.id} className="mt-1 flex items-center gap-1 text-xs">
              <button type="button" className="min-w-0 flex-1 truncate rounded bg-gray-100 px-1.5 py-0.5 text-left text-gray-800 hover:bg-gray-200" title="Jump to this node" onClick={() => actions.jumpTo(l.fromNode)}>
                ← {titleOf(nodes, l.fromNode)} <span className="text-gray-500">({l.kind})</span>
              </button>
              <button type="button" className="px-1 text-gray-400 hover:text-red-600" title="Remove link" onClick={() => void actions.removeLink(l.id)}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SourcesSection({ node, sources, actions }: { node: OutlineNode; sources: Source[]; actions: AttachmentActions }) {
  const mine = sources.filter((s) => s.nodeId === node.id);
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <span className="label mb-0">Sources</span>
        <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => void actions.addSource(node.id, "casebook", "", null)}>
          + Add source
        </button>
      </div>
      {mine.length === 0 && <p className="mt-1 text-xs text-gray-400">Where this came from: a transcript time, a casebook page, a cite. Printed under the node.</p>}
      {mine.map((s) => (
        <div key={s.id} className="mt-1 rounded border border-gray-200 bg-white p-1.5 text-xs">
          <div className="flex items-center gap-1">
            <select className="input w-auto py-0 text-xs" value={s.kind} onChange={(e) => void actions.updateSource(s.id, { kind: e.target.value as SourceKind })}>
              {SOURCE_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              className="input py-0 text-xs"
              placeholder="Date, page, cite…"
              defaultValue={s.reference}
              autoFocus={s.reference === ""}
              onBlur={(e) => e.target.value !== s.reference && void actions.updateSource(s.id, { reference: e.target.value })}
            />
            <button type="button" className="px-1 text-gray-400 hover:text-red-600" title="Remove source" onClick={() => void actions.removeSource(s.id)}>
              ×
            </button>
          </div>
          <input className="input mt-1 py-0 text-xs" placeholder="URL (optional)" defaultValue={s.url ?? ""} onBlur={(e) => (e.target.value || null) !== s.url && void actions.updateSource(s.id, { url: e.target.value || null })} />
        </div>
      ))}
    </div>
  );
}

export function ImagesSection({ node, images, actions }: { node: OutlineNode; images: ImageRow[]; actions: AttachmentActions }) {
  const mine = images.filter((i) => i.nodeId === node.id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setBusy(true);
    try {
      await actions.uploadImages(node.id, imgs);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <span className="label mb-0">Images</span>
        <button type="button" className="text-xs text-blue-700 hover:underline" onClick={() => fileRef.current?.click()}>
          + Add image
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void upload(Array.from(e.target.files ?? [])).then(() => (e.target.value = ""))} />
      </div>
      {mine.map((img) => (
        <figure key={img.id} className="mt-2 rounded border border-gray-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/files/${img.filePath}`} alt={img.caption} style={{ width: img.widthHint ? Math.min(img.widthHint, 360) : undefined, maxWidth: "100%" }} className="rounded" />
          <input className="input mt-1 py-0 text-xs" placeholder="Caption" defaultValue={img.caption} onBlur={(e) => e.target.value !== img.caption && void actions.updateImage(img.id, { caption: e.target.value })} />
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
            <span>Width</span>
            <input type="range" min={80} max={1200} step={10} value={img.widthHint ?? 600} onChange={(e) => void actions.updateImage(img.id, { widthHint: Number(e.target.value) })} className="flex-1" />
            <span className="w-14 text-right">{img.widthHint ? `${img.widthHint}px` : "auto"}</span>
            <button type="button" className="text-gray-400 hover:text-gray-700" title="Natural width" onClick={() => void actions.updateImage(img.id, { widthHint: null })}>
              reset
            </button>
            <button type="button" className="text-gray-400 hover:text-red-600" title="Remove image" onClick={() => void actions.removeImage(img.id)}>
              ×
            </button>
          </div>
        </figure>
      ))}
      <div
        className={`mt-2 rounded border border-dashed p-3 text-center text-xs ${over ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-300 text-gray-400"}`}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(Array.from(e.dataTransfer.files));
        }}
        onPaste={(e) => {
          const files = Array.from(e.clipboardData.files);
          if (files.length) {
            e.preventDefault();
            void upload(files);
          }
        }}
        tabIndex={0}
      >
        {busy ? "Uploading…" : "Drop an image here, or paste one anywhere while this node is selected"}
      </div>
    </div>
  );
}
