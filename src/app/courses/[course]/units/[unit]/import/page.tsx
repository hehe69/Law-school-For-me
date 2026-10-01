import Link from "next/link";
import { notFound } from "next/navigation";
import ImportForm from "@/components/ImportForm";
import { findUnit, loadContent } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export default async function ImportPage({ params }: PageProps<"/courses/[course]/units/[unit]/import">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const base = `/courses/${course.slug}/units/${unit.slug}`;

  return (
    <div className="max-w-3xl">
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / {course.title} /{" "}
        <Link href={base} className="underline">{unit.title}</Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Import questions</h1>
      <p className="mb-4 text-sm text-gray-600">
        Paste a JSON array of questions in the usual schema. Every question needs <code className="font-mono">id</code>,{" "}
        <code className="font-mono">stem</code>, exactly 5 <code className="font-mono">choices</code>, an{" "}
        <code className="font-mono">answer</code> index 0 to 4, an <code className="font-mono">explanation</code>, and optional{" "}
        <code className="font-mono">tags</code>. Ids must be new within the course. Nothing is written unless every question passes.
      </p>
      <ImportForm courseSlug={course.slug} unitSlug={unit.slug} existingCount={unit.questions.length} unitHref={base} />
    </div>
  );
}
