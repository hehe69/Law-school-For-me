import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../src/lib/db.ts";
import { createCourse, listOutlines, updateCourse } from "../src/lib/courses.ts";
import { loadNodes, loadSources, upsertNodes } from "../src/lib/nodes.ts";
import { buildNodes } from "../src/lib/seed.ts";
import { createSource } from "../src/lib/attachments.ts";
import type { NodeMap } from "../src/lib/types.ts";
import { applySm2, NEW_CARD } from "../src/lib/sm2.ts";
import { cardFaces, dueCards, reviewCard, reviewSummary } from "../src/lib/cards.ts";
import { drillTargets, masteryForOutline, masteryOf, recordDrill } from "../src/lib/drills.ts";
import { ensureDailySnapshot, listSnapshots, takeSnapshot, wordCountOf } from "../src/lib/snapshots.ts";
import { countStatuses, estimatePages, sectionProgress } from "../src/lib/progress.ts";
import { findGaps } from "../src/lib/gaps.ts";

function setup() {
  const db = openDatabase(":memory:");
  const course = createCourse(db, { title: "Torts", syllabusTopics: ["duty", "breach", "damages"] });
  const full = listOutlines(db, course.id).find((o) => o.kind === "full")!;
  const nodes = buildNodes(full.id, [
    {
      type: "heading",
      title: "Negligence",
      status: "drafted",
      tags: ["duty"],
      children: [
        { type: "rule", title: "Duty", status: "final", fields: { ruleStatement: "A duty of reasonable care is owed to foreseeable plaintiffs.", elements: [{ text: "Foreseeable plaintiff", definition: "Within the zone of danger" }] } },
        { type: "rule", title: "Breach", status: "drafted", tags: ["breach"] },
        { type: "hypo", title: "Fireworks", fields: { facts: "Palsgraf.", question: "Duty?", answer: "" } },
        { type: "hypo", title: "Answered", fields: { facts: "x", question: "y", answer: "yes" } },
        { type: "case", title: "Palsgraf", fields: { holding: "No duty." } },
      ],
    },
    { type: "heading", title: "Empty heading", status: "empty" },
  ]);
  upsertNodes(db, nodes);
  const map: NodeMap = {};
  for (const n of nodes) map[n.id] = n;
  return { db, course, full, nodes, map };
}

test("SM-2 matches the study app's steps", () => {
  const s1 = applySm2(NEW_CARD, 3);
  assert.equal(s1.intervalDays, 1);
  const s2 = applySm2(s1, 3);
  assert.equal(s2.intervalDays, 6);
  const s3 = applySm2(s2, 4);
  assert.ok(s3.intervalDays > 6);
  const again = applySm2(s3, 1);
  assert.equal(again.intervalDays, 0);
  assert.equal(again.repetitions, 0);
  assert.ok(again.ease < s3.ease && again.ease >= 1.3);
});

test("flashcards: faces, due queue, review", () => {
  const { db, course, nodes } = setup();
  const duty = nodes.find((n) => n.title === "Duty")!;
  upsertNodes(db, [{ ...duty, flashcard: true }]);
  const faces = cardFaces({ ...duty, flashcard: true });
  assert.equal(faces.front, "Duty");
  assert.equal(faces.back[0], "A duty of reasonable care is owed to foreseeable plaintiffs.");
  assert.equal(faces.back[1], "1. Foreseeable plaintiff — Within the zone of danger");
  let due = dueCards(db, course.id, "2026-10-08");
  assert.equal(due.length, 1, "a new card is due");
  assert.deepEqual(reviewSummary(db, course.id, "2026-10-08"), { due: 1, newCards: 1, total: 1, reviewedToday: 0 });
  const state = reviewCard(db, duty.id, 3, "2026-10-08");
  assert.equal(state.dueOn, "2026-10-09");
  due = dueCards(db, course.id, "2026-10-08");
  assert.equal(due.length, 0, "reviewed card leaves today's queue");
  assert.equal(dueCards(db, course.id, "2026-10-09").length, 1, "and is back tomorrow");
  // Cards off attack outlines and non-flashcard nodes are ignored.
  assert.equal(dueCards(db, undefined, "2026-10-09").length, 1);
});

test("drills: targets, results and mastery colours", () => {
  const { db, full, nodes, map } = setup();
  const neg = nodes.find((n) => n.title === "Negligence")!;
  assert.deepEqual(
    drillTargets(map, neg.id, "hypo").map((n) => n.title),
    ["Fireworks", "Answered"],
  );
  assert.deepEqual(
    drillTargets(map, null, "rule").map((n) => n.title),
    ["Duty", "Breach"],
  );
  const duty = nodes.find((n) => n.title === "Duty")!;
  recordDrill(db, duty.id, "recite", true);
  assert.equal(masteryForOutline(db, full.id).hasOwnProperty(duty.id), true);
  assert.equal(masteryForOutline(db, full.id)[duty.id].mastery, "shaky", "one right answer is not yet cold");
  recordDrill(db, duty.id, "recite", true);
  assert.equal(masteryForOutline(db, full.id)[duty.id].mastery, "cold");
  recordDrill(db, duty.id, "recite", false);
  assert.equal(masteryForOutline(db, full.id)[duty.id].mastery, "shaky");
  assert.equal(masteryOf([]), null);
  assert.equal(masteryOf([{ correct: true }, { correct: true }, { correct: true }, { correct: false }]), "cold", "only the last three count");
});

test("snapshots and daily automation", () => {
  const { db, full } = setup();
  const nodes = loadNodes(db, full.id);
  const words = wordCountOf(nodes);
  assert.ok(words > 10);
  const first = ensureDailySnapshot(db, full.id, new Date("2026-10-08T10:00:00Z"))!;
  assert.ok(first && first.automatic && first.wordCount === words, "first open takes a snapshot");
  assert.equal(ensureDailySnapshot(db, full.id, new Date("2026-10-08T12:00:00Z")), null, "not again the same day");
  const manual = takeSnapshot(db, full.id, "before exam")!;
  assert.equal(manual.label, "before exam");
  assert.equal(listSnapshots(db, full.id).length, 2);
});

test("progress counts, stale sections, page estimate", () => {
  const { map, nodes } = setup();
  const counts = countStatuses(nodes);
  assert.equal(counts.total, 7);
  assert.equal(counts.final, 1);
  assert.equal(counts.empty, 4);
  const sections = sectionProgress(map, new Date(Date.now() + 20 * 86400000));
  assert.equal(sections.length, 2);
  assert.equal(sections[0].counts.total, 6);
  assert.ok(sections[0].staleDays >= 20, "stale days measured from the newest edit");
  assert.ok(estimatePages(nodes) > 0 && estimatePages(nodes) < 2);
});

test("gaps", () => {
  const { db, course, full, nodes, map } = setup();
  updateCourse(db, course.id, { syllabusTopics: ["duty", "breach", "damages"] });
  const duty = nodes.find((n) => n.title === "Duty")!;
  createSource(db, duty.id, "casebook", "p. 1", null);
  const outline = listOutlines(db, course.id).find((o) => o.id === full.id)!;
  const gaps = findGaps({ ...course, syllabusTopics: ["duty", "breach", "damages"] }, [{ outline, nodes: map, sources: loadSources(db, full.id) }]);
  assert.deepEqual(gaps.topicsWithoutNode, ["damages"]);
  assert.deepEqual(gaps.rulesWithoutElements.map((g) => g.node.title), ["Breach"]);
  assert.deepEqual(gaps.headingsWithoutChildren.map((g) => g.node.title), ["Empty heading"]);
  assert.deepEqual(gaps.hyposWithoutAnswer.map((g) => g.node.title), ["Fireworks"]);
  assert.deepEqual(gaps.nodesWithoutSource.map((g) => g.node.title).sort(), ["Breach", "Palsgraf"]);
});
