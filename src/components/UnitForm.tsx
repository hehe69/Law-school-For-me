"use client";

// Create a unit (title, order, topics) or edit an existing unit's title, order, and topics.

import { useActionState, useState } from "react";
import { createUnitAction, updateUnitAction, type MetaFormState } from "@/app/content-actions";
import { slugify } from "@/lib/slug";
import TopicList from "./TopicList";

type Props = {
  courseSlug: string;
  nextOrder: number;
  existingSlugs: string[];
  /** When editing */
  unit?: { slug: string; title: string; order: number; syllabusTopics: string[] };
};

export default function UnitForm({ courseSlug, nextOrder, existingSlugs, unit }: Props) {
  const editing = Boolean(unit);
  const [state, formAction, pending] = useActionState<MetaFormState, FormData>(editing ? updateUnitAction : createUnitAction, { error: null });
  const [title, setTitle] = useState(unit?.title ?? "");
  const slug = editing ? unit!.slug : slugify(title);
  const clash = !editing && slug !== "" && existingSlugs.includes(slug);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="course" value={courseSlug} />
      {editing && <input type="hidden" name="unit" value={unit!.slug} />}
      <label className="block">
        <span className="font-medium">Title</span>
        <input type="text" name="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1" />
      </label>
      <label className="block">
        <span className="font-medium">Order</span>
        <input type="number" name="order" defaultValue={unit?.order ?? nextOrder} className="mt-1 w-32 rounded border border-gray-300 px-2 py-1" />
        <span className="ml-2 text-sm text-gray-500">position in the syllabus</span>
      </label>
      <fieldset>
        <legend className="mb-1 font-medium">Syllabus topics</legend>
        <TopicList initial={unit?.syllabusTopics ?? []} />
      </fieldset>
      <p className="text-sm text-gray-600">
        Folder: <code className="font-mono">content/{courseSlug}/{slug || "…"}/</code>
        {clash && <span className="ml-2 font-medium text-red-700">A unit with this folder name already exists.</span>}
        {editing && <span className="ml-2 text-gray-500">(folder name does not change on edit; notes and questions are untouched)</span>}
      </p>
      {state.error && <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Saving…" : editing ? "Save unit.json" : "Create unit"}
      </button>
    </form>
  );
}
