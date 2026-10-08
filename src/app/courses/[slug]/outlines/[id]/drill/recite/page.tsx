import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { drillTargets } from "@/lib/drills";
import { asElements, fieldString } from "@/lib/fields";
import type { NodeMap } from "@/lib/types";
import { ReciteDrill } from "@/components/views/ReciteDrill";

export default async function ReciteDrillPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ root?: string | string[] }> }) {
  const { slug, id } = await params;
  const { root } = await searchParams;
  const bundle = loadBundle(getDb(), id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  const map: NodeMap = {};
  for (const n of bundle.nodes) map[n.id] = n;
  const rootId = typeof root === "string" && map[root] ? root : null;
  const rules = drillTargets(map, rootId, "rule").map((n) => ({
    id: n.id,
    title: n.title,
    statement: fieldString(n, "ruleStatement"),
    elements: asElements(n.fields.elements)
      .filter((e) => e.text.trim())
      .map((e) => (e.definition ? `${e.text} — ${e.definition}` : e.text)),
    variation: fieldString(n, "localVariation"),
  }));
  return <ReciteDrill rules={rules} courseSlug={slug} outlineId={id} branchTitle={rootId ? map[rootId].title || "(untitled)" : "whole outline"} />;
}
