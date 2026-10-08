import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { applySync } from "@/lib/nodes";

/** The editor posts { upserts, deletes } after every change (debounced). */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/outlines/[id]/sync">) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const result = applySync(getDb(), id, body);
  if (!result) return Response.json({ error: "outline not found" }, { status: 404 });
  return Response.json(result);
}
