"use client";

// Paste-a-JSON question importer. The textarea is controlled so errors come back with the paste intact.

import { useActionState, useState } from "react";
import Link from "next/link";
import { importQuestionsAction, type ImportState } from "@/app/content-actions";

type Props = { courseSlug: string; unitSlug: string; existingCount: number; unitHref: string };

export default function ImportForm({ courseSlug, unitSlug, existingCount, unitHref }: Props) {
  const initial: ImportState = { json: "", mode: "append", errors: [] };
  const [state, formAction, pending] = useActionState<ImportState, FormData>(importQuestionsAction, initial);
  const [json, setJson] = useState("");
  const [mode, setMode] = useState<"append" | "replace">("append");

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="course" value={courseSlug} />
      <input type="hidden" name="unit" value={unitSlug} />

      {state.success && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          Wrote {state.success.written} question{state.success.written === 1 ? "" : "s"} to{" "}
          <code className="font-mono">content/{state.success.path}</code>. The unit now has {state.success.total}.{" "}
          <Link href={unitHref} className="underline">Back to unit</Link>.
        </p>
      )}

      {state.errors.length > 0 && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm">
          <p className="mb-1 font-semibold text-red-800">Nothing was written. Fix these and submit again:</p>
          <ul className="list-disc space-y-0.5 pl-5 text-red-900">
            {state.errors.map((e, i) => (
              <li key={i}>
                {e.index === null ? "" : <span className="font-mono">[{e.index}]</span>} {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <label className="block">
        <span className="font-medium">Questions JSON</span>
        <textarea
          name="json"
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={18}
          spellCheck={false}
          placeholder={'[\n  { "id": "ap-006", "stem": "...", "choices": ["A", "B", "C", "D", "E"], "answer": 2, "explanation": "...", "tags": ["tacking"] }\n]'}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm"
        />
      </label>

      <fieldset>
        <legend className="mb-1 font-medium">On success</legend>
        <label className="block">
          <input type="radio" name="mode" value="append" checked={mode === "append"} onChange={() => setMode("append")} className="mr-2" />
          Append to the unit&apos;s {existingCount} existing question{existingCount === 1 ? "" : "s"}
        </label>
        <label className="block">
          <input type="radio" name="mode" value="replace" checked={mode === "replace"} onChange={() => setMode("replace")} className="mr-2" />
          Replace questions.json <span className="text-sm text-red-700">(the current {existingCount} are deleted)</span>
        </label>
      </fieldset>

      <button type="submit" disabled={pending} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Checking…" : "Validate and import"}
      </button>
    </form>
  );
}
