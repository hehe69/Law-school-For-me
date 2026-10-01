import Link from "next/link";
import GraphView from "./GraphView";
import type { MapData } from "@/lib/map";

export default function MapPage({ data, title, crumbs, highlightTopics, focus }: { data: MapData; title: string; crumbs: React.ReactNode; highlightTopics: string[]; focus?: string }) {
  const uncovered = data.nodes.filter((n) => n.kind === "topic" && n.uncovered).length;
  return (
    <div className="-mx-4 px-4">
      <p className="mb-1 text-sm text-gray-600">{crumbs}</p>
      <h1 className="mb-2 text-2xl font-semibold">Map · {title}</h1>
      {highlightTopics.length > 0 && (
        <p className="mb-2 rounded border border-red-300 bg-red-50 p-2 text-sm text-red-900">
          Highlighting {highlightTopics.length} syllabus topic{highlightTopics.length === 1 ? "" : "s"} with no notes: {highlightTopics.join(", ")}.{" "}
          <Link href="/gaps" className="underline">Back to Gaps</Link>
        </p>
      )}
      {uncovered > 0 && highlightTopics.length === 0 && <p className="mb-2 text-sm text-gray-600">{uncovered} syllabus topic{uncovered === 1 ? "" : "s"} with no notes (dashed red circles).</p>}
      <GraphView data={data} title={title} highlightTopics={highlightTopics} initialFocus={focus} />
    </div>
  );
}
