import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { Checklist } from "@/components/views/Checklist";

export default async function ChecklistPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const bundle = loadBundle(getDb(), id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  return <Checklist outlineId={id} outlineName={bundle.outline.name} courseTitle={bundle.course.title} courseSlug={slug} nodes={bundle.nodes} numbering={bundle.outline.numbering} />;
}
