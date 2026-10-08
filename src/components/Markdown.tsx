"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import type { Term } from "@/lib/glossary";
import { markTerms } from "@/lib/glossary";

type Props = {
  text: string;
  className?: string;
  /** Glossary terms to underline with a hover tooltip */
  terms?: Term[];
  /** The node being rendered, so a definition does not mark itself */
  skipNodeId?: string;
};

function makeComponents(terms: Term[]): Components {
  return {
    a: ({ href, children }) => {
      if (href && href.startsWith("#term:")) {
        const term = terms[Number(href.slice(6))];
        return (
          <span className="term" title={term ? term.definition : undefined} data-term={term?.term}>
            {children}
          </span>
        );
      }
      return (
        <a href={href} target={href && /^https?:/.test(href) ? "_blank" : undefined} rel="noreferrer">
          {children}
        </a>
      );
    },
  };
}

/** Renders a markdown string. Images under /files/ (the uploads folder) work as plain relative URLs. */
export function Markdown({ text, className, terms, skipNodeId }: Props) {
  if (!text.trim()) return null;
  const marked = terms && terms.length ? markTerms(text, terms, skipNodeId) : text;
  return (
    <div className={`prose-outline text-sm ${className ?? ""}`}>
      <ReactMarkdown components={terms && terms.length ? makeComponents(terms) : undefined}>{marked}</ReactMarkdown>
    </div>
  );
}
