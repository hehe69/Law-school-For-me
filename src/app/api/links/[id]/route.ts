import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { deleteLink, updateLink } from "@/lib/attachments";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/links/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; note?: unknown };
  const link = updateLink(getDb(), id, { kind: typeof body.kind === "string" ? body.kind : undefined, note: typeof body.note === "string" ? body.note : undefined });
  if (!link) return Response.json({ error: "link not found" }, { status: 404 });
  return Response.json(link);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/links/[id]">) {
  const { id } = await ctx.params;
  deleteLink(getDb(), id);
  return Response.json({ ok: true });
}
