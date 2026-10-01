"use client";

import { useActionState, useState } from "react";
import { createCourseAction, type MetaFormState } from "@/app/content-actions";
import { slugify } from "@/lib/slug";

export default function CourseForm({ nextOrder, existingSlugs }: { nextOrder: number; existingSlugs: string[] }) {
  const [state, formAction, pending] = useActionState<MetaFormState, FormData>(createCourseAction, { error: null });
  const [title, setTitle] = useState("");
  const slug = slugify(title);
  const clash = slug !== "" && existingSlugs.includes(slug);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="font-medium">Title</span>
        <input type="text" name="title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1" />
      </label>
      <label className="block">
        <span className="font-medium">Order</span>
        <input type="number" name="order" defaultValue={nextOrder} className="mt-1 w-32 rounded border border-gray-300 px-2 py-1" />
        <span className="ml-2 text-sm text-gray-500">position on the home page</span>
      </label>
      <p className="text-sm text-gray-600">
        Folder: <code className="font-mono">content/{slug || "…"}/</code>
        {clash && <span className="ml-2 font-medium text-red-700">A course with this folder name already exists.</span>}
      </p>
      {state.error && <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Creating…" : "Create course"}
      </button>
    </form>
  );
}
