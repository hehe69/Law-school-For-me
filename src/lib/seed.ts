// First-run sample data: one Property course with a three-level outline that uses every node type, so the
// editor has something to show and every field form can be seen. Everything is marked "(sample)".

import fs from "node:fs";
import path from "node:path";
import type { Course, NodeStatus, NodeType, OutlineNode } from "./types.ts";
import { nowIso, type Db } from "./db.ts";
import { createCourse, listCourses, listOutlines } from "./courses.ts";
import { upsertNodes } from "./nodes.ts";
import { newId } from "./ids.ts";
import { emptyFields } from "./fields.ts";
import { UPLOADS_DIR } from "./paths.ts";

type Spec = {
  type: NodeType;
  title: string;
  status?: NodeStatus;
  body?: string;
  fields?: Record<string, unknown>;
  tags?: string[];
  children?: Spec[];
  /** Set to remember the node id under this key, for links between seeded nodes */
  ref?: string;
};

const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="260" viewBox="0 0 420 260">
  <rect width="420" height="260" fill="#f8f7f2"/>
  <rect x="30" y="30" width="360" height="200" fill="none" stroke="#333" stroke-width="2"/>
  <polygon points="30,230 200,30 390,230" fill="#cfe3c4" stroke="#2f6b2f" stroke-width="2"/>
  <text x="210" y="150" font-family="Helvetica, Arial, sans-serif" font-size="14" text-anchor="middle" fill="#2f6b2f">triangular lot used by Lutz</text>
  <text x="60" y="55" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#333">record owner's parcel</text>
  <text x="210" y="250" font-family="Helvetica, Arial, sans-serif" font-size="11" text-anchor="middle" fill="#666">sample sketch — replace with your own</text>
</svg>
`;

function sample(): Spec[] {
  return [
    {
      type: "heading",
      title: "Adverse Possession",
      status: "final",
      tags: ["elements"],
      children: [
        {
          type: "rule",
          title: "Elements of adverse possession",
          status: "final",
          ref: "rule",
          tags: ["elements", "Wisconsin statute"],
          fields: {
            ruleStatement:
              "A possessor acquires title if possession is (1) actual, (2) open and notorious, (3) exclusive, (4) hostile and under a claim of right, and (5) continuous for the statutory period. (sample)",
            elements: [
              { text: "Actual possession", definition: "Physical use of the land as an owner would, given its nature." },
              { text: "Open and notorious", definition: "Visible enough to put a reasonably attentive owner on notice." },
              { text: "Exclusive", definition: "Not shared with the true owner or the public." },
              { text: "Hostile / claim of right", definition: "Without the owner's permission; the possessor's state of mind is irrelevant under the objective test." },
              { text: "Continuous for the statutory period", definition: "As continuous as the nature of the land allows; tacking fills gaps between possessors in privity." },
            ],
            exceptions: [
              { text: "Disability of the true owner tolls the statute", element: 5 },
              { text: "Government land is generally not subject to adverse possession", element: null },
            ],
            localVariation: "Wis. Stat. § 893.25: 20 years without color of title; § 893.26: 10 years with color of title; § 893.27: 7 years with color of title and payment of taxes. Verify against the statute. (sample)",
            majorityPosition: "Most states use the objective test for hostility; a minority (Maine rule) requires an intent to claim. The Restatement follows the objective view.",
            burden: "The adverse possessor, by clear and convincing evidence in many states.",
          },
          children: [
            {
              type: "element",
              title: "Actual possession",
              status: "drafted",
              tags: ["elements"],
              fields: {
                text: "Physical use of the land consistent with its character.",
                definition: "Use of the kind an average owner would make of that land: cultivating, fencing, building.",
                factors: ["Cultivation or improvement", "Enclosure", "Residence", "Nature and location of the land"],
                satisfiedWhen: "The possessor's acts would signal ownership to a neighbour.",
              },
            },
            {
              type: "element",
              title: "Open and notorious",
              status: "drafted",
              tags: ["elements"],
              fields: {
                text: "Possession visible enough that a diligent owner would discover it.",
                definition: "Constructive notice to the record owner.",
                factors: ["Visible structures", "Regular use", "Whether a minor encroachment needs actual knowledge (Mannillo)"],
                satisfiedWhen: "A reasonable inspection would reveal the use.",
              },
            },
            {
              type: "element",
              title: "Hostile / claim of right",
              status: "skeleton",
              tags: ["elements"],
              children: [
                {
                  type: "exception",
                  title: "Permission defeats hostility",
                  status: "drafted",
                  fields: {
                    text: "Possession that began with the owner's permission is not hostile until the possessor clearly repudiates the permission.",
                    defeatsElement: "4 (hostile / claim of right)",
                    source: "Casebook p. 143 (sample)",
                  },
                },
              ],
            },
            {
              type: "case",
              title: "Van Valkenburgh v. Lutz",
              status: "drafted",
              tags: ["elements"],
              fields: {
                courtYear: "N.Y. 1952",
                facts: "Lutz used a triangular lot he did not own for a garden and a shack for many years; the Van Valkenburghs bought the lot and demanded he leave.",
                holding: "No adverse possession: the use was too slight to be actual possession under the statute, and Lutz had conceded the true owner's title.",
                whyHere: "Shows how strictly courts can read 'actual' and 'hostile', and how a claimant's own admissions defeat a claim.",
                professorUse: "Used to contrast the objective test with the dissent's reading of the facts; he said the dissent is 'closer to Wisconsin'. (sample)",
                disposition: "Reversed; judgment for the record owners.",
              },
            },
            {
              type: "statute",
              title: "Wis. Stat. § 893.25",
              status: "drafted",
              tags: ["Wisconsin statute"],
              fields: {
                cite: "Wis. Stat. § 893.25",
                quotedText: "An action for the recovery or the possession of real estate … shall be commenced within 20 years after the cause of action accrues … (sample excerpt; check the current text)",
                changes: "Sets the 20-year period for possession without color of title and defines what counts as possession.",
                effectiveNote: "Check for amendments before the exam.",
              },
            },
            {
              type: "hypo",
              title: "The garden strip",
              status: "drafted",
              fields: {
                facts: "A plants vegetables on a two-metre strip of B's lot every summer for 22 years, believing it to be hers. B lives abroad and never visits.",
                question: "Has A acquired the strip by adverse possession in Wisconsin?",
                answer: "Probably yes: actual (cultivation), open (visible rows), exclusive, hostile under the objective test (mistake does not matter), and continuous for over 20 years; seasonal use counts where that is the land's normal use. (sample model answer)",
                turnsOn: "Whether seasonal cultivation is 'continuous', and whether B's absence changes 'open and notorious' (it does not: the test is constructive notice).",
              },
            },
            {
              type: "policy",
              title: "Reward productive use",
              status: "skeleton",
              fields: {
                argument: "Land should go to those who use it; the doctrine clears stale titles and rewards reliance.",
                whoMakesIt: "Holmes; the majority in Lutz dissent",
                counter: "It rewards trespass and punishes absent but legitimate owners.",
              },
            },
            {
              type: "professor-note",
              title: "Tacking and privity",
              status: "drafted",
              tags: ["tacking"],
              fields: {
                date: "2026-09-15",
                said: "Privity for tacking means a voluntary transfer between possessors, not a mere sequence of squatters. He said this will be on the exam. (sample)",
                modifiesRule: "@rule",
              },
            },
          ],
        },
        {
          type: "heading",
          title: "Tacking",
          status: "skeleton",
          tags: ["tacking"],
          children: [
            {
              type: "definition",
              title: "Privity",
              status: "drafted",
              tags: ["tacking"],
              fields: { definition: "A voluntary transfer of possession from one adverse possessor to the next, by deed, will, or oral gift, allowing their periods to be added together." },
            },
            {
              type: "flag",
              title: "Ask whether Wisconsin requires privity for tacking",
              status: "drafted",
              fields: { text: "Ask about this in office hours", color: "red" },
            },
            {
              type: "table",
              title: "Color of title vs. none (Wisconsin)",
              status: "drafted",
              fields: {
                grid: {
                  columns: ["", "No color of title", "Color of title", "Color of title + taxes"],
                  rows: [
                    ["Statute", "§ 893.25", "§ 893.26", "§ 893.27"],
                    ["Period", "20 years", "10 years", "7 years"],
                    ["Extent", "Land actually occupied", "Whole parcel described", "Whole parcel described"],
                  ],
                },
              },
            },
            {
              type: "image",
              title: "Sketch of the disputed lot",
              status: "drafted",
              ref: "image",
              fields: { caption: "The triangular strip Lutz gardened (sample sketch)" },
            },
            {
              type: "free",
              title: "Loose notes",
              status: "drafted",
              body: "Things to sort later:\n\n- compare the **Maine rule** with the objective test\n- find the Wisconsin case on seasonal use\n- does a tenant's possession count for the landlord?",
            },
          ],
        },
      ],
    },
    {
      type: "heading",
      title: "Estates in Land",
      status: "skeleton",
      children: [
        { type: "heading", title: "Fee simple absolute", status: "empty" },
        { type: "rule", title: "Life estate", status: "empty" },
        { type: "heading", title: "Defeasible fees", status: "empty" },
      ],
    },
    { type: "heading", title: "Landlord and Tenant", status: "empty" },
  ];
}

/** Build nodes from a spec tree. Field values written as "@ref" are replaced with the id of the node tagged ref. */
export function buildNodes(outlineId: string, specs: Spec[], now = nowIso()): OutlineNode[] {
  const nodes: OutlineNode[] = [];
  const refs: Record<string, string> = {};
  const pending: { node: OutlineNode; key: string; ref: string }[] = [];
  const walk = (list: Spec[], parentId: string | null) => {
    list.forEach((spec, i) => {
      const id = newId();
      if (spec.ref) refs[spec.ref] = id;
      const fields = { ...emptyFields(spec.type), ...(spec.fields ?? {}) };
      const node: OutlineNode = {
        id,
        outlineId,
        parentId,
        position: i,
        type: spec.type,
        status: spec.status ?? "empty",
        title: spec.title,
        body: spec.body ?? "",
        fields,
        tags: spec.tags ?? [],
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
      };
      for (const [key, value] of Object.entries(fields)) {
        if (typeof value === "string" && value.startsWith("@")) pending.push({ node, key, ref: value.slice(1) });
      }
      nodes.push(node);
      if (spec.children) walk(spec.children, id);
    });
  };
  walk(specs, null);
  for (const p of pending) p.node.fields[p.key] = refs[p.ref] ?? null;
  return nodes;
}

export function createSampleCourse(db: Db): Course {
  const course = createCourse(db, {
    title: "Property (sample)",
    examDate: null,
    examFormat: "Sample course. Three hours, open book, two essays and twenty multiple choice. Delete this course once you have your own.",
    pageLimit: 30,
    syllabusTopics: ["elements", "tacking", "Wisconsin statute", "estates", "landlord and tenant"],
  });
  const outlines = listOutlines(db, course.id);
  const full = outlines.find((o) => o.kind === "full")!;
  const scratch = outlines.find((o) => o.kind === "scratch")!;
  const now = nowIso();
  const nodes = buildNodes(full.id, sample(), now);
  upsertNodes(db, nodes);

  // The image node gets a real file under uploads/<course>/ so the image pipeline has something to show.
  const imageNode = nodes.find((n) => n.type === "image");
  if (imageNode) {
    const dir = path.join(UPLOADS_DIR, course.slug);
    fs.mkdirSync(dir, { recursive: true });
    const file = "sample-lot.svg";
    fs.writeFileSync(path.join(dir, file), SAMPLE_SVG, "utf8");
    db.prepare("INSERT INTO images (id, node_id, file_path, caption, width_hint, position, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)").run(
      newId(),
      imageNode.id,
      `${course.slug}/${file}`,
      "The triangular strip Lutz gardened (sample sketch)",
      360,
      now,
    );
  }

  // A link and a source, so the panel has examples (phase 2 shows them).
  const rule = nodes.find((n) => n.type === "rule" && n.title.startsWith("Elements"));
  const caseNode = nodes.find((n) => n.type === "case");
  if (rule && caseNode) {
    db.prepare("INSERT INTO links (id, from_node, to_node, kind, note, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(newId(), caseNode.id, rule.id, "applies", "Lutz applies the elements strictly", now);
    db.prepare("INSERT INTO sources (id, node_id, kind, reference, url, position) VALUES (?, ?, ?, ?, ?, 0)").run(newId(), caseNode.id, "casebook", "Dukeminier, Property, p. 123 (sample)", null);
    db.prepare("INSERT INTO sources (id, node_id, kind, reference, url, position) VALUES (?, ?, ?, ?, ?, 0)").run(newId(), rule.id, "transcript", "Class of 2026-09-10, 14:05 (sample)", null);
  }

  upsertNodes(
    db,
    buildNodes(
      scratch.id,
      [
        { type: "free", title: "Covenants running with the land: where does this go?", status: "empty" },
        { type: "case", title: "Mannillo v. Gorski", status: "skeleton", fields: { courtYear: "N.J. 1969", holding: "Minor encroachments need actual knowledge to be open and notorious." } },
      ],
      now,
    ),
  );
  return course;
}

/** Seed the sample course when the database has no courses at all. Returns true when it seeded. */
export function seedIfEmpty(db: Db): boolean {
  if (listCourses(db).length > 0) return false;
  createSampleCourse(db);
  return true;
}
