import { notFound } from "next/navigation";
import MapEditor from "@/components/mapeditor/MapEditor";
import MapPrint from "@/components/mapeditor/MapPrint";
import { findCourse, loadContent } from "@/lib/content/loader";
import { readMap } from "@/lib/content/mapfile";
import { ruleMastery } from "@/lib/map";
import { notesForMap } from "@/lib/mapnotes";
import { listParam } from "@/lib/testing";

export const dynamic = "force-dynamic";

export default async function CourseMapPage({ params, searchParams }: PageProps<"/courses/[course]/map">) {
  const { course: courseSlug } = await params;
  const sp = await searchParams;
  const course = findCourse(loadContent(), courseSlug);
  if (!course) notFound();
  const { map, problems } = readMap(course.slug);
  if (sp.print === "fit" || sp.print === "tile") return <MapPrint file={map} mode={sp.print} title={`${course.title} map`} />;
  return (
    <MapEditor
      courseSlug={course.slug}
      unitSlug=""
      title={course.title}
      initial={map}
      problems={problems}
      notes={notesForMap(course)}
      mastery={ruleMastery(course)}
      highlightTopics={listParam(sp.highlight)}
      focusNote={typeof sp.focus === "string" ? sp.focus : undefined}
      backHref={`/courses/${course.slug}`}
      printHref={`/courses/${course.slug}/map`}
    />
  );
}
