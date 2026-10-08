import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourseBySlug, getOutline, listOutlines } from "@/lib/courses";
import { loadNodes } from "@/lib/nodes";
import { maxDepth } from "@/lib/tree";
import type { NodeMap } from "@/lib/types";
import { generateAttackAction } from "@/app/attack-actions";

/** Options for generating an attack outline from a full outline. */
export default async function AttackPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const db = getDb();
  const course = getCourseBySlug(db, slug);
  if (!course) notFound();
  const source = getOutline(db, id);
  if (!source || source.courseId !== course.id) notFound();
  const nodes = loadNodes(db, id);
  const map: NodeMap = {};
  for (const n of nodes) map[n.id] = n;
  const depth = maxDepth(map);
  const tags = Array.from(new Set([...course.syllabusTopics, ...nodes.flatMap((n) => n.tags)])).sort();
  const existing = listOutlines(db, course.id).filter((o) => o.kind === "attack" && o.sourceOutlineId === id);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Attack outline from &quot;{source.name}&quot;</h1>
        <Link href={`/courses/${slug}/outlines/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
          Editor
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        The result is a separate, editable outline of kind &quot;attack&quot;. Each line remembers the node it came from, so <em>Regenerate</em> in its editor keeps your edits where the source is unchanged and flags lines whose source changed.
      </p>

      {existing.length > 0 && (
        <div className="card mt-6 text-sm">
          <h2 className="font-medium">Existing attack outlines from this source</h2>
          <ul className="mt-2 space-y-1">
            {existing.map((o) => (
              <li key={o.id}>
                <Link href={`/courses/${slug}/outlines/${o.id}`} className="text-blue-700 hover:underline">
                  {o.name}
                </Link>
                <span className="ml-2 text-xs text-gray-400">created {new Date(o.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={generateAttackAction} className="card mt-6 grid gap-4 text-sm">
        <input type="hidden" name="sourceId" value={id} />
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input id="name" name="name" className="input" defaultValue="Attack" />
        </div>
        <fieldset>
          <legend className="label">What each line carries</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="headings" /> Titles only
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" value="headings-rules" defaultChecked /> Titles, plus rule statements and elements for rule nodes
          </label>
        </fieldset>
        <div>
          <label className="label" htmlFor="maxDepth">
            Top N levels (the outline has {depth})
          </label>
          <select id="maxDepth" name="maxDepth" className="input w-auto" defaultValue="">
            <option value="">All levels</option>
            {Array.from({ length: depth }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Only nodes tagged (any of)</span>
          {tags.length === 0 ? (
            <p className="text-xs text-gray-400">No tags in use.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <label key={t} className="flex items-center gap-1 rounded border border-gray-200 px-2 py-0.5">
                  <input type="checkbox" name="tags" value={t} /> {t}
                </label>
              ))}
            </div>
          )}
          <input name="tags" className="input mt-2" placeholder="more tags, comma separated" />
          <p className="mt-1 text-xs text-gray-400">Untagged ancestors of a tagged node are kept for structure. Leave everything unticked for all nodes.</p>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="onlyFinal" /> Only nodes with status &quot;final&quot;
        </label>
        <div>
          <button type="submit" className="btn-primary">
            Generate attack outline
          </button>
        </div>
      </form>
    </div>
  );
}
