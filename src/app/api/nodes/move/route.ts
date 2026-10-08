import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { moveSubtreeToOutline } from "@/lib/attachments";

/** Move a node with its subtree into another outline: { nodeId, outlineId, parentId: string|null, position?: number }. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { nodeId?: unknown; outlineId?: unknown; parentId?: unknown; position?: unknown };
  if (typeof body.nodeId !== "string" || typeof body.outlineId !== "string") return Response.json({ error: "nodeId and outlineId are required" }, { status: 400 });
  const result = moveSubtreeToOutline(
    getDb(),
    body.nodeId,
    body.outlineId,
    typeof body.parentId === "string" && body.parentId ? body.parentId : null,
    typeof body.position === "number" ? body.position : null,
  );
  if (!result.ok) return Response.json({ error: result.error }, { status: 400 });
  return Response.json(result);
}
