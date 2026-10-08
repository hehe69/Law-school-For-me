import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourseBySlug, listOutlines } from "@/lib/courses";
import { loadNodes, loadSources } from "@/lib/nodes";
import { findGaps, type GapItem } from "@/lib/gaps";
import type { NodeMap } from "@/lib/types";

function GapList({ title, hint, items, slug }: { title: string; hint: string; items: GapItem[]; slug: string }) {
  return (
    <section className="card mt-4">
      <h2 className="text-base font-medium">
        {title} <span className="text-sm font-normal text-gray-500">({items.length})</span>
      </h2>
      <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-green-700">None.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {items.map((g) => (
            <li key={g.node.id}>
              <Link href={`/courses/${slug}/outlines/${g.outline.id}?node=${g.node.id}`} className="hover:underline">
                {g.node.title || "(untitled)"}
              </Link>
              <span className="ml-2 text-xs text-gray-400">
                {g.node.type} · {g.outline.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default async function GapsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const course = getCourseBySlug(db, slug);
  if (!course) notFound();
  const outlines = listOutlines(db, course.id).map((outline) => {
    const nodes: NodeMap = {};
    for (const n of loadNodes(db, outline.id)) nodes[n.id] = n;
    return { outline, nodes, sources: loadSources(db, outline.id) };
  });
  const gaps = findGaps(course, outlines);

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">Gaps · {course.title}</h1>
        <Link href={`/courses/${course.slug}`} className="text-sm text-gray-500 hover:text-gray-900">
          Course page
        </Link>
      </div>
      <p className="mt-1 text-sm text-gray-600">What the outlines are missing. Attack outlines are not counted.</p>

      <section className="card mt-6">
        <h2 className="text-base font-medium">
          Syllabus topics with no node <span className="text-sm font-normal text-gray-500">({gaps.topicsWithoutNode.length})</span>
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          No node in any outline is tagged with the topic.{" "}
          <Link href={`/courses/${course.slug}/syllabus`} className="text-blue-700 hover:underline">
            Edit the topics
          </Link>
          .
        </p>
        {course.syllabusTopics.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No syllabus topics set.</p>
        ) : gaps.topicsWithoutNode.length === 0 ? (
          <p className="mt-2 text-sm text-green-700">Every topic has a node.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {gaps.topicsWithoutNode.map((t) => (
              <li key={t} className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                {t}
              </li>
            ))}
          </ul>
        )}
      </section>
      <GapList title="Rules with no elements" hint="Rule nodes with an empty elements list and no element children." items={gaps.rulesWithoutElements} slug={slug} />
      <GapList title="Headings with no children" hint="Headings with nothing under them and no notes." items={gaps.headingsWithoutChildren} slug={slug} />
      <GapList title="Hypos with no answer" hint="Hypo nodes whose answer is empty." items={gaps.hyposWithoutAnswer} slug={slug} />
      <GapList title="Nodes with no source" hint="Rules, cases, statutes, elements, exceptions, policies and professor notes with no source attached." items={gaps.nodesWithoutSource} slug={slug} />
    </div>
  );
}
