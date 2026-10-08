import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { createLink } from "@/lib/attachments";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { fromNode?: unknown; toNode?: unknown; kind?: unknown; note?: unknown };
  if (typeof body.fromNode !== "string" || typeof body.toNode !== "string") return Response.json({ error: "fromNode and toNode are required" }, { status: 400 });
  const link = createLink(getDb(), body.fromNode, body.toNode, typeof body.kind === "string" ? body.kind : "see also", typeof body.note === "string" ? body.note : "");
  if (!link) return Response.json({ error: "could not create the link" }, { status: 400 });
  return Response.json(link);
}
