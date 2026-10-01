import Link from "next/link";
import { notFound } from "next/navigation";
import QuestionForm, { type RuleNoteOption } from "@/components/QuestionForm";
import { findUnit, loadContent } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export default async function EditQuestionPage({ params }: PageProps<"/courses/[course]/units/[unit]/questions/[id]/edit">) {
  const { course: courseSlug, unit: unitSlug, id } = await params;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const question = unit.questions.find((q) => q.id === decodeURIComponent(id));
  if (!question) notFound();
  const ruleNotes: RuleNoteOption[] = course.units.flatMap((u) =>
    u.notes
      .filter((n) => n.frontmatter.type === "rule")
      .map((n) => ({ ref: `${u.slug}/notes/${n.slug}.md`, label: `${u.title}: ${n.frontmatter.type === "rule" ? n.frontmatter.name || n.slug : n.slug}${n.status === "draft" ? " (draft)" : ""}` })),
  );
  const base = `/courses/${course.slug}/units/${unit.slug}`;

  return (
    <div className="max-w-2xl">
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / {course.title} / <Link href={base} className="underline">{unit.title}</Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Edit question</h1>
      <p className="mb-4 text-sm text-gray-600">Writes back to <code className="font-mono">content/{course.slug}/{unit.slug}/questions.json</code>.</p>
      <QuestionForm courseSlug={course.slug} unitSlug={unit.slug} question={question} ruleNotes={ruleNotes} images={unit.images} />
    </div>
  );
}
