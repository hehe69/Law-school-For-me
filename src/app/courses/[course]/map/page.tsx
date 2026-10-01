import Link from "next/link";
import { notFound } from "next/navigation";
import MapPage from "@/components/map/MapPage";
import { findCourse, loadContent } from "@/lib/content/loader";
import { buildMap } from "@/lib/map";
import { listParam } from "@/lib/testing";

export const dynamic = "force-dynamic";

export default async function CourseMapPage({ params, searchParams }: PageProps<"/courses/[course]/map">) {
  const { course: courseSlug } = await params;
  const sp = await searchParams;
  const course = findCourse(loadContent(), courseSlug);
  if (!course) notFound();
  const focus = typeof sp.focus === "string" ? `rule:${sp.focus}` : undefined;
  return (
    <MapPage
      data={buildMap(course)}
      title={course.title}
      highlightTopics={listParam(sp.highlight)}
      focus={focus}
      crumbs={<><Link href="/" className="underline">Courses</Link> / <Link href={`/courses/${course.slug}`} className="underline">{course.title}</Link></>}
    />
  );
}
