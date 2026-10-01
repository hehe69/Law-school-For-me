"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { EXTRACT_KINDS } from "@/lib/types";
import { createExtractAction, createTopLevelSection } from "@/app/actions";

interface SectionOpt {
  id: number;
  heading: string;
  claim: string;
  path: string;
}

// Extract capture. After save the form clears but keeps the source and the last pin cite,
// and focus returns to the text field, so pulling several quotes in a row is fast.
export function ExtractForm({ slug, sourceId, sections: initialSections }: { slug: string; sourceId: number; sections: SectionOpt[] }) {
  // Sections created from this form before the server list catches up.
  const [localSections, setLocalSections] = useState<SectionOpt[]>([]);
  const sections = useMemo(() => {
    const known = new Set(initialSections.map((s) => s.id));
    return [...initialSections, ...localSections.filter((s) => !known.has(s.id))];
  }, [initialSections, localSections]);
  const [pinCite, setPinCite] = useState("");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<string>("support");
  const [tags, setTags] = useState("");
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [newSection, setNewSection] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const textRef = useRef<HTMLTextAreaElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCite.trim()) {
      setMessage("Pin cite is required.");
      return;
    }
    const fd = new FormData();
    fd.set("slug", slug);
    fd.set("source_id", String(sourceId));
    fd.set("pin_cite", pinCite);
    fd.set("text", text);
    fd.set("note", note);
    fd.set("kind", kind);
    fd.set("tags", tags);
    for (const id of ticked) fd.append("section_ids", String(id));
    start(async () => {
      const res = await createExtractAction(fd);
      if (!res.ok) {
        setMessage(res.error ?? "Could not save.");
        return;
      }
      setMessage(`Saved extract (${pinCite})${ticked.size ? ` and linked to ${ticked.size} section${ticked.size > 1 ? "s" : ""}` : ""}.`);
      setText("");
      setNote("");
      setTags("");
      setTicked(new Set());
      textRef.current?.focus();
    });
  };

  const addSection = () => {
    const h = newSection.trim();
    if (!h) return;
    start(async () => {
      const sec = await createTopLevelSection(slug, h);
      if (!sec) return;
      const topLevel = sections.filter((x) => !x.path.includes(".")).length;
      setLocalSections((s) => [...s, { ...sec, path: String(topLevel + 1) }]);
      setTicked((t) => new Set(t).add(sec.id));
      setNewSection("");
    });
  };

  const toggle = (id: number) =>
    setTicked((t) => {
      const n = new Set(t);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form onSubmit={submit} className="grid gap-2 text-sm">
      <label>
        Pin cite <span className="text-red-700">*</span>
        <input value={pinCite} onChange={(e) => setPinCite(e.target.value)} placeholder="e.g. at 553, § 2(b), p. 14" required className="w-full" />
      </label>
      <label>
        Verbatim text
        <textarea ref={textRef} value={text} onChange={(e) => setText(e.target.value)} rows={5} className="w-full font-serif" />
      </label>
      <label>
        Note (why it matters)
        <input value={note} onChange={(e) => setNote(e.target.value)} className="w-full" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label>
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="w-full">
            {EXTRACT_KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tags (comma-separated)
          <input value={tags} onChange={(e) => setTags(e.target.value)} className="w-full" />
        </label>
      </div>
      <fieldset className="border border-gray-300 rounded p-2">
        <legend className="text-xs text-gray-600 px-1">Link to outline sections</legend>
        <div className="max-h-56 overflow-auto space-y-0.5">
          {sections.length === 0 && <p className="text-xs text-gray-500">No sections yet.</p>}
          {sections.map((s) => (
            <label key={s.id} className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={ticked.has(s.id)} onChange={() => toggle(s.id)} className="mt-1" />
              <span>
                <span className="text-xs text-gray-500 mr-1">{s.path}</span>
                <span className="font-medium">{s.heading}</span>
                {s.claim && <span className="text-gray-600"> — {s.claim}</span>}
              </span>
            </label>
          ))}
        </div>
        <div className="flex gap-1 mt-2">
          <input
            value={newSection}
            onChange={(e) => setNewSection(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSection();
              }
            }}
            placeholder="New top-level section…"
            className="flex-1 text-xs"
          />
          <button type="button" onClick={addSection} className="text-xs" disabled={pending}>
            Add &amp; tick
          </button>
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Saving…" : "Save extract"}
        </button>
        {message && <span className="text-xs text-gray-600">{message}</span>}
      </div>
    </form>
  );
}
