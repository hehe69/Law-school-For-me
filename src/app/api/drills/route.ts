import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { recordDrill } from "@/lib/drills";
import { getNode } from "@/lib/nodes";

/** Store one drill result: { nodeId, mode: "recite" | "hypo", correct: boolean }. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { nodeId?: unknown; mode?: unknown; correct?: unknown };
  if (typeof body.nodeId !== "string" || (body.mode !== "recite" && body.mode !== "hypo") || typeof body.correct !== "boolean") {
    return Response.json({ error: "nodeId, mode and correct are required" }, { status: 400 });
  }
  const db = getDb();
  if (!getNode(db, body.nodeId)) return Response.json({ error: "node not found" }, { status: 404 });
  return Response.json(recordDrill(db, body.nodeId, body.mode, body.correct));
}
