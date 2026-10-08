import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { reviewCard } from "@/lib/cards";
import { isRating } from "@/lib/sm2";
import { getNode } from "@/lib/nodes";

/** Rate a flashcard: { rating: 1 | 2 | 3 | 4 }. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/cards/[nodeId]/review">) {
  const { nodeId } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { rating?: unknown };
  if (!isRating(body.rating)) return Response.json({ error: "rating must be 1-4" }, { status: 400 });
  const db = getDb();
  const node = getNode(db, nodeId);
  if (!node || !node.flashcard) return Response.json({ error: "not a flashcard" }, { status: 404 });
  return Response.json(reviewCard(db, nodeId, body.rating));
}
