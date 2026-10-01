import Link from "next/link";
import { notFound } from "next/navigation";
import UnitForm from "@/components/UnitForm";
import { findCourse, loadContent } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export default async function NewUnitPage({ params }: PageProps<"/courses/[course]/units/new">) {
  const { course: courseSlug } = await params;
  const course = findCourse(loadContent(), courseSlug);
  if (!course) notFound();
  const nextOrder = course.units.reduce((m, u) => Math.max(m, u.order), 0) + 1;
  return (
    <div className="max-w-xl">
      <p className="mb-1 text-sm text-gray-600">
        <Link href="/" className="underline">Courses</Link> / <Link href={`/courses/${course.slug}`} className="underline">{course.title}</Link>
      </p>
      <h1 className="mb-1 text-2xl font-semibold">New unit</h1>
      <p className="mb-4 text-sm text-gray-600">Creates the unit folder with <code className="font-mono">unit.json</code> and an empty <code className="font-mono">notes/</code>.</p>
      <UnitForm courseSlug={course.slug} nextOrder={nextOrder} existingSlugs={course.units.map((u) => u.slug)} />
    </div>
  );
}
