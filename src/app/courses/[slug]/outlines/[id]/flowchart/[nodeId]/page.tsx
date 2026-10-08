import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { buildFlow } from "@/lib/flowchart";
import type { NodeMap } from "@/lib/types";
import { Flowchart } from "@/components/views/Flowchart";

export default async function FlowchartPage({ params }: { params: Promise<{ slug: string; id: string; nodeId: string }> }) {
  const { slug, id, nodeId } = await params;
  const bundle = loadBundle(getDb(), id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  const map: NodeMap = {};
  for (const n of bundle.nodes) map[n.id] = n;
  const root = map[nodeId];
  if (!root) notFound();
  const rules = buildFlow(map, bundle.links, nodeId);
  const otherRules = bundle.nodes.filter((n) => n.type === "rule" && n.id !== nodeId).map((n) => ({ id: n.id, title: n.title }));
  return <Flowchart rules={rules} courseSlug={slug} outlineId={id} rootTitle={root.title || "(untitled)"} otherRules={otherRules} />;
}
