"use client";

// One card in the review queue: show the front, reveal the back, then rate.
// Rating posts a plain form to a server action; only the reveal is client state.

import { useState } from "react";
import type { Card } from "@/lib/cards";
import { RATING_LABELS, type Rating } from "@/lib/sm2";
import CardBack from "./CardBack";

type Props = {
  card: Card;
  courseFilter: string;
  action: (formData: FormData) => Promise<void>;
};

const RATINGS: Rating[] = [1, 2, 3, 4];
const HINTS: Record<Rating, string> = { 1: "forgot", 2: "barely", 3: "with effort", 4: "instantly" };

export default function ReviewCard({ card, courseFilter, action }: Props) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="rounded border border-gray-300">
      <div className="border-b border-gray-200 px-4 py-2 text-xs text-gray-500">
        {card.courseTitle} · {card.unitTitle} · {card.noteType}
      </div>
      <div className="px-4 py-6">
        <p className="text-xl font-semibold">{card.front}</p>
      </div>
      {revealed ? (
        <>
          <div className="border-t border-gray-200 px-4 py-4">
            <CardBack sections={card.back} />
          </div>
          <form action={action} className="flex flex-wrap gap-2 border-t border-gray-200 px-4 py-3">
            <input type="hidden" name="cardKey" value={card.key} />
            <input type="hidden" name="course" value={courseFilter} />
            {RATINGS.map((r) => (
              <button
                key={r}
                type="submit"
                name="rating"
                value={r}
                className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <span className="font-semibold">{r}</span> {RATING_LABELS[r]}
                <span className="block text-xs text-gray-500">{HINTS[r]}</span>
              </button>
            ))}
          </form>
        </>
      ) : (
        <div className="border-t border-gray-200 px-4 py-3">
          <button type="button" onClick={() => setRevealed(true)} className="rounded bg-blue-700 px-4 py-2 text-white">
            Reveal
          </button>
        </div>
      )}
    </div>
  );
}
