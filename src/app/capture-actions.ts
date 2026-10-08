"use server";

// Inbox actions: file a capture as a node, or discard it.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { getCourse, getOutline } from "@/lib/courses";
import { deleteCapture, getCapture, markCaptureFiled } from "@/lib/attachments";
import { getNode, loadNodes, upsertNodes } from "@/lib/nodes";
import { makeNode } from "@/lib/nodeFactory";
import type { NodeStatus, NodeType } from "@/lib/types";
import { NODE_STATUSES, NODE_TYPES } from "@/lib/types";

const text = (fd: FormData, key: string): string => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};

export async function fileCaptureAction(formData: FormData) {
  const db = getDb();
  const captureId = Number(text(formData, "captureId"));
  const capture = getCapture(db, captureId);
  if (!capture) return;
  const course = getCourse(db, capture.courseId);
  if (!course) return;
  const outlineId = text(formData, "outlineId");
  const outline = getOutline(db, outlineId);
  if (!outline || outline.courseId !== course.id) return;
  const parentId = text(formData, "parentId") || null;
  if (parentId) {
    const parent = getNode(db, parentId);
    if (!parent || parent.outlineId !== outlineId) return;
  }
  const typeRaw = text(formData, "type");
  const type: NodeType = (NODE_TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as NodeType) : "free";
  const statusRaw = text(formData, "status");
  const status: NodeStatus = (NODE_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as NodeStatus) : "drafted";
  const tags = text(formData, "tags")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const siblings = loadNodes(db, outlineId).filter((n) => n.parentId === parentId);
  const node = makeNode(outlineId, type, status, {
    parentId,
    position: siblings.length,
    title: text(formData, "title").trim(),
    body: text(formData, "body"),
    tags: Array.from(new Set(tags)),
  });
  upsertNodes(db, [node]);
  markCaptureFiled(db, captureId, node.id);
  revalidatePath(`/courses/${course.slug}/inbox`);
  redirect(`/courses/${course.slug}/outlines/${outlineId}?node=${node.id}`);
}

export async function discardCaptureAction(formData: FormData) {
  const db = getDb();
  const captureId = Number(text(formData, "captureId"));
  const capture = getCapture(db, captureId);
  if (!capture) return;
  const course = getCourse(db, capture.courseId);
  deleteCapture(db, captureId);
  if (course) revalidatePath(`/courses/${course.slug}/inbox`);
}

export async function unfileCaptureAction(formData: FormData) {
  const db = getDb();
  const captureId = Number(text(formData, "captureId"));
  const capture = getCapture(db, captureId);
  if (!capture) return;
  db.prepare("UPDATE captures SET filed = 0, filed_node_id = NULL WHERE id = ?").run(captureId);
  const course = getCourse(db, capture.courseId);
  if (course) revalidatePath(`/courses/${course.slug}/inbox`);
}
