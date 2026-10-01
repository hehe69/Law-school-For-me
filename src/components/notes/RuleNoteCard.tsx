import type { RuleNote } from "@/lib/content/types";
import { Field, FieldList } from "./Field";

export default function RuleFields({ note }: { note: RuleNote }) {
  return (
    <dl>
      <Field label="Rule statement">{note.ruleStatement}</Field>
      <FieldList label="Elements" items={note.elements} />
      <FieldList label="Exceptions" items={note.exceptions} />
      <Field label="Wisconsin variation">{note.wisconsinVariation}</Field>
    </dl>
  );
}
