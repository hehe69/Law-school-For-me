import type { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { addCapture } from "@/lib/attachments";
import { getCourse } from "@/lib/courses";

/** The header capture box posts { courseId, text }. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { courseId?: unknown; text?: unknown };
  const courseId = typeof body.courseId === "number" ? body.courseId : Number(body.courseId);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const db = getDb();
  if (!Number.isInteger(courseId) || !getCourse(db, courseId)) return Response.json({ error: "course not found" }, { status: 404 });
  if (!text) return Response.json({ error: "nothing to save" }, { status: 400 });
  return Response.json(addCapture(db, courseId, text));
}
