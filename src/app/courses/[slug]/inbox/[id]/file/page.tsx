import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourseBySlug, listOutlines } from "@/lib/courses";
import { getCapture } from "@/lib/attachments";
import { loadNodes } from "@/lib/nodes";
import { flatten } from "@/lib/tree";
import type { NodeMap } from "@/lib/types";
import { FileCaptureForm } from "@/components/FileCaptureForm";

export default async function FileCapturePage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const db = getDb();
  const course = getCourseBySlug(db, slug);
  if (!course) notFound();
  const capture = getCapture(db, Number(id));
  if (!capture || capture.courseId !== course.id) notFound();
  const outlines = listOutlines(db, course.id).map((o) => {
    const map: NodeMap = {};
    for (const n of loadNodes(db, o.id)) map[n.id] = n;
    return {
      id: o.id,
      name: o.name,
      kind: o.kind,
      isDefault: o.isDefault,
      nodes: flatten(map, false).map((r) => ({ id: r.node.id, title: r.node.title, type: r.node.type, depth: r.depth })),
    };
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">File as node</h1>
        <Link href={`/courses/${course.slug}/inbox`} className="text-sm text-gray-500 hover:text-gray-900">
          Back to the inbox
        </Link>
      </div>
      <div className="card mt-4 whitespace-pre-wrap text-sm text-gray-700">{capture.text}</div>
      <FileCaptureForm capture={capture} outlines={outlines} topics={course.syllabusTopics} />
    </div>
  );
}
