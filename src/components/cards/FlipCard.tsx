"use client";

// A flashcard that reveals its back on click. Used for browsing a unit's cards.

import { useState } from "react";
import type { Card } from "@/lib/cards";
import CardBack from "./CardBack";

export default function FlipCard({ card }: { card: Card }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="mb-3 rounded border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="font-medium">{card.front}</span>
        <span className="text-xs text-gray-500">{card.noteType} · {open ? "hide" : "show"}</span>
      </button>
      {open && (
        <div className="border-t border-gray-200 px-4 py-3">
          <CardBack sections={card.back} />
        </div>
      )}
    </article>
  );
}
