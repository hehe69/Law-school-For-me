"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getCourse, getOutline } from "@/lib/courses";
import { generateAttack, type AttackOptions } from "@/lib/attack";

export async function generateAttackAction(formData: FormData) {
  const db = getDb();
  const sourceId = String(formData.get("sourceId") ?? "");
  const source = getOutline(db, sourceId);
  if (!source) return;
  const course = getCourse(db, source.courseId);
  if (!course) return;
  const depthRaw = Number(formData.get("maxDepth"));
  const options: AttackOptions = {
    mode: formData.get("mode") === "headings" ? "headings" : "headings-rules",
    maxDepth: Number.isFinite(depthRaw) && depthRaw >= 1 ? Math.floor(depthRaw) : null,
    tags: formData
      .getAll("tags")
      .filter((t): t is string => typeof t === "string")
      .flatMap((t) => t.split(","))
      .map((t) => t.trim())
      .filter(Boolean),
    onlyFinal: formData.get("onlyFinal") === "on",
  };
  const name = String(formData.get("name") ?? "").trim() || "Attack";
  const outline = generateAttack(db, sourceId, options, name);
  if (!outline) return;
  redirect(`/courses/${course.slug}/outlines/${outline.id}`);
}
