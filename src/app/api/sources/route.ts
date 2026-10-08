import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { createSource } from "@/lib/attachments";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { nodeId?: unknown; kind?: unknown; reference?: unknown; url?: unknown };
  if (typeof body.nodeId !== "string") return Response.json({ error: "nodeId is required" }, { status: 400 });
  const source = createSource(getDb(), body.nodeId, typeof body.kind === "string" ? body.kind : "other", typeof body.reference === "string" ? body.reference : "", typeof body.url === "string" ? body.url : null);
  if (!source) return Response.json({ error: "node not found" }, { status: 404 });
  return Response.json(source);
}
