import { test } from "node:test";
import assert from "node:assert/strict";
import type { NodeMap, OutlineNode } from "../src/lib/types.ts";
import {
  childrenOf,
  collapseToLevel,
  diffNodes,
  flatten,
  indentNode,
  insertNode,
  moveAmongSiblings,
  moveSubtree,
  outdentNode,
  promoteChildren,
  removeSubtree,
} from "../src/lib/tree.ts";

let counter = 0;
function node(id: string, parentId: string | null, position: number, extra: Partial<OutlineNode> = {}): OutlineNode {
  counter++;
  return {
    id,
    outlineId: "o",
    parentId,
    position,
    type: "heading",
    status: "empty",
    title: id,
    body: "",
    fields: {},
    tags: [],
    collapsed: false,
    pinned: false,
    flashcard: false,
    linkedNotePath: null,
    linkedElementIndex: null,
    linkedNoteHash: null,
    sourceNodeId: null,
    sourceHash: null,
    createdAt: `2026-01-01T00:00:${String(counter).padStart(2, "0")}Z`,
    updatedAt: "2026-01-01T00:00:00Z",
    ...extra,
  };
}

/** a(b(c, d), e) */
function sample(): NodeMap {
  const list = [node("a", null, 0), node("b", "a", 0), node("c", "b", 0), node("d", "b", 1), node("e", "a", 1), node("f", null, 1)];
  return Object.fromEntries(list.map((n) => [n.id, n]));
}

const order = (nodes: NodeMap, respectCollapsed = true) => flatten(nodes, respectCollapsed).map((r) => `${r.node.id}:${r.depth}`);

test("flatten walks depth first with paths and honours collapsed", () => {
  const nodes = sample();
  assert.deepEqual(order(nodes), ["a:0", "b:1", "c:2", "d:2", "e:1", "f:0"]);
  assert.deepEqual(flatten(nodes).map((r) => r.path.join(".")), ["0", "0.0", "0.0.0", "0.0.1", "0.1", "1"]);
  const collapsed = { ...nodes, b: { ...nodes.b, collapsed: true } };
  assert.deepEqual(order(collapsed), ["a:0", "b:1", "e:1", "f:0"]);
  assert.deepEqual(order(collapsed, false), ["a:0", "b:1", "c:2", "d:2", "e:1", "f:0"]);
});

test("insert, remove and positions stay normalised", () => {
  let nodes = sample();
  nodes = insertNode(nodes, node("x", null, 0), "a", 1, "2026-02-02T00:00:00Z");
  assert.deepEqual(childrenOf(nodes, "a").map((n) => n.id), ["b", "x", "e"]);
  assert.deepEqual(childrenOf(nodes, "a").map((n) => n.position), [0, 1, 2]);
  assert.equal(nodes.x.updatedAt, "2026-02-02T00:00:00Z");
  const { nodes: after, removed } = removeSubtree(nodes, "b");
  assert.deepEqual(removed.sort(), ["b", "c", "d"]);
  assert.deepEqual(childrenOf(after, "a").map((n) => [n.id, n.position]), [["x", 0], ["e", 1]]);
  assert.equal(after.c, undefined);
});

test("move subtree refuses its own descendants", () => {
  const nodes = sample();
  assert.equal(moveSubtree(nodes, "a", "c", 0), null);
  assert.equal(moveSubtree(nodes, "a", "a", 0), null);
  const moved = moveSubtree(nodes, "b", null, 0)!;
  assert.deepEqual(order(moved), ["b:0", "c:1", "d:1", "a:0", "e:1", "f:0"]);
  assert.deepEqual(childrenOf(moved, null).map((n) => n.position), [0, 1, 2]);
});

test("indent and outdent", () => {
  const nodes = sample();
  assert.equal(indentNode(nodes, "a"), null, "first child cannot indent");
  assert.equal(outdentNode(nodes, "a"), null, "top level cannot outdent");
  const indented = indentNode(nodes, "e")!;
  assert.deepEqual(order(indented), ["a:0", "b:1", "c:2", "d:2", "e:2", "f:0"]);
  // c leaves b and sits right after it; d and e stay under b.
  const outdented = outdentNode(indented, "c")!;
  assert.deepEqual(order(outdented), ["a:0", "b:1", "d:2", "e:2", "c:1", "f:0"]);
  assert.deepEqual(childrenOf(outdented, "a").map((n) => n.position), [0, 1]);
  // Indenting into a collapsed sibling opens it.
  const withCollapsed = { ...nodes, b: { ...nodes.b, collapsed: true } };
  const opened = indentNode(withCollapsed, "e")!;
  assert.equal(opened.b.collapsed, false);
});

test("move among siblings with and without children", () => {
  const nodes = sample();
  // With children: b swaps with e.
  const down = moveAmongSiblings(nodes, "b", 1, true)!;
  assert.deepEqual(order(down), ["a:0", "e:1", "b:1", "c:2", "d:2", "f:0"]);
  assert.equal(moveAmongSiblings(nodes, "b", -1, true), null);
  // Without children: c and d stay in b's place, b moves below e.
  const alone = moveAmongSiblings(nodes, "b", 1, false)!;
  assert.deepEqual(order(alone), ["a:0", "c:1", "d:1", "e:1", "b:1", "f:0"]);
  // Collapsed nodes always carry their children.
  const collapsed = { ...nodes, b: { ...nodes.b, collapsed: true } };
  const carried = moveAmongSiblings(collapsed, "b", 1, false)!;
  assert.deepEqual(order(carried, false), ["a:0", "e:1", "b:1", "c:2", "d:2", "f:0"]);
  // Moving up without children: promoted children keep their place after the node.
  const up = moveAmongSiblings(down, "b", -1, false)!;
  assert.deepEqual(order(up), ["a:0", "b:1", "e:1", "c:1", "d:1", "f:0"]);
});

test("promote children", () => {
  const promoted = promoteChildren(sample(), "b");
  assert.deepEqual(order(promoted), ["a:0", "b:1", "c:1", "d:1", "e:1", "f:0"]);
  assert.deepEqual(childrenOf(promoted, "a").map((n) => n.position), [0, 1, 2, 3]);
});

test("collapse to level", () => {
  const nodes = sample();
  const one = collapseToLevel(nodes, 1);
  assert.deepEqual(order(one), ["a:0", "f:0"]);
  const two = collapseToLevel(nodes, 2);
  assert.deepEqual(order(two), ["a:0", "b:1", "e:1", "f:0"]);
  const all = collapseToLevel(two, 0);
  assert.deepEqual(order(all), ["a:0", "b:1", "c:2", "d:2", "e:1", "f:0"]);
});

test("diff finds changed, new and deleted nodes", () => {
  const before = sample();
  const after = { ...before, a: { ...before.a, title: "renamed" }, g: node("g", null, 2) };
  delete after.f;
  const diff = diffNodes(before, after);
  assert.deepEqual(diff.upserts.map((n) => n.id).sort(), ["a", "g"]);
  assert.deepEqual(diff.deletes, ["f"]);
  assert.deepEqual(diffNodes(before, before), { upserts: [], deletes: [] });
});
