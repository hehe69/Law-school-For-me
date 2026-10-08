"use client";

// Hypo drill: facts and question, write an answer, reveal the model answer, mark right or wrong.

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { Markdown } from "@/components/Markdown";

export type HypoCard = { id: string; title: string; facts: string; question: string; answer: string; turnsOn: string };

type Result = { id: string; title: string; correct: boolean; written: string };

export function HypoDrill({ hypos, courseSlug, outlineId, branchTitle }: { hypos: HypoCard[]; courseSlug: string; outlineId: string; branchTitle: string }) {
  const [index, setIndex] = useState(0);
  const [written, setWritten] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const base = `/courses/${courseSlug}/outlines/${outlineId}`;
  const current = hypos[index];

  const mark = async (correct: boolean) => {
    try {
      await api.post("/api/drills", { nodeId: current.id, mode: "hypo", correct });
    } catch (e) {
      setError((e as Error).message);
    }
    setResults((r) => [...r, { id: current.id, title: current.title, correct, written }]);
    setWritten("");
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  if (hypos.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-gray-600">
        No hypos in this branch.{" "}
        <Link href={`${base}/drill`} className="text-blue-700 hover:underline">
          Pick another branch
        </Link>
        .
      </div>
    );
  }

  if (!current) {
    const right = results.filter((r) => r.correct).length;
    return (
      <div className="mx-auto w-full max-w-3xl px-6 py-8">
        <h1 className="text-xl font-semibold">Hypo drill done · {branchTitle}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {right} of {results.length} right. Results are stored and colour the tree.
        </p>
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className={`rounded px-1.5 py-0.5 text-xs ${r.correct ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{r.correct ? "right" : "wrong"}</span>
              <Link href={`${base}?node=${r.id}`} className="hover:underline">
                {r.title || "(untitled)"}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-2">
          <Link href={`${base}/drill`} className="btn">
            Another branch
          </Link>
          <button type="button" className="btn-primary" onClick={() => { setIndex(0); setResults([]); }}>
            Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-baseline justify-between text-sm text-gray-500">
        <span>
          Hypo {index + 1} of {hypos.length} · {branchTitle}
        </span>
        <Link href={`${base}/drill`} className="hover:text-gray-900">
          Stop
        </Link>
      </div>
      <h1 className="mt-2 text-xl font-semibold">{current.title || "(untitled hypo)"}</h1>
      <div className="card mt-4 text-sm">
        <div className="label">Facts</div>
        <Markdown text={current.facts || "_No facts written._"} />
        <div className="label mt-3">Question</div>
        <Markdown text={current.question || "_No question written._"} />
      </div>
      <label className="label mt-4" htmlFor="written">
        Your answer
      </label>
      <textarea id="written" className="input min-h-[8rem] font-[inherit]" value={written} onChange={(e) => setWritten(e.target.value)} disabled={revealed} placeholder="Issue, rule, application, conclusion…" />
      {!revealed ? (
        <button type="button" className="btn-primary mt-3" onClick={() => setRevealed(true)}>
          Reveal the model answer
        </button>
      ) : (
        <>
          <div className="card mt-4 border-green-200 bg-green-50 text-sm">
            <div className="label">Model answer</div>
            <Markdown text={current.answer || "_No answer written for this hypo yet._"} />
            {current.turnsOn && (
              <>
                <div className="label mt-3">What it turns on</div>
                <Markdown text={current.turnsOn} />
              </>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-danger" onClick={() => void mark(false)}>
              Wrong
            </button>
            <button type="button" className="btn-primary" onClick={() => void mark(true)}>
              Right
            </button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
