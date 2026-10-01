"use client";

// Edit one question. The fields mirror the questions.json schema for both types.

import { useActionState, useState } from "react";
import { saveQuestionAction, type QuestionFormState } from "@/app/content-actions";
import type { Question } from "@/lib/content/types";
import { choiceLetter } from "@/lib/format";

export type RuleNoteOption = { ref: string; label: string };

type Props = {
  courseSlug: string;
  unitSlug: string;
  question: Question;
  /** Rule notes in the course, as course-relative refs */
  ruleNotes: RuleNoteOption[];
  images: string[];
};

type IssueRow = { name: string; ruleNote: string; modelAnalysis: string };

export default function QuestionForm({ courseSlug, unitSlug, question, ruleNotes, images }: Props) {
  const [state, formAction, pending] = useActionState<QuestionFormState, FormData>(saveQuestionAction, { error: null });
  const [issues, setIssues] = useState<IssueRow[]>(question.type === "issue" ? question.issues.map((i) => ({ name: i.name, ruleNote: i.ruleNote, modelAnalysis: i.modelAnalysis })) : []);
  const inputCls = "mt-1 w-full rounded border border-gray-300 px-2 py-1";
  const choices = question.type === "mc" ? [...question.choices, "", "", "", "", ""].slice(0, 5) : [];

  const setIssue = (i: number, key: keyof IssueRow, value: string) => setIssues((rows) => rows.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="course" value={courseSlug} />
      <input type="hidden" name="unit" value={unitSlug} />
      <input type="hidden" name="id" value={question.id} />
      <input type="hidden" name="type" value={question.type} />

      <p className="text-sm text-gray-600">
        <span className="font-medium">id</span> <code className="font-mono">{question.id}</code> · <span className="font-medium">type</span> {question.type}
        <span className="ml-2 text-gray-500">(id and type cannot change; attempts are keyed by id)</span>
      </p>

      {question.type === "mc" ? (
        <>
          <label className="block">
            <span className="font-medium">Stem</span>
            <textarea name="stem" defaultValue={question.stem} rows={4} className={inputCls} />
          </label>
          <fieldset>
            <legend className="font-medium">Choices <span className="text-sm font-normal text-gray-500">(pick the correct one)</span></legend>
            {choices.map((c, i) => (
              <div key={i} className="mt-1 flex items-center gap-2">
                <input type="radio" name="answer" value={i} defaultChecked={question.answer === i} />
                <span className="w-5 font-semibold">{choiceLetter(i)}.</span>
                <input type="text" name={`choice-${i}`} defaultValue={c} className="flex-1 rounded border border-gray-300 px-2 py-1" />
              </div>
            ))}
          </fieldset>
          <label className="block">
            <span className="font-medium">Explanation</span>
            <textarea name="explanation" defaultValue={question.explanation} rows={3} className={inputCls} />
          </label>
        </>
      ) : (
        <>
          <label className="block">
            <span className="font-medium">Fact pattern</span>
            <textarea name="factPattern" defaultValue={question.factPattern} rows={8} className={inputCls} />
          </label>
          <label className="block">
            <span className="font-medium">Minutes</span>
            <input type="number" name="minutes" min={1} step={1} defaultValue={question.minutes} className="mt-1 w-32 rounded border border-gray-300 px-2 py-1" />
          </label>
          <fieldset>
            <legend className="font-medium">Issues</legend>
            <input type="hidden" name="issueCount" value={issues.length} />
            {issues.map((row, i) => (
              <div key={i} className="mt-2 rounded border border-gray-200 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">Issue {i + 1}</span>
                  <button type="button" onClick={() => setIssues(issues.filter((_, j) => j !== i))} className="text-xs text-gray-500 hover:text-red-700">Remove</button>
                </div>
                <label className="block text-sm">
                  Name
                  <input type="text" name={`issue-${i}-name`} value={row.name} onChange={(e) => setIssue(i, "name", e.target.value)} className={inputCls} />
                </label>
                <label className="mt-1 block text-sm">
                  Rule note
                  <select name={`issue-${i}-ruleNote`} value={row.ruleNote} onChange={(e) => setIssue(i, "ruleNote", e.target.value)} className={inputCls}>
                    {!ruleNotes.some((r) => r.ref === row.ruleNote) && <option value={row.ruleNote}>{row.ruleNote || "(choose)"}</option>}
                    {ruleNotes.map((r) => <option key={r.ref} value={r.ref}>{r.label}</option>)}
                  </select>
                </label>
                <label className="mt-1 block text-sm">
                  Model analysis
                  <textarea name={`issue-${i}-modelAnalysis`} value={row.modelAnalysis} onChange={(e) => setIssue(i, "modelAnalysis", e.target.value)} rows={3} className={inputCls} />
                </label>
              </div>
            ))}
            <button type="button" onClick={() => setIssues([...issues, { name: "", ruleNote: ruleNotes[0]?.ref ?? "", modelAnalysis: "" }])} className="mt-2 rounded border border-gray-300 px-3 py-1 text-sm">
              Add issue
            </button>
          </fieldset>
        </>
      )}

      <label className="block">
        <span className="font-medium">Tags</span> <span className="text-sm text-gray-500">comma separated</span>
        <input type="text" name="tags" defaultValue={question.tags.join(", ")} className={inputCls} />
      </label>

      <label className="block">
        <span className="font-medium">Image</span> <span className="text-sm text-gray-500">optional, shown above the {question.type === "mc" ? "stem" : "fact pattern"}</span>
        <select name="image" defaultValue={question.image ?? ""} className="mt-1 block rounded border border-gray-300 px-2 py-1">
          <option value="">(none)</option>
          {images.map((img) => <option key={img} value={`images/${img}`}>images/{img}</option>)}
        </select>
        {images.length === 0 && <span className="ml-2 text-sm text-gray-500">No images in this unit yet; add one from a note form.</span>}
      </label>

      {state.error && <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : "Save to questions.json"}
      </button>
    </form>
  );
}
