import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { listSnapshots, takeSnapshot } from "@/lib/snapshots";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/outlines/[id]/snapshots">) {
  const { id } = await ctx.params;
  return Response.json(listSnapshots(getDb(), id));
}

/** Take a manual snapshot: { label }. */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/outlines/[id]/snapshots">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { label?: unknown };
  const snapshot = takeSnapshot(getDb(), id, typeof body.label === "string" ? body.label.trim() : "");
  if (!snapshot) return Response.json({ error: "outline not found" }, { status: 404 });
  return Response.json(snapshot);
}
