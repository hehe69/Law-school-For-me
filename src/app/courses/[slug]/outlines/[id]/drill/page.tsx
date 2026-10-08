import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { loadBundle } from "@/lib/nodes";
import { childrenOf, descendantIds } from "@/lib/tree";
import { numberingLabel } from "@/lib/numbering";
import type { NodeMap } from "@/lib/types";
import { masteryForOutline } from "@/lib/drills";

/** Pick a branch to drill. */
export default async function DrillIndex({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const db = getDb();
  const bundle = loadBundle(db, id);
  if (!bundle || bundle.course.slug !== slug) notFound();
  const map: NodeMap = {};
  for (const n of bundle.nodes) map[n.id] = n;
  const recite = masteryForOutline(db, id, "recite");
  const hypo = masteryForOutline(db, id, "hypo");
  const base = `/courses/${slug}/outlines/${id}/drill`;
  const sections = [{ node: null as null | (typeof bundle.nodes)[number], ids: bundle.nodes.map((n) => n.id), label: "" }, ...childrenOf(map, null).map((n, i) => ({ node: n, ids: [n.id, ...descendantIds(map, n.id)], label: numberingLabel(bundle.outline.numbering, [i]) }))];
  const count = (ids: string[], type: string) => ids.filter((i) => map[i].type === type).length;
  const known = (ids: string[], m: typeof recite) => ids.filter((i) => m[i]?.mastery === "cold").length;
  const shaky = (ids: string[], m: typeof recite) => ids.filter((i) => m[i]?.mastery === "shaky").length;

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Drills · {bundle.outline.name}</h1>
        <Link href={`/courses/${slug}/outlines/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
          Editor
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        <strong>Recite</strong>: rule statements and element lists are hidden; say them out loud, reveal one at a time, mark right or wrong, with a timer. <strong>Hypo</strong>: write an answer to each
        hypo, reveal the model answer, mark right or wrong. Results colour the tree: green for &quot;know it cold&quot; (last tries all right), amber for &quot;shaky&quot;.
      </p>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="py-1">Branch</th>
            <th className="py-1">Rules</th>
            <th className="py-1">Hypos</th>
            <th className="py-1"></th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => {
            const rules = count(s.ids, "rule");
            const hypos = count(s.ids, "hypo");
            return (
              <tr key={s.node?.id ?? "all"} className="border-t border-gray-100">
                <td className="py-2 font-medium">
                  {s.node ? (
                    <>
                      <span className="font-mono text-gray-500">{s.label}</span> {s.node.title || "(untitled)"}
                    </>
                  ) : (
                    "Whole outline"
                  )}
                </td>
                <td className="py-2">
                  {rules}
                  {rules > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      <span className="text-green-700">{known(s.ids, recite)} cold</span> · <span className="text-amber-700">{shaky(s.ids, recite)} shaky</span>
                    </span>
                  )}
                </td>
                <td className="py-2">
                  {hypos}
                  {hypos > 0 && (
                    <span className="ml-2 text-xs text-gray-500">
                      <span className="text-green-700">{known(s.ids, hypo)} cold</span> · <span className="text-amber-700">{shaky(s.ids, hypo)} shaky</span>
                    </span>
                  )}
                </td>
                <td className="py-2 text-right">
                  <Link href={`${base}/recite${s.node ? `?root=${s.node.id}` : ""}`} className={`btn ${rules ? "" : "pointer-events-none opacity-40"}`}>
                    Recite
                  </Link>{" "}
                  <Link href={`${base}/hypo${s.node ? `?root=${s.node.id}` : ""}`} className={`btn ${hypos ? "" : "pointer-events-none opacity-40"}`}>
                    Hypos
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
