"use client";

// Recite drill: the rule statement and the elements are hidden; say them out loud, reveal them one at a time,
// mark right or wrong. A timer runs per rule.

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Markdown } from "@/components/Markdown";

export type ReciteCard = { id: string; title: string; statement: string; elements: string[]; variation: string };

type Result = { id: string; title: string; correct: boolean; seconds: number };

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ReciteDrill({ rules, courseSlug, outlineId, branchTitle }: { rules: ReciteCard[]; courseSlug: string; outlineId: string; branchTitle: string }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0); // 0 = nothing, 1 = statement, 2+ = elements revealed
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState<string | null>(null);
  const base = `/courses/${courseSlug}/outlines/${outlineId}`;
  const current = rules[index];

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  const seconds = Math.floor((now - startedAt) / 1000);
  const totalSteps = current ? 1 + current.elements.length : 0;

  const mark = async (correct: boolean) => {
    const taken = Math.floor((Date.now() - startedAt) / 1000);
    try {
      await api.post("/api/drills", { nodeId: current.id, mode: "recite", correct });
    } catch (e) {
      setError((e as Error).message);
    }
    setResults((r) => [...r, { id: current.id, title: current.title, correct, seconds: taken }]);
    setShown(0);
    setStartedAt(Date.now());
    setIndex((i) => i + 1);
  };

  if (rules.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8 text-sm text-gray-600">
        No rule nodes in this branch.{" "}
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
        <h1 className="text-xl font-semibold">Recite drill done · {branchTitle}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {right} of {results.length} right, {fmt(results.reduce((s, r) => s + r.seconds, 0))} in total. Results are stored and colour the tree.
        </p>
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2">
              <span className={`rounded px-1.5 py-0.5 text-xs ${r.correct ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{r.correct ? "right" : "wrong"}</span>
              <Link href={`${base}?node=${r.id}`} className="hover:underline">
                {r.title || "(untitled)"}
              </Link>
              <span className="ml-auto font-mono text-xs text-gray-500">{fmt(r.seconds)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-2">
          <Link href={`${base}/drill`} className="btn">
            Another branch
          </Link>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setIndex(0);
              setResults([]);
              setStartedAt(Date.now());
            }}
          >
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
          Rule {index + 1} of {rules.length} · {branchTitle}
        </span>
        <span className="font-mono text-base text-gray-700" aria-label="Timer">
          {fmt(seconds)}
        </span>
        <Link href={`${base}/drill`} className="hover:text-gray-900">
          Stop
        </Link>
      </div>
      <h1 className="mt-2 text-xl font-semibold">{current.title || "(untitled rule)"}</h1>
      <p className="mt-1 text-sm text-gray-600">Say the rule statement and the elements out loud, then reveal them to check.</p>

      <div className="card mt-4 text-sm">
        <div className="label">Rule statement</div>
        {shown >= 1 ? <Markdown text={current.statement || "_No statement written._"} /> : <div className="h-6 rounded bg-gray-100" aria-label="hidden" />}
        <div className="label mt-3">Elements ({current.elements.length})</div>
        <ol className="list-decimal pl-5">
          {current.elements.map((el, i) => (
            <li key={i} className={shown >= i + 2 ? "" : "text-transparent"}>
              {shown >= i + 2 ? el : <span className="inline-block h-4 w-48 rounded bg-gray-100 align-middle" aria-label="hidden" />}
            </li>
          ))}
          {current.elements.length === 0 && <li className="list-none text-gray-400">No elements on this rule.</li>}
        </ol>
        {current.variation && shown >= totalSteps && (
          <>
            <div className="label mt-3">Wisconsin / local variation</div>
            <Markdown text={current.variation} />
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {shown < totalSteps ? (
          <>
            <button type="button" className="btn-primary" onClick={() => setShown((s) => s + 1)}>
              {shown === 0 ? "Reveal the statement" : `Reveal element ${shown}`}
            </button>
            <button type="button" className="btn" onClick={() => setShown(totalSteps)}>
              Reveal all
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-danger" onClick={() => void mark(false)}>
              Wrong
            </button>
            <button type="button" className="btn-primary" onClick={() => void mark(true)}>
              Right
            </button>
          </>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
