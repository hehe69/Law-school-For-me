"use client";

// Daily flashcard review: front, reveal, rate (Again / Hard / Good / Easy), next.

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { RATING_LABELS, type Rating } from "@/lib/sm2";
import { Markdown } from "@/components/Markdown";

export type ReviewItem = { nodeId: string; front: string; back: string[]; courseTitle: string; courseSlug: string; outlineId: string; outlineName: string; isNew: boolean };

export function ReviewSession({ items }: { items: ReviewItem[] }) {
  const [queue, setQueue] = useState(items);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const current = queue[0];

  const rate = async (rating: Rating) => {
    try {
      await api.post(`/api/cards/${current.nodeId}/review`, { rating });
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setRevealed(false);
    setDone((d) => d + 1);
    // "Again" puts the card at the back of today's queue so it comes round once more.
    setQueue((q) => (rating === 1 ? [...q.slice(1), { ...current, isNew: false }] : q.slice(1)));
  };

  if (!current) {
    return (
      <div className="card text-sm text-gray-600">
        {done > 0 ? `Done: ${done} card${done === 1 ? "" : "s"} reviewed.` : "Nothing due today."} Come back tomorrow, or turn flashcards on for more rule and element nodes in the editor panel.
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {queue.length} left · {current.courseTitle} · {current.outlineName}
          {current.isNew ? " · new" : ""}
        </span>
        <Link href={`/courses/${current.courseSlug}/outlines/${current.outlineId}?node=${current.nodeId}`} className="hover:text-gray-900">
          Open node
        </Link>
      </div>
      <div className="mt-3 text-lg font-medium">{current.front}</div>
      {revealed ? (
        <>
          <div className="mt-3 space-y-1 border-t border-gray-200 pt-3 text-sm">
            {current.back.length === 0 && <p className="text-gray-400">Nothing written on the back yet.</p>}
            {current.back.map((line, i) => (
              <Markdown key={i} text={line} />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {([1, 2, 3, 4] as Rating[]).map((r) => (
              <button key={r} type="button" className={r === 1 ? "btn-danger" : r === 3 ? "btn-primary" : "btn"} onClick={() => void rate(r)}>
                {RATING_LABELS[r]}
              </button>
            ))}
          </div>
        </>
      ) : (
        <button type="button" className="btn-primary mt-4" onClick={() => setRevealed(true)}>
          Show the answer
        </button>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
