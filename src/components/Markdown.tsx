"use client";

import ReactMarkdown from "react-markdown";

/** Renders a markdown string. Images under /files/ (the uploads folder) work as plain relative URLs. */
export function Markdown({ text, className }: { text: string; className?: string }) {
  if (!text.trim()) return null;
  return (
    <div className={`prose-outline text-sm ${className ?? ""}`}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </div>
  );
}
