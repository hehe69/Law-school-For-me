import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { drillTargets } from "@/lib/drills";
import { fieldString } from "@/lib/fields";
import type { NodeMap } from "@/lib/types";
import { HypoDrill } from "@/components/views/HypoDrill";

export default async function HypoDrillPage({ params, searchParams }: { params: Promise<{ slug: string; id: string }>; searchParams: Promise<{ root?: string | string[] }> }) {
  const { slug, id } = await params;
  const { root } = await searchParams;
  const bundle = loadBundle(getDb(), id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  const map: NodeMap = {};
  for (const n of bundle.nodes) map[n.id] = n;
  const rootId = typeof root === "string" && map[root] ? root : null;
  const hypos = drillTargets(map, rootId, "hypo").map((n) => ({
    id: n.id,
    title: n.title,
    facts: fieldString(n, "facts"),
    question: fieldString(n, "question"),
    answer: fieldString(n, "answer"),
    turnsOn: fieldString(n, "turnsOn"),
  }));
  return <HypoDrill hypos={hypos} courseSlug={slug} outlineId={id} branchTitle={rootId ? map[rootId].title || "(untitled)" : "whole outline"} />;
}
