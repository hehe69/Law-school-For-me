import { test } from "node:test";
import assert from "node:assert/strict";
import { blocksToTree, countImported, htmlToBlocks, markdownToBlocks, parseMarkdownOutline } from "../src/lib/importers.ts";
import { noteToNodeContent, normaliseNoteRef, parseStudyNote } from "../src/lib/studyapp.ts";

const outline = (tree: ReturnType<typeof parseMarkdownOutline>, depth = 0): string[] =>
  tree.flatMap((n) => [`${"  ".repeat(depth)}${n.title}${n.body ? ` {${n.body.replace(/\n/g, "⏎")}}` : ""}`, ...outline(n.children, depth + 1)]);

test("markdown headings and list indentation become a tree", () => {
  const md = `Intro paragraph.

# Adverse Possession
Some text about it.
## Elements
- Actual
- Open and notorious
  - Mannillo: minor encroachments
    1. needs actual knowledge
- Hostile
## Tacking
A paragraph.
# Estates
* Fee simple
`;
  const tree = parseMarkdownOutline(md);
  assert.deepEqual(outline(tree), [
    "Introduction {Intro paragraph.}",
    "Adverse Possession {Some text about it.}",
    "  Elements",
    "    Actual",
    "    Open and notorious",
    "      Mannillo: minor encroachments",
    "        needs actual knowledge",
    "    Hostile",
    "  Tacking {A paragraph.}",
    "Estates",
    "  Fee simple",
  ]);
  assert.equal(countImported(tree), 11);
});

test("markdown titles lose emphasis; long items become a title plus body", () => {
  const long = "x".repeat(130);
  const blocks = markdownToBlocks(`- **Bold point**\n- ${long}`);
  const tree = blocksToTree(blocks);
  assert.equal(tree[0].title, "Bold point");
  assert.ok(tree[1].title.endsWith("…"));
  assert.equal(tree[1].body, long);
});

test("mammoth-style html becomes the same tree", () => {
  const html = `<h1>Negligence</h1><p>Duty, breach, causation, damages.</p><h2>Duty</h2><ul><li><strong>General</strong> duty of care<ul><li>Palsgraf &amp; foreseeability</li></ul></li><li>No duty to rescue</li></ul><p>Trailing note.</p>`;
  const blocks = htmlToBlocks(html);
  assert.deepEqual(blocks, [
    { kind: "heading", level: 1, text: "Negligence" },
    { kind: "para", text: "Duty, breach, causation, damages." },
    { kind: "heading", level: 2, text: "Duty" },
    { kind: "item", depth: 0, text: "**General** duty of care" },
    { kind: "item", depth: 1, text: "Palsgraf & foreseeability" },
    { kind: "item", depth: 0, text: "No duty to rescue" },
    { kind: "para", text: "Trailing note." },
  ]);
  assert.deepEqual(outline(blocksToTree(blocks)), [
    "Negligence {Duty, breach, causation, damages.}",
    "  Duty",
    "    General duty of care",
    "      Palsgraf & foreseeability",
    "    No duty to rescue {Trailing note.}",
  ]);
});

test("study-app notes parse into node content", () => {
  const rule = parseStudyNote("property/ap/notes/elements.md", `---
type: rule
name: Elements of AP
ruleStatement: Possession must be actual, open, exclusive, hostile, continuous.
elements:
  - Actual
  - text: Open and notorious
    definition: Visible to a diligent owner
exceptions:
  - text: Disability tolls
    element: 5
  - Government land
wisconsinVariation: 20 years.
wisconsinElement: 5
topics: [elements]
---
Body text.`)!;
  assert.equal(rule.kind, "rule");
  assert.equal(rule.title, "Elements of AP");
  const content = noteToNodeContent(rule);
  assert.equal(content.type, "rule");
  assert.deepEqual(content.fields.elements, [
    { text: "Actual", definition: "" },
    { text: "Open and notorious", definition: "Visible to a diligent owner" },
  ]);
  assert.deepEqual(content.fields.exceptions, [
    { text: "Disability tolls", element: 5 },
    { text: "Government land", element: null },
  ]);
  assert.equal(content.fields.localVariation, "20 years.\n\n(Changes element 5.)");
  assert.deepEqual(content.tags, ["elements"]);
  assert.equal(content.body, "Body text.");

  const caseNote = parseStudyNote("property/ap/notes/lutz.md", `---
type: case
name: Van Valkenburgh v. Lutz
facts: Garden on a lot.
issue: Enough for AP?
rule: Must cultivate.
holding: No.
whyItMatters: Strict reading.
appliesRule: ap/notes/elements.md
---`)!;
  assert.equal(caseNote.kind, "case");
  const c = noteToNodeContent(caseNote);
  assert.equal(c.type, "case");
  assert.equal(c.fields.holding, "No.");
  assert.equal(c.body, "**Issue.** Enough for AP?\n\n**Rule.** Must cultivate.");
  assert.equal(normaliseNoteRef("ap/notes/elements.md", "property"), "property/ap/notes/elements.md");
  assert.equal(normaliseNoteRef("content/property/ap/notes/elements.md", "property"), "property/ap/notes/elements.md");

  const classNote = parseStudyNote("property/ap/notes/2026-09-15-class.md", `---
type: class
date: 2026-09-15
topic: Tacking and privity
professorPoint: Privity means a voluntary transfer.
modifiesRule: ap/notes/elements.md
---`)!;
  assert.equal(classNote.kind, "class");
  const k = noteToNodeContent(classNote);
  assert.equal(k.type, "professor-note");
  assert.equal(k.fields.date, "2026-09-15");
  assert.equal(k.title, "Tacking and privity");

  assert.equal(parseStudyNote("x.md", "---\ntype: other\n---"), null);
  assert.equal(parseStudyNote("x.md", "no frontmatter"), null);
});
