import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/db.ts";
import { createCourse, listOutlines } from "../src/lib/courses.ts";
import { loadNodes, upsertNodes } from "../src/lib/nodes.ts";
import { buildNodes } from "../src/lib/seed.ts";
import { generateAttack, regenerateAttack, selectSources } from "../src/lib/attack.ts";
import type { NodeMap } from "../src/lib/types.ts";
import { flatten } from "../src/lib/tree.ts";
import { buildFlow, layoutRule, wrapText } from "../src/lib/flowchart.ts";
import { markTerms, termsFromNodes } from "../src/lib/glossary.ts";

function setup() {
  const db = openDatabase(":memory:");
  const course = createCourse(db, { title: "Property" });
  const full = listOutlines(db, course.id).find((o) => o.kind === "full")!;
  const nodes = buildNodes(full.id, [
    {
      type: "heading",
      title: "Adverse Possession",
      status: "final",
      tags: ["ap"],
      children: [
        {
          type: "rule",
          title: "Elements",
          status: "final",
          tags: ["ap"],
          fields: { ruleStatement: "Actual, open, exclusive, hostile, continuous.", elements: [{ text: "Actual", definition: "" }, { text: "Hostile", definition: "No permission" }], exceptions: [{ text: "Permission", element: 2 }], localVariation: "20 years.\n\n(Changes element 2.)" },
          children: [
            { type: "element", title: "Hostile", status: "drafted", fields: { text: "Hostile", definition: "" }, children: [{ type: "hypo", title: "Garden strip", fields: { question: "Hostile?" } }] },
            { type: "case", title: "Lutz", status: "drafted", fields: { holding: "No." } },
            { type: "hypo", title: "Lease", fields: { question: "Does a tenant count?", turnsOn: "whether Actual possession includes a tenant" } },
          ],
        },
        { type: "heading", title: "Tacking", status: "skeleton", children: [{ type: "definition", title: "Privity", status: "final", fields: { definition: "A voluntary transfer." } }] },
      ],
    },
    { type: "heading", title: "Estates", status: "empty", children: [{ type: "heading", title: "Fee simple", status: "empty" }] },
  ]);
  upsertNodes(db, nodes);
  const map: NodeMap = {};
  for (const n of nodes) map[n.id] = n;
  return { db, course, full, nodes, map };
}

test("selectSources honours depth, tags and status", () => {
  const { map } = setup();
  const titles = (opts: Parameters<typeof selectSources>[1]) => selectSources(map, opts).map((n) => n.title);
  assert.deepEqual(titles({ mode: "headings", maxDepth: null, tags: [], onlyFinal: false }), ["Adverse Possession", "Elements", "Hostile", "Garden strip", "Lutz", "Lease", "Tacking", "Privity", "Estates", "Fee simple"]);
  assert.deepEqual(titles({ mode: "headings", maxDepth: 2, tags: [], onlyFinal: false }), ["Adverse Possession", "Elements", "Tacking", "Estates", "Fee simple"]);
  assert.deepEqual(titles({ mode: "headings", maxDepth: null, tags: ["AP"], onlyFinal: false }), ["Adverse Possession", "Elements"]);
  assert.deepEqual(titles({ mode: "headings", maxDepth: null, tags: [], onlyFinal: true }), ["Adverse Possession", "Elements", "Tacking", "Privity"]);
});

test("generate and regenerate an attack outline", () => {
  const { db, full, nodes } = setup();
  const attack = generateAttack(db, full.id, { mode: "headings-rules", maxDepth: 2, tags: [], onlyFinal: false }, "Attack")!;
  assert.equal(attack.kind, "attack");
  assert.equal(attack.sourceOutlineId, full.id);
  const lines = loadNodes(db, attack.id);
  const amap: NodeMap = {};
  for (const l of lines) amap[l.id] = l;
  assert.deepEqual(
    flatten(amap, false).map((r) => `${r.depth}:${r.node.title}`),
    ["0:Adverse Possession", "1:Elements", "1:Tacking", "0:Estates", "1:Fee simple"],
  );
  const ruleLine = lines.find((l) => l.title === "Elements")!;
  assert.equal(ruleLine.fields.ruleStatement, "Actual, open, exclusive, hostile, continuous.");
  assert.equal(ruleLine.sourceNodeId, nodes.find((n) => n.title === "Elements")!.id);

  // Edit one line, change its source: the edit is kept and the line flagged. Change another source whose line
  // is untouched: the line is rewritten. Add a new source: a line appears. Delete a source: flagged removed.
  upsertNodes(db, [{ ...ruleLine, title: "Elements (my wording)" }]);
  const srcRule = nodes.find((n) => n.title === "Elements")!;
  const srcTacking = nodes.find((n) => n.title === "Tacking")!;
  const srcEstates = nodes.find((n) => n.title === "Estates")!;
  upsertNodes(db, [
    { ...srcRule, fields: { ...srcRule.fields, ruleStatement: "New statement." } },
    { ...srcTacking, title: "Tacking and privity" },
  ]);
  const fresh = buildNodes(full.id, [{ type: "heading", title: "Future interests" }])[0];
  upsertNodes(db, [{ ...fresh, position: 2 }]);
  db.prepare("DELETE FROM nodes WHERE id = ?").run(srcEstates.id);

  const result = regenerateAttack(db, attack.id)!;
  // Deleting "Estates" cascades to "Fee simple", so two lines lose their source.
  assert.deepEqual(result, { added: 1, updated: 1, flaggedChanged: 1, flaggedRemoved: 2, kept: 1 });
  const after = loadNodes(db, attack.id);
  const rule2 = after.find((l) => l.sourceNodeId === srcRule.id)!;
  assert.equal(rule2.title, "Elements (my wording)", "edited line keeps its edit");
  assert.equal(rule2.fields.attackFlag, "source changed");
  const tacking2 = after.find((l) => l.sourceNodeId === srcTacking.id)!;
  assert.equal(tacking2.title, "Tacking and privity", "untouched line follows the source");
  assert.equal(tacking2.fields.attackFlag, undefined);
  assert.ok(after.some((l) => l.sourceNodeId === fresh.id && l.parentId === null), "new top-level source added");
  const estates2 = after.find((l) => l.sourceNodeId === srcEstates.id)!;
  assert.equal(estates2.fields.attackFlag, "source removed");
  // Regenerating again changes nothing further.
  const again = regenerateAttack(db, attack.id)!;
  assert.deepEqual(again, { added: 0, updated: 0, flaggedChanged: 1, flaggedRemoved: 0, kept: 5 });
});

test("flowchart model and layout", () => {
  const { map, nodes } = setup();
  const root = nodes.find((n) => n.title === "Adverse Possession")!;
  const rules = buildFlow(map, [], root.id);
  assert.equal(rules.length, 1);
  const r = rules[0];
  assert.deepEqual(r.elements.map((e) => e.text), ["Actual", "Hostile"]);
  assert.deepEqual(r.elements[1].exceptions, ["Permission"]);
  assert.deepEqual(r.elements[1].hypos.map((h) => h.title), ["Garden strip"], "a hypo under the element node hangs off it");
  assert.deepEqual(r.elements[0].hypos.map((h) => h.title), ["Lease"], "a hypo whose 'turns on' names the element hangs off it");
  assert.equal(r.variationElement, 2);
  assert.equal(r.variation, "20 years.");
  const layout = layoutRule(r);
  assert.ok(layout.boxes.some((b) => b.kind === "variation"));
  assert.ok(layout.boxes.some((b) => b.kind === "hypo"));
  assert.ok(layout.width > 500 && layout.height > 200);
  assert.ok(layout.boxes.every((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= layout.width && b.y + b.h <= layout.height));
  // 80px wide leaves 9 characters per line.
  assert.deepEqual(wrapText("one two three four five six seven", 80), ["one two", "three", "four five", "six seven"]);
});

test("glossary terms and tooltip marking", () => {
  const { nodes } = setup();
  const terms = termsFromNodes(nodes);
  assert.deepEqual(
    terms.map((t) => t.term),
    ["Privity"],
  );
  assert.equal(markTerms("Tacking needs privity between possessors; see [privity](x) and `privity`.", terms), "Tacking needs [privity](#term:0) between possessors; see [privity](x) and `privity`.");
  assert.equal(markTerms("No privity here", terms, terms[0].nodeId), "No privity here", "the definition itself is not marked");
});
