import type { CaseNote } from "@/lib/content/types";
import { Field } from "./Field";

export default function CaseFields({ note }: { note: CaseNote }) {
  return (
    <dl>
      <Field label="Facts">{note.facts}</Field>
      <Field label="Issue">{note.issue}</Field>
      <Field label="Rule">{note.rule}</Field>
      <Field label="Holding">{note.holding}</Field>
      <Field label="Why it matters">{note.whyItMatters}</Field>
    </dl>
  );
}
