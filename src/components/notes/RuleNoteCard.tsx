import type { RuleNote } from "@/lib/content/types";
import { Field, FieldList } from "./Field";
import NoteBody from "./NoteBody";

export default function RuleNoteCard({ note, body }: { note: RuleNote; body: string }) {
  return (
    <article className="mb-4 rounded border border-gray-200 p-4">
      <h4 className="mb-3 text-lg font-semibold">{note.name}</h4>
      <dl>
        <Field label="Rule statement">{note.ruleStatement}</Field>
        <FieldList label="Elements" items={note.elements} />
        <FieldList label="Exceptions" items={note.exceptions} />
        <Field label="Wisconsin variation">{note.wisconsinVariation}</Field>
      </dl>
      <NoteBody body={body} />
    </article>
  );
}
