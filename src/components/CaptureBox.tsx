"use client";

// The capture box in the header: a line of text goes into the chosen course's inbox with the date.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";

type CourseChoice = { id: number; title: string; slug: string };

export function CaptureBox({ courses, unfiled }: { courses: CourseChoice[]; unfiled: Record<number, number> }) {
  const pathname = usePathname();
  const fromPath = courses.find((c) => pathname.startsWith(`/courses/${c.slug}`));
  // A course picked by hand holds until the URL points at a different course.
  const [picked, setPicked] = useState<{ onPath: number | null; id: number } | null>(null);
  const [text, setText] = useState("");
  const [counts, setCounts] = useState(unfiled);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const courseId = picked && picked.onPath === (fromPath?.id ?? null) ? picked.id : (fromPath?.id ?? courses[0]?.id);
  const setCourseId = (id: number) => setPicked({ onPath: fromPath?.id ?? null, id });
  const current = courses.find((c) => c.id === courseId);
  if (!current) return null;
  const n = counts[current.id] ?? 0;

  const save = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await api.post("/api/captures", { courseId: current.id, text: t });
      setText("");
      setCounts((c) => ({ ...c, [current.id]: (c[current.id] ?? 0) + 1 }));
      setFlash("Saved to inbox");
      setTimeout(() => setFlash(null), 2000);
    } catch (e) {
      setFlash((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <select className="input w-auto py-0.5 text-xs" value={current.id} onChange={(e) => setCourseId(Number(e.target.value))} aria-label="Capture to course">
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      <input
        className="input w-64 py-0.5 text-xs"
        placeholder="Capture a thought… (Enter saves to the inbox)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") (e.target as HTMLInputElement).blur();
        }}
        aria-label="Capture"
      />
      <button type="submit" className="btn py-0.5 text-xs" disabled={!text.trim() || busy}>
        Capture
      </button>
      {flash && <span className="text-xs text-green-700">{flash}</span>}
      <Link href={`/courses/${current.slug}/inbox`} className="ml-1 text-xs text-gray-500 hover:text-gray-900">
        Inbox{n > 0 ? ` (${n})` : ""}
      </Link>
    </form>
  );
}
