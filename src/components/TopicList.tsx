"use client";

// Editable list of syllabus topics: type one, press Add (or Enter), remove with ×.
// Each topic is submitted as a separate "syllabusTopics" form value.

import { useState } from "react";

export default function TopicList({ initial }: { initial: string[] }) {
  const [topics, setTopics] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!topics.some((t) => t.toLowerCase() === v.toLowerCase())) setTopics([...topics, v]);
    setDraft("");
  }

  return (
    <div>
      <ul className="mb-2 space-y-1">
        {topics.length === 0 && <li className="text-sm text-gray-500">No topics yet.</li>}
        {topics.map((t) => (
          <li key={t} className="flex items-center gap-2">
            <input type="hidden" name="syllabusTopics" value={t} />
            <span className="rounded bg-gray-100 px-2 py-0.5">{t}</span>
            <button type="button" onClick={() => setTopics(topics.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="text-sm text-gray-500 hover:text-red-700">
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Add a topic"
          className="rounded border border-gray-300 px-2 py-1"
        />
        <button type="button" onClick={add} className="rounded border border-gray-300 px-3 py-1">Add</button>
      </div>
    </div>
  );
}
