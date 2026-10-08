import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/db.ts";
import { createCourse, listOutlines, getOutline, updateOutline } from "../src/lib/courses.ts";
import { applySync, loadNodes } from "../src/lib/nodes.ts";
import { buildNodes } from "../src/lib/seed.ts";

test("courses get a full and a scratch outline; sync upserts and deletes", () => {
  const db = openDatabase(":memory:");
  const course = createCourse(db, { title: "Contracts" });
  assert.equal(course.slug, "contracts");
  const outlines = listOutlines(db, course.id);
  assert.deepEqual(outlines.map((o) => o.kind).sort(), ["full", "scratch"]);
  const full = outlines.find((o) => o.kind === "full")!;
  assert.equal(full.isDefault, true);

  const nodes = buildNodes(full.id, [
    { type: "heading", title: "Offer", children: [{ type: "rule", title: "Objective theory", fields: { ruleStatement: "Words and conduct judged objectively." } }] },
    { type: "heading", title: "Acceptance" },
  ]);
  // Children before parents in the batch: the deferred foreign keys must allow it.
  const result = applySync(db, full.id, { upserts: [...nodes].reverse(), deletes: [] });
  assert.equal(result?.upserted, 3);
  const loaded = loadNodes(db, full.id);
  assert.equal(loaded.length, 3);
  const rule = loaded.find((n) => n.type === "rule")!;
  assert.equal(rule.fields.ruleStatement, "Words and conduct judged objectively.");
  assert.equal(rule.parentId, nodes[0].id);

  // Deleting the parent removes the child through the cascade.
  const del = applySync(db, full.id, { upserts: [], deletes: [nodes[0].id] });
  assert.equal(del?.deleted, 1);
  assert.deepEqual(
    loadNodes(db, full.id).map((n) => n.title),
    ["Acceptance"],
  );

  // A node sent for another outline cannot be hijacked into this one.
  const other = createCourse(db, { title: "Torts" });
  const otherFull = listOutlines(db, other.id).find((o) => o.kind === "full")!;
  const stray = { ...nodes[2], outlineId: otherFull.id };
  applySync(db, otherFull.id, { upserts: [stray], deletes: [] });
  assert.equal(loadNodes(db, full.id).length, 1, "the row stays in its own outline");
  assert.equal(loadNodes(db, otherFull.id).length, 0, "an update aimed at a foreign row is ignored");

  // Unknown outline.
  assert.equal(applySync(db, "nope", { upserts: [], deletes: [] }), null);

  // Outline settings.
  updateOutline(db, full.id, { numbering: "decimal", options: { skeleton: true } });
  const updated = getOutline(db, full.id)!;
  assert.equal(updated.numbering, "decimal");
  assert.equal(updated.options.skeleton, true);
  assert.equal(createCourse(db, { title: "Contracts" }).slug, "contracts-2");
});
