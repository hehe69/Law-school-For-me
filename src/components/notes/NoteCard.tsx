import type { Note } from "@/lib/content/types";
import CaseNoteCard from "./CaseNoteCard";
import RuleNoteCard from "./RuleNoteCard";
import ClassNoteCard from "./ClassNoteCard";

/** Picks the template for a note by its frontmatter type. */
export default function NoteCard({ note }: { note: Note }) {
  const fm = note.frontmatter;
  switch (fm.type) {
    case "case":
      return <CaseNoteCard note={fm} body={note.body} />;
    case "rule":
      return <RuleNoteCard note={fm} body={note.body} />;
    case "class":
      return <ClassNoteCard note={fm} body={note.body} />;
  }
}
