"use client";

// Header widget: a textarea that saves raw in-class notes to the inbox from any page.

import { useActionState, useState } from "react";
import { captureAction, type CaptureState } from "@/app/content-actions";

export default function QuickCapture() {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  // Clear the box once the server confirms the save.
  const [state, formAction, pending] = useActionState<CaptureState, FormData>(
    async (prev, formData) => {
      const result = await captureAction(prev, formData);
      if (result.saved) setText("");
      return result;
    },
    { saved: false, error: null },
  );

  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="relative text-sm">
      <summary className="cursor-pointer select-none rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">Capture</summary>
      <form action={formAction} className="absolute right-0 z-10 mt-1 w-80 rounded border border-gray-300 bg-white p-2 shadow">
        <textarea
          name="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Raw class notes. Saved to the inbox with a timestamp; file them into a unit later."
          className="w-full rounded border border-gray-300 px-2 py-1"
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") (e.currentTarget.form as HTMLFormElement).requestSubmit(); }}
        />
        <div className="mt-1 flex items-center gap-2">
          <button type="submit" disabled={pending || !text.trim()} className="rounded bg-blue-700 px-3 py-1 text-white disabled:opacity-50">
            {pending ? "Saving…" : "Save to inbox"}
          </button>
          {state.saved && !pending && !text && <span className="text-green-700">Saved.</span>}
          {state.error && <span className="text-red-700">{state.error}</span>}
          <span className="ml-auto text-xs text-gray-500">Ctrl/⌘+Enter</span>
        </div>
      </form>
    </details>
  );
}
