import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { listOutlines } from "@/lib/courses";
import { Editor } from "@/components/editor/Editor";

export default async function OutlinePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ node?: string | string[] }>;
}) {
  const { slug, id } = await params;
  const { node } = await searchParams;
  const db = getDb();
  const bundle = loadBundle(db, id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  const siblings = listOutlines(db, bundle.course.id).map((o) => ({ id: o.id, name: o.name, kind: o.kind }));
  return <Editor key={id} bundle={bundle} outlines={siblings} initialNodeId={typeof node === "string" ? node : null} />;
}
