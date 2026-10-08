import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { MAX_IMAGE_BYTES, saveImage } from "@/lib/attachments";
import { getNode } from "@/lib/nodes";
import { getCourse, getOutline } from "@/lib/courses";

/** Multipart upload of one image: fields `file`, `nodeId`, optional `caption`. Attaches it to the node. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const nodeId = form.get("nodeId");
  if (!(file instanceof File) || typeof nodeId !== "string") return Response.json({ error: "file and nodeId are required" }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES) return Response.json({ error: "image is larger than 25 MB" }, { status: 413 });
  const db = getDb();
  const node = getNode(db, nodeId);
  if (!node) return Response.json({ error: "node not found" }, { status: 404 });
  const outline = getOutline(db, node.outlineId);
  const course = outline ? getCourse(db, outline.courseId) : null;
  if (!course) return Response.json({ error: "course not found" }, { status: 404 });
  const caption = typeof form.get("caption") === "string" ? (form.get("caption") as string) : "";
  const image = saveImage(db, nodeId, course.slug, file.name, Buffer.from(await file.arrayBuffer()), caption);
  return Response.json(image);
}
