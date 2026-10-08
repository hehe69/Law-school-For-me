// Making new nodes in the browser or on the server.

import type { NodeStatus, NodeType, OutlineNode } from "./types.ts";
import { emptyFields } from "./fields.ts";
import { newId } from "./ids.ts";

export function makeNode(outlineId: string, type: NodeType, status: NodeStatus, extra: Partial<OutlineNode> = {}): OutlineNode {
  const now = new Date().toISOString();
  return {
    id: newId(),
    outlineId,
    parentId: null,
    position: 0,
    type,
    status,
    title: "",
    body: "",
    fields: emptyFields(type),
    tags: [],
    collapsed: false,
    pinned: false,
    flashcard: false,
    linkedNotePath: null,
    linkedElementIndex: null,
    linkedNoteHash: null,
    sourceNodeId: null,
    sourceHash: null,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

/** Change a node's type, keeping the fields the new type also has and adding empty ones for the rest. */
export function retype(node: OutlineNode, type: NodeType): OutlineNode {
  const next = emptyFields(type);
  for (const key of Object.keys(next)) if (key in node.fields) next[key] = node.fields[key];
  // Keep unknown keys too, so switching back and forth loses nothing.
  for (const [key, value] of Object.entries(node.fields)) if (!(key in next)) next[key] = value;
  return { ...node, type, fields: next, updatedAt: new Date().toISOString() };
}
