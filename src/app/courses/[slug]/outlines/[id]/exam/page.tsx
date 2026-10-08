import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { termsFromNodes } from "@/lib/glossary";
import { ExamMode } from "@/components/views/ExamMode";

export default async function ExamPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const db = getDb();
  const bundle = loadBundle(db, id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  return <ExamMode bundle={bundle} terms={termsFromNodes(bundle.nodes)} />;
}
