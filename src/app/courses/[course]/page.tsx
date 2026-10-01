import Link from "next/link";
import { notFound } from "next/navigation";
import ContentErrors from "@/components/ContentErrors";
import UnitTable from "@/components/UnitTable";
import { unitStatsMap } from "@/lib/attempts";
import { findCourse, loadContent } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: PageProps<"/courses/[course]">) {
  const { course: courseSlug } = await params;
  const tree = loadContent();
  const course = findCourse(tree, courseSlug);
  if (!course) notFound();
  const errors = tree.errors.filter((e) => e.path.startsWith(`${course.slug}/`) || e.path === course.slug);

  return (
    <div>
      <p className="mb-1 text-sm text-gray-600"><Link href="/" className="underline">Courses</Link></p>
      <h1 className="mb-1 text-2xl font-semibold">{course.title}</h1>
      <p className="mb-4 text-sm text-gray-600"><code className="font-mono">content/{course.slug}/</code> · order {course.order}</p>

      <ContentErrors errors={errors} title="Problems in this course's files" />

      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/courses/${course.slug}/units/new`} className="rounded bg-blue-700 px-4 py-2 text-white">New unit</Link>
        <Link href={`/courses/${course.slug}/weak-tags`} className="text-blue-700 underline">Weak tags</Link>
        <Link href={`/review?course=${course.slug}`} className="text-blue-700 underline">Review cards</Link>
      </div>

      <UnitTable course={course} stats={unitStatsMap()} showEdit />
    </div>
  );
}
