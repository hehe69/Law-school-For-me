import type { ClassNote } from "@/lib/content/types";
import { Field } from "./Field";

export default function ClassFields({ note }: { note: ClassNote }) {
  return (
    <dl>
      <Field label="Professor's point">{note.professorPoint}</Field>
      <Field label="Modifies rule">{note.modifiesRule}</Field>
    </dl>
  );
}
