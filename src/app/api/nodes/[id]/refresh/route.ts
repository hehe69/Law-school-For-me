import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getStudyContentDir } from "@/lib/settings";
import { refreshLinkedNode } from "@/lib/studyapp";

/** Re-read the study-app note a node was imported from and overwrite the node's fields and body. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/nodes/[id]/refresh">) {
  const { id } = await ctx.params;
  const db = getDb();
  const result = refreshLinkedNode(db, id, getStudyContentDir(db).dir);
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result.node);
}
