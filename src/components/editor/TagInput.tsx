"use client";

// Tags as chips. Suggestions come from the course's syllabus topics; anything typed is allowed too.

import { useState, type KeyboardEvent } from "react";

type Props = {
  value: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
  onEscape: () => void;
};

export function TagInput({ value, suggestions, onChange, onEscape }: Props) {
  const [text, setText] = useState("");
  const add = (tag: string) => {
    const t = tag.trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...value, t]);
    setText("");
  };
  const remove = (tag: string) => onChange(value.filter((v) => v !== tag));
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (text) setText("");
      else onEscape();
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && text === "" && value.length) {
      e.preventDefault();
      remove(value[value.length - 1]);
    }
  };
  const open = suggestions.filter((s) => !value.includes(s) && (!text || s.toLowerCase().includes(text.toLowerCase())));
  return (
    <div>
      <div className="input flex min-h-[2rem] flex-wrap items-center gap-1 py-0.5">
        {value.map((tag) => (
          <span key={tag} className="flex items-center gap-1 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-800">
            {tag}
            <button type="button" className="text-gray-500 hover:text-red-600" title="Remove tag" onClick={() => remove(tag)}>
              ×
            </button>
          </span>
        ))}
        <input
          className="min-w-[6rem] flex-1 bg-transparent py-0.5 text-sm outline-none"
          placeholder={value.length ? "" : "Add a tag…"}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => add(text)}
        />
      </div>
      {open.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {open.slice(0, 12).map((s) => (
            <button key={s} type="button" className="rounded border border-dashed border-gray-300 px-1.5 py-0.5 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-800" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
