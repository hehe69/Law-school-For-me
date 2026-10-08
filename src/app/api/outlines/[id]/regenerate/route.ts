import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { regenerateAttack } from "@/lib/attack";

/** Bring an attack outline up to date with its source outline. */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/outlines/[id]/regenerate">) {
  const { id } = await ctx.params;
  const result = regenerateAttack(getDb(), id);
  if (!result) return Response.json({ error: "not an attack outline with a source" }, { status: 400 });
  return Response.json(result);
}
