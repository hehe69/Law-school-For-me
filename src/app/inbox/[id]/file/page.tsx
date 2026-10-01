import Link from "next/link";
import { notFound } from "next/navigation";
import NoteForm, { type CourseOption } from "@/components/notes/NoteForm";
import { getCapture } from "@/lib/captures";
import { loadContent, ruleNoteOptions } from "@/lib/content/loader";
import { formatDate } from "@/lib/format";
import { toDateString } from "@/lib/sm2";

export const dynamic = "force-dynamic";

export default async function FileCapturePage({ params }: PageProps<"/inbox/[id]/file">) {
  const { id } = await params;
  const capture = getCapture(Number(id));
  if (!capture) notFound();
  const tree = loadContent();
  const pickers: CourseOption[] = tree.courses.map((c) => ({
    slug: c.slug,
    title: c.title,
    units: c.units.map((u) => ({ slug: u.slug, title: u.title, syllabusTopics: u.syllabusTopics, existingSlugs: u.notes.map((n) => n.slug) })),
    ruleNotes: ruleNoteOptions(c).map((r) => ({ ref: r.ref, label: r.label })),
  }));
  const first = pickers.find((c) => c.units.length > 0) ?? pickers[0];

  return (
    <div className="max-w-2xl">
      <p className="mb-1 text-sm text-gray-600"><Link href="/inbox" className="underline">Inbox</Link></p>
      <h1 className="mb-1 text-2xl font-semibold">File capture as note</h1>
      <p className="mb-4 text-sm text-gray-600">
        Captured {formatDate(capture.created_at)}.
        {capture.filed_at && <span className="ml-1 text-yellow-900">Already filed to {capture.filed_note_path}; saving again creates another note.</span>}
      </p>
      {!first ? (
        <p>No courses yet. <Link href="/courses/new" className="underline">Create one</Link> first.</p>
      ) : (
        <NoteForm
          courseSlug={first.slug}
          unitSlug={first.units[0]?.slug ?? ""}
          syllabusTopics={[]}
          existingSlugs={[]}
          pickers={pickers}
          capture={{ id: capture.id, text: capture.text, createdOn: toDateString(new Date(capture.created_at)) }}
        />
      )}
    </div>
  );
}
