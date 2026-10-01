import type { RuleNote } from "@/lib/content/types";
import { Field, FieldList } from "./Field";

export default function RuleFields({ note }: { note: RuleNote }) {
  return (
    <dl>
      <Field label="Rule statement">{note.ruleStatement}</Field>
      <FieldList label="Elements" items={note.elements} />
      <FieldList label="Exceptions" items={note.exceptions.map((e, i) => (note.exceptionElements[i] ? `${e} (defeats element ${note.exceptionElements[i]})` : e))} />
      <Field label={note.wisconsinElement ? `Wisconsin variation (changes element ${note.wisconsinElement})` : "Wisconsin variation"}>{note.wisconsinVariation}</Field>
    </dl>
  );
}
