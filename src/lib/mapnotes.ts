// The note list the map editor needs: rule, case, and class notes of a course or unit, with each rule's elements.

import type { Course, Unit } from "./content/types";
import type { NoteInfo } from "@/components/mapeditor/model";

export function notesForMap(course: Course, only?: Unit): NoteInfo[] {
  const units = only ? [only] : course.units;
  const out: NoteInfo[] = [];
  for (const unit of units) {
    for (const note of unit.notes) {
      const fm = note.frontmatter;
      const base = { path: note.path, unitSlug: unit.slug, unitTitle: unit.title, href: `/courses/${course.slug}/units/${unit.slug}#note-${note.slug}`, draft: note.status === "draft" };
      if (fm.type === "rule") {
        out.push({
          ...base,
          kind: "rule",
          title: fm.name || note.slug,
          definition: fm.ruleStatement,
          elements: fm.elements.map((text, i) => ({
            index: i + 1,
            text,
            definition: fm.elementDefinitions[i] ?? "",
            exceptions: fm.exceptions.filter((_, j) => fm.exceptionElements[j] === i + 1),
          })),
        });
      } else if (fm.type === "case") {
        out.push({ ...base, kind: "case", title: fm.name || note.slug, definition: [fm.rule && `Rule: ${fm.rule}`, fm.holding && `Holding: ${fm.holding}`].filter(Boolean).join("\n\n") });
      } else {
        out.push({ ...base, kind: "class", title: `${fm.date || "?"} ${fm.topic || note.slug}`.trim(), definition: fm.professorPoint });
      }
    }
  }
  return out;
}
