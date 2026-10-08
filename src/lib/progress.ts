// Progress and page estimates: counts by status per outline and per top-level section, stale sections, word
// counts, and the printed-page estimate used by page-limit mode.

import type { ImageRow, NodeMap, NodeStatus, OutlineNode } from "./types.ts";
import { NODE_STATUSES } from "./types.ts";
import { childrenOf, descendantIds } from "./tree.ts";
import { countWords, nodeText } from "./fields.ts";

export type StatusCounts = Record<NodeStatus, number> & { total: number };

export function countStatuses(nodes: OutlineNode[]): StatusCounts {
  const counts = { empty: 0, skeleton: 0, drafted: 0, final: 0, total: nodes.length } as StatusCounts;
  for (const n of nodes) counts[n.status]++;
  return counts;
}

export type SectionProgress = {
  node: OutlineNode;
  counts: StatusCounts;
  words: number;
  lastEdited: string;
  /** Days since the newest edit anywhere in the section */
  staleDays: number;
};

export const STALE_AFTER_DAYS = 14;

export function sectionProgress(nodes: NodeMap, now = new Date()): SectionProgress[] {
  return childrenOf(nodes, null).map((top) => {
    const members = [top, ...descendantIds(nodes, top.id).map((id) => nodes[id])];
    const lastEdited = members.reduce((m, n) => (n.updatedAt > m ? n.updatedAt : m), "");
    const staleDays = lastEdited ? Math.floor((now.getTime() - new Date(lastEdited).getTime()) / 86400000) : 0;
    return { node: top, counts: countStatuses(members), words: members.reduce((w, n) => w + countWords(nodeText(n)), 0), lastEdited, staleDays };
  });
}

export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export const STATUS_ORDER: NodeStatus[] = [...NODE_STATUSES];

/**
 * Estimated printed pages for an outline, single-spaced 11-point with headings: about 380 words of text per
 * page, each node adding a title line and spacing (about 55 lines per page), and an image about a quarter page.
 */
export function estimatePages(nodes: OutlineNode[], images: ImageRow[] = []): number {
  const words = nodes.reduce((w, n) => w + countWords(nodeText(n)), 0);
  const titleLines = nodes.length * 1.4;
  const imagePages = images.reduce((p, img) => p + Math.min(0.6, Math.max(0.15, (img.widthHint ?? 500) / 2000)), 0);
  return Math.round((words / 380 + titleLines / 55 + imagePages) * 10) / 10;
}
