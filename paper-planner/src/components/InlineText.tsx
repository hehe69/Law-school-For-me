"use client";

import { useEffect, useRef, useState, useTransition } from "react";

// Click-to-edit text. Saves on Enter or blur, cancels on Escape.
export function InlineText({
  value,
  onSave,
  className = "",
  placeholder = "(empty)",
  multiline = false,
}: {
  value: string;
  onSave: (v: string) => Promise<unknown> | void;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() === value) return;
    start(async () => {
      await onSave(draft.trim());
    });
  };

  if (!editing) {
    return (
      <span
        className={`cursor-text hover:bg-yellow-50 rounded px-0.5 ${className} ${pending ? "opacity-50" : ""} ${!value ? "text-gray-400 italic" : ""}`}
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        title="Click to edit"
      >
        {value || placeholder}
      </span>
    );
  }
  const common = {
    ref,
    value: draft,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !(multiline && e.shiftKey)) {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        setDraft(value);
        setEditing(false);
      }
    },
    className: `w-full ${className}`,
  };
  return multiline ? <textarea {...common} rows={2} /> : <input {...common} />;
}
