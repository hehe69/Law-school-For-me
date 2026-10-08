import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { deleteSource, updateSource } from "@/lib/attachments";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/sources/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; reference?: unknown; url?: unknown };
  const source = updateSource(getDb(), id, {
    kind: typeof body.kind === "string" ? body.kind : undefined,
    reference: typeof body.reference === "string" ? body.reference : undefined,
    url: body.url === null ? null : typeof body.url === "string" ? body.url : undefined,
  });
  if (!source) return Response.json({ error: "source not found" }, { status: 404 });
  return Response.json(source);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/sources/[id]">) {
  const { id } = await ctx.params;
  deleteSource(getDb(), id);
  return Response.json({ ok: true });
}
