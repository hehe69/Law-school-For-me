import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getOutline } from "@/lib/courses";
import { loadNodes } from "@/lib/nodes";
import { flatten } from "@/lib/tree";
import type { NodeMap } from "@/lib/types";

/** A light list of an outline's nodes for pickers: id, title, type, depth, in document order. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/outlines/[id]/nodes">) {
  const { id } = await ctx.params;
  const db = getDb();
  if (!getOutline(db, id)) return Response.json({ error: "outline not found" }, { status: 404 });
  const map: NodeMap = {};
  for (const n of loadNodes(db, id)) map[n.id] = n;
  const rows = flatten(map, false).map((r) => ({ id: r.node.id, title: r.node.title, type: r.node.type, depth: r.depth }));
  return Response.json(rows);
}
