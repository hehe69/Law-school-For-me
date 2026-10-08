import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { deleteImage, getImage, updateImage } from "@/lib/attachments";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/images/[id]">) {
  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { caption?: unknown; widthHint?: unknown; position?: unknown };
  const image = updateImage(getDb(), id, {
    caption: typeof body.caption === "string" ? body.caption : undefined,
    widthHint: body.widthHint === null ? null : typeof body.widthHint === "number" ? body.widthHint : undefined,
    position: typeof body.position === "number" ? body.position : undefined,
  });
  if (!image) return Response.json({ error: "image not found" }, { status: 404 });
  return Response.json(image);
}

export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/images/[id]">) {
  const { id } = await ctx.params;
  const db = getDb();
  if (!getImage(db, id)) return Response.json({ error: "image not found" }, { status: 404 });
  deleteImage(db, id);
  return Response.json({ ok: true });
}
