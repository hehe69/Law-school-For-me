import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { ancestorIds } from "@/lib/tree";
import type { NodeMap } from "@/lib/types";

/** Picks a rule to chart. */
export default async function FlowchartIndex({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const bundle = loadBundle(getDb(), id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  const map: NodeMap = {};
  for (const n of bundle.nodes) map[n.id] = n;
  const rules = bundle.nodes.filter((n) => n.type === "rule");
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Flowcharts · {bundle.outline.name}</h1>
        <Link href={`/courses/${slug}/outlines/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
          Editor
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-600">A flowchart draws a rule as a decision tree: its elements one after the other, the exceptions that defeat each element, the Wisconsin variation, and hypos hanging off the element they test. Pick a rule, or chart a whole section from the editor&apos;s Views menu.</p>
      {rules.length === 0 && <p className="card mt-6 text-sm text-gray-500">No rule nodes in this outline yet.</p>}
      <ul className="mt-6 divide-y divide-gray-200 rounded border border-gray-200">
        {rules.map((r) => (
          <li key={r.id} className="px-4 py-2 text-sm">
            <Link href={`/courses/${slug}/outlines/${id}/flowchart/${r.id}`} className="font-medium hover:underline">
              {r.title || "(untitled)"}
            </Link>
            <span className="ml-2 text-xs text-gray-400">
              {ancestorIds(map, r.id)
                .reverse()
                .map((a) => map[a].title)
                .join(" › ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
