import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { listOutlines } from "@/lib/courses";
import { getSyllabus, syllabusUrl } from "@/lib/syllabus";
import { masteryForOutline } from "@/lib/drills";
import { ensureDailySnapshot } from "@/lib/snapshots";
import { Editor } from "@/components/editor/Editor";

export default async function OutlinePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ node?: string | string[]; pane?: string | string[] }>;
}) {
  const { slug, id } = await params;
  const { node, pane } = await searchParams;
  const db = getDb();
  const bundle = loadBundle(db, id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  // Opening an outline takes the day's automatic snapshot when it changed since the last one.
  ensureDailySnapshot(db, id);
  const siblings = listOutlines(db, bundle.course.id).map((o) => ({ id: o.id, name: o.name, kind: o.kind }));
  const syllabus = getSyllabus(db, bundle.course.id);
  const mastery = { ...masteryForOutline(db, id, "recite"), ...masteryForOutline(db, id, "hypo") };
  return (
    <Editor
      key={id}
      bundle={bundle}
      outlines={siblings}
      initialNodeId={typeof node === "string" ? node : null}
      syllabusUrl={syllabus ? syllabusUrl(syllabus) : null}
      initialPane={pane === "syllabus" ? "syllabus" : null}
      mastery={mastery}
    />
  );
}
