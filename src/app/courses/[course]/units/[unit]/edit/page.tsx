import Link from "next/link";
import { notFound } from "next/navigation";
import UnitForm from "@/components/UnitForm";
import { findUnit, loadContent } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export default async function EditUnitPage({ params }: PageProps<"/courses/[course]/units/[unit]/edit">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  return (
    <div className="max-w-xl">
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / <Link href={`/courses/${course.slug}`} className="underline">{course.title}</Link> /{" "}
        <Link href={`/courses/${course.slug}/units/${unit.slug}`} className="underline">{unit.title}</Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">Edit unit</h1>
      <p className="mb-4 text-sm text-gray-600">Changes only <code className="font-mono">content/{course.slug}/{unit.slug}/unit.json</code>. Emphasis and other keys are kept.</p>
      <UnitForm
        courseSlug={course.slug}
        nextOrder={unit.order}
        existingSlugs={course.units.map((u) => u.slug)}
        unit={{ slug: unit.slug, title: unit.title, order: unit.order, syllabusTopics: unit.syllabusTopics }}
      />
    </div>
  );
}
