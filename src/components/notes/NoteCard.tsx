import Link from "next/link";
import type { Note } from "@/lib/content/types";
import CaseFields from "./CaseNoteCard";
import RuleFields from "./RuleNoteCard";
import ClassFields from "./ClassNoteCard";
import NoteBody from "./NoteBody";

/** Renders a note with the template for its type, a draft badge when fields are missing, and an Edit link. */
export type NoteLink = { href: string; label: string };
export type NoteLinks = {
  appliesRule?: NoteLink | { text: string };
  modifiesRule?: NoteLink | { text: string };
  relatedRules?: (NoteLink | { text: string })[];
};

function LinkOrText({ v }: { v: NoteLink | { text: string } }) {
  return "href" in v ? <Link href={v.href} className="text-blue-700 underline">{v.label}</Link> : <span>{v.text} <span className="text-xs text-gray-500">(not a rule note)</span></span>;
}

export default function NoteCard({ note, editHref, links, treeHref }: { note: Note; editHref?: string; links?: NoteLinks; treeHref?: string }) {
  const fm = note.frontmatter;
  const title =
    fm.type === "class"
      ? `${fm.date || "(no date)"} · ${fm.topic || "(no topic)"}`
      : fm.name || "(untitled)";
  const draft = note.status === "draft";
  const [courseSlug, unitSlug] = note.path.split("/");

  return (
    <article id={`note-${note.slug}`} className={`mb-4 rounded border p-4 ${draft ? "border-yellow-400 bg-yellow-50/40" : "border-gray-200"}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <h4 className="text-lg font-semibold">{title}</h4>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {draft && <span className="rounded bg-yellow-200 px-2 py-0.5 font-semibold text-yellow-900">Draft</span>}
          {treeHref && (
            <Link href={treeHref} className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-50">Tree</Link>
          )}
          {editHref && (
            <Link href={editHref} className="rounded border border-gray-300 px-2 py-0.5 hover:bg-gray-50">
              Edit
            </Link>
          )}
        </div>
      </div>
      {draft && <p className="mb-3 text-xs text-yellow-900">Missing: {note.missingFields.join(", ")}. Drafts make no flashcards.</p>}
      {fm.type === "case" && <CaseFields note={fm} />}
      {fm.type === "rule" && <RuleFields note={fm} />}
      {fm.type === "class" && <ClassFields note={fm} />}
      {links && (links.appliesRule || links.modifiesRule || (links.relatedRules && links.relatedRules.length > 0)) && (
        <p className="mt-1 text-sm text-gray-700">
          {links.appliesRule && <>Applies rule: <LinkOrText v={links.appliesRule} /></>}
          {links.modifiesRule && <>Modifies rule: <LinkOrText v={links.modifiesRule} /></>}
          {links.relatedRules && links.relatedRules.length > 0 && (
            <>Related rules: {links.relatedRules.map((r, i) => <span key={i}>{i > 0 && ", "}<LinkOrText v={r} /></span>)}</>
          )}
        </p>
      )}
      <NoteBody body={note.body} courseSlug={courseSlug} unitSlug={unitSlug} />
    </article>
  );
}
