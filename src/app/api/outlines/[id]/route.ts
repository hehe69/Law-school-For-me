import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { getOutline, updateOutline } from "@/lib/courses";
import { loadBundle } from "@/lib/nodes";
import type { NumberingStyle, OutlineOptions } from "@/lib/types";
import { NUMBERING_STYLES } from "@/lib/types";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/outlines/[id]">) {
  const { id } = await ctx.params;
  const bundle = loadBundle(getDb(), id);
  if (!bundle) return Response.json({ error: "outline not found" }, { status: 404 });
  return Response.json(bundle);
}

/** Outline settings from the editor toolbar: { name?, numbering?, options? }. */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/outlines/[id]">) {
  const { id } = await ctx.params;
  const db = getDb();
  if (!getOutline(db, id)) return Response.json({ error: "outline not found" }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    body = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const patch: { name?: string; numbering?: NumberingStyle; options?: OutlineOptions } = {};
  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.numbering === "string" && (NUMBERING_STYLES as readonly string[]).includes(body.numbering)) patch.numbering = body.numbering as NumberingStyle;
  if (typeof body.options === "object" && body.options !== null) patch.options = body.options as OutlineOptions;
  const outline = updateOutline(db, id, patch);
  return Response.json(outline);
}
