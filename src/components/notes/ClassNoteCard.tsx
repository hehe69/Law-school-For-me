import type { ClassNote } from "@/lib/content/types";
import { Field } from "./Field";
import NoteBody from "./NoteBody";

export default function ClassNoteCard({ note, body }: { note: ClassNote; body: string }) {
  return (
    <article className="mb-4 rounded border border-gray-200 p-4">
      <h4 className="mb-3 text-lg font-semibold">
        {note.date} <span className="font-normal text-gray-600">·</span> {note.topic}
      </h4>
      <dl>
        <Field label="Professor's point">{note.professorPoint}</Field>
        <Field label="Modifies rule">{note.modifiesRule}</Field>
      </dl>
      <NoteBody body={body} />
    </article>
  );
}
