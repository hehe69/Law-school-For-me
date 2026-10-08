import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/db.ts";
import { createCourse, listOutlines } from "../src/lib/courses.ts";
import { loadNodes, upsertNodes } from "../src/lib/nodes.ts";
import { buildNodes } from "../src/lib/seed.ts";
import { addCapture, countUnfiled, createLink, createSource, deleteLink, linksForNode, listCaptures, markCaptureFiled, moveSubtreeToOutline, resolveUpload } from "../src/lib/attachments.ts";
import { UPLOADS_DIR } from "../src/lib/paths.ts";

test("move a subtree from the scratch outline into the full outline", () => {
  const db = openDatabase(":memory:");
  const course = createCourse(db, { title: "Torts" });
  const full = listOutlines(db, course.id).find((o) => o.kind === "full")!;
  const scratch = listOutlines(db, course.id).find((o) => o.kind === "scratch")!;
  const fullNodes = buildNodes(full.id, [{ type: "heading", title: "Negligence", children: [{ type: "rule", title: "Duty" }] }, { type: "heading", title: "Intentional torts" }]);
  const scratchNodes = buildNodes(scratch.id, [{ type: "heading", title: "Res ipsa", children: [{ type: "case", title: "Byrne v. Boadle" }] }, { type: "free", title: "loose" }]);
  upsertNodes(db, [...fullNodes, ...scratchNodes]);

  const negligence = fullNodes[0];
  const resIpsa = scratchNodes[0];
  const result = moveSubtreeToOutline(db, resIpsa.id, full.id, negligence.id, null);
  assert.equal(result.ok, true);
  const after = loadNodes(db, full.id);
  const moved = after.find((n) => n.id === resIpsa.id)!;
  assert.equal(moved.parentId, negligence.id);
  assert.equal(moved.position, 1, "goes after Duty");
  const child = after.find((n) => n.title === "Byrne v. Boadle")!;
  assert.equal(child.outlineId, full.id, "descendants follow");
  assert.equal(child.parentId, resIpsa.id);
  const left = loadNodes(db, scratch.id);
  assert.deepEqual(left.map((n) => [n.title, n.position]), [["loose", 0]], "scratch positions compacted");

  // Top level at a given position.
  const loose = scratchNodes.find((n) => n.title === "loose")!;
  const r2 = moveSubtreeToOutline(db, loose.id, full.id, null, 0);
  assert.equal(r2.ok, true);
  const top = loadNodes(db, full.id).filter((n) => n.parentId === null).sort((a, b) => a.position - b.position);
  assert.deepEqual(top.map((n) => n.title), ["loose", "Negligence", "Intentional torts"]);

  // Refusals.
  assert.equal(moveSubtreeToOutline(db, negligence.id, full.id, resIpsa.id, null).ok, false, "cannot move into own descendant");
  assert.equal(moveSubtreeToOutline(db, negligence.id, "nope", null, null).ok, false);
  assert.equal(moveSubtreeToOutline(db, negligence.id, scratch.id, fullNodes[1].id, null).ok, false, "parent must be in the target outline");
});

test("links, sources and captures", () => {
  const db = openDatabase(":memory:");
  const course = createCourse(db, { title: "Contracts" });
  const full = listOutlines(db, course.id).find((o) => o.kind === "full")!;
  const nodes = buildNodes(full.id, [{ type: "rule", title: "Offer" }, { type: "case", title: "Lucy v. Zehmer" }]);
  upsertNodes(db, nodes);
  const link = createLink(db, nodes[1].id, nodes[0].id, "applies", "note")!;
  assert.equal(link.kind, "applies");
  assert.equal(createLink(db, nodes[0].id, nodes[0].id, "see also"), null, "no self links");
  assert.equal(createLink(db, nodes[1].id, nodes[0].id, "bogus kind")!.kind, "see also", "unknown kinds fall back");
  assert.equal(linksForNode(db, nodes[0].id).length, 2);
  deleteLink(db, link.id);
  assert.equal(linksForNode(db, nodes[0].id).length, 1);

  const source = createSource(db, nodes[1].id, "casebook", "p. 12", "")!;
  assert.equal(source.url, null);
  assert.equal(createSource(db, "missing", "casebook", "x", null), null);

  const c = addCapture(db, course.id, "  remember consideration  ");
  assert.equal(c.text, "remember consideration");
  assert.equal(c.filed, false);
  assert.deepEqual(countUnfiled(db), { [course.id]: 1 });
  markCaptureFiled(db, c.id, nodes[0].id);
  assert.equal(listCaptures(db, course.id)[0].filedNodeId, nodes[0].id);
  assert.deepEqual(countUnfiled(db), {});
});

test("upload paths cannot escape the uploads folder", () => {
  assert.equal(resolveUpload(["..", "outlines.db"]), null);
  assert.equal(resolveUpload(["property", "..", "..", "etc", "passwd"]), null);
  assert.equal(resolveUpload([]), null);
  assert.ok(resolveUpload(["property", "a.png"])!.startsWith(UPLOADS_DIR));
});
