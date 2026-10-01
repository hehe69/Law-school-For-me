import { notFound } from "next/navigation";
import MapEditor from "@/components/mapeditor/MapEditor";
import MapPrint from "@/components/mapeditor/MapPrint";
import { findUnit, loadContent } from "@/lib/content/loader";
import { readMap } from "@/lib/content/mapfile";
import { ruleMastery } from "@/lib/map";
import { notesForMap } from "@/lib/mapnotes";
import { listParam } from "@/lib/testing";

export const dynamic = "force-dynamic";

export default async function UnitMapPage({ params, searchParams }: PageProps<"/courses/[course]/units/[unit]/map">) {
  const { course: courseSlug, unit: unitSlug } = await params;
  const sp = await searchParams;
  const found = findUnit(loadContent(), courseSlug, unitSlug);
  if (!found) notFound();
  const { course, unit } = found;
  const { map, problems } = readMap(course.slug, unit.slug);
  if (sp.print === "fit" || sp.print === "tile") return <MapPrint file={map} mode={sp.print} title={`${unit.title} map`} />;
  return (
    <MapEditor
      courseSlug={course.slug}
      unitSlug={unit.slug}
      title={unit.title}
      initial={map}
      problems={problems}
      notes={notesForMap(course, unit)}
      mastery={ruleMastery(course)}
      highlightTopics={listParam(sp.highlight)}
      focusNote={typeof sp.focus === "string" ? sp.focus : undefined}
      backHref={`/courses/${course.slug}/units/${unit.slug}`}
      printHref={`/courses/${course.slug}/units/${unit.slug}/map`}
    />
  );
}
