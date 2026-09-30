import type { CaseNote } from "@/lib/content/types";
import { Field } from "./Field";
import NoteBody from "./NoteBody";

export default function CaseNoteCard({ note, body }: { note: CaseNote; body: string }) {
  return (
    <article className="mb-4 rounded border border-gray-200 p-4">
      <h4 className="mb-3 text-lg font-semibold">{note.name}</h4>
      <dl>
        <Field label="Facts">{note.facts}</Field>
        <Field label="Issue">{note.issue}</Field>
        <Field label="Rule">{note.rule}</Field>
        <Field label="Holding">{note.holding}</Field>
        <Field label="Why it matters">{note.whyItMatters}</Field>
      </dl>
      <NoteBody body={body} />
    </article>
  );
}
