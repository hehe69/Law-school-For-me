import Link from "next/link";
import { notFound } from "next/navigation";
import MapPage from "@/components/map/MapPage";
import { findUnit, loadContent } from "@/lib/content/loader";
import { buildMap } from "@/lib/map";
import { listParam } from "@/lib/testing";

export const dynamic = "force-dynamic";

export default async function UnitMapPage({ params, searchParams }: PageProps<"/courses/[course]/units/[unit]/map">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const sp = await searchParams;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const focus = typeof sp.focus === "string" ? `rule:${sp.focus}` : undefined;
  return (
    <MapPage
      data={buildMap(course, unit)}
      title={unit.title}
      highlightTopics={listParam(sp.highlight)}
      focus={focus}
      crumbs={<><Link href="/" className="underline">Courses</Link> / <Link href={`/courses/${course.slug}`} className="underline">{course.title}</Link> / <Link href={`/courses/${course.slug}/units/${unit.slug}`} className="underline">{unit.title}</Link> · <Link href={`/courses/${course.slug}/map`} className="underline">whole course</Link></>}
    />
  );
}
