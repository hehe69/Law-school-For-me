// Gaps: what the outline is missing. Syllabus topics with no node, nodes that should cite a source but have
// none, rules without elements, headings with nothing under them, hypos without an answer.

import type { Course, NodeMap, Outline, OutlineNode, Source } from "./types.ts";
import { childrenOf } from "./tree.ts";
import { asElements, fieldString } from "./fields.ts";

export type GapItem = { node: OutlineNode; outline: Outline; detail?: string };

export type Gaps = {
  topicsWithoutNode: string[];
  nodesWithoutSource: GapItem[];
  rulesWithoutElements: GapItem[];
  headingsWithoutChildren: GapItem[];
  hyposWithoutAnswer: GapItem[];
};

/** Types that normally cite where they came from. */
export const SOURCED_TYPES = new Set<OutlineNode["type"]>(["rule", "case", "statute", "professor-note", "policy", "exception", "element"]);

export function findGaps(course: Course, outlines: { outline: Outline; nodes: NodeMap; sources: Source[] }[]): Gaps {
  const gaps: Gaps = { topicsWithoutNode: [], nodesWithoutSource: [], rulesWithoutElements: [], headingsWithoutChildren: [], hyposWithoutAnswer: [] };
  const tagged = new Set<string>();
  for (const { outline, nodes, sources } of outlines) {
    if (outline.kind === "attack") continue;
    const sourced = new Set(sources.map((s) => s.nodeId));
    for (const node of Object.values(nodes)) {
      for (const t of node.tags) tagged.add(t.toLowerCase());
      if (SOURCED_TYPES.has(node.type) && !sourced.has(node.id)) gaps.nodesWithoutSource.push({ node, outline });
      if (node.type === "rule" && asElements(node.fields.elements).filter((e) => e.text.trim()).length === 0 && !childrenOf(nodes, node.id).some((c) => c.type === "element")) {
        gaps.rulesWithoutElements.push({ node, outline });
      }
      if (node.type === "heading" && childrenOf(nodes, node.id).length === 0 && !node.body.trim()) gaps.headingsWithoutChildren.push({ node, outline });
      if (node.type === "hypo" && !fieldString(node, "answer").trim()) gaps.hyposWithoutAnswer.push({ node, outline });
    }
  }
  gaps.topicsWithoutNode = course.syllabusTopics.filter((t) => !tagged.has(t.toLowerCase()));
  return gaps;
}
