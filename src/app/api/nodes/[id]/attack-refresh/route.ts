import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { refreshAttackLine } from "@/lib/attack";

/** Overwrite one attack line from its source node and clear its flag. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/nodes/[id]/attack-refresh">) {
  const { id } = await ctx.params;
  const node = refreshAttackLine(getDb(), id);
  if (!node) return Response.json({ error: "the line has no source node any more" }, { status: 400 });
  return Response.json(node);
}
