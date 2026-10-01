import { Document, Packer, Paragraph } from "docx";
import { getDb, getMeta, setMeta } from "./db";
import { makePlaceholderPdf } from "./pdf";
import { createPaper, addOpenQuestion, updateMilestone, listMilestones } from "./queries/papers";
import { createSection, updateSection } from "./queries/outline";
import { attachPdf, createSource } from "./queries/sources";
import { createExtract } from "./queries/extracts";
import { createSectionSourceLink, addManualLogEntry, updateLogEntry, listCitationLog } from "./queries/citations";
import { addDraft } from "./queries/drafts";

// One placeholder paper so every page shows something. Runs once (tracked in meta.seeded).
export async function seedIfEmpty(force = false) {
  const db = getDb();
  if (!force && getMeta("seeded")) return false;
  const count = (db.prepare("SELECT COUNT(*) n FROM papers").get() as { n: number }).n;
  if (!force && count > 0) {
    setMeta("seeded", "1");
    return false;
  }
  await seed();
  setMeta("seeded", "1");
  return true;
}

function plusDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function seed() {
  const paper = createPaper({
    title: "Placeholder Paper: Algorithmic Pricing and Tacit Collusion",
    venue: "Antitrust Law Seminar",
    word_limit: 8000,
    thesis:
      "Section 1 of the Sherman Act, as currently interpreted, cannot reach tacit collusion produced by independently adopted pricing algorithms, and a narrow 'facilitating practices' theory is the least disruptive fix.",
  });
  const p = paper.id;

  // Milestones: two with due dates.
  const ms = listMilestones(p);
  updateMilestone(ms[0].id, { done: true, due_date: plusDays(-14) });
  updateMilestone(ms[1].id, { due_date: plusDays(10) });
  updateMilestone(ms[3].id, { due_date: plusDays(45) });

  // Outline: 3 levels, with a counterargument/response pair.
  const intro = createSection({ paper_id: p, parent_id: null, heading: "Introduction", claim: "Algorithmic pricing creates a gap in Section 1 doctrine.", role: "background" });
  const doctrine = createSection({ paper_id: p, parent_id: null, heading: "The agreement requirement", claim: "Section 1 requires a 'meeting of the minds', which independent algorithms lack." });
  const plusFactors = createSection({ paper_id: p, parent_id: doctrine.id, heading: "Plus factors after Twombly", claim: "Parallel conduct plus 'plus factors' is the only route to an inferred agreement." });
  createSection({ paper_id: p, parent_id: plusFactors.id, heading: "Signalling as a plus factor", claim: "Public price announcements can be a plus factor; algorithmic signalling is harder to characterise." });
  createSection({ paper_id: p, parent_id: doctrine.id, heading: "Conscious parallelism", claim: "Conscious parallelism is lawful on its own under Theatre Enterprises." });
  const algos = createSection({ paper_id: p, parent_id: null, heading: "How pricing algorithms converge", claim: "Reinforcement learners can reach supra-competitive prices without communicating.", role: "background" });
  createSection({ paper_id: p, parent_id: algos.id, heading: "Experimental evidence", claim: "Simulation studies show convergence to collusive prices." });
  const counter = createSection({
    paper_id: p,
    parent_id: null,
    heading: "Objection: the hub-and-spoke theory already suffices",
    claim: "A shared vendor algorithm is a hub, so existing doctrine reaches the problem.",
    role: "counterargument",
  });
  const response = createSection({
    paper_id: p,
    parent_id: null,
    heading: "Reply: hub-and-spoke needs a rim",
    claim: "Without a horizontal agreement among the spokes, the hub-and-spoke theory fails.",
    role: "response",
    responds_to: counter.id,
  });
  updateSection(response.id, { status: "notes" });
  const proposal = createSection({ paper_id: p, parent_id: null, heading: "A facilitating-practices approach", claim: "Treat adoption of a known-collusive algorithm as a facilitating practice under Section 5 of the FTC Act." });
  createSection({ paper_id: p, parent_id: proposal.id, heading: "Limits of the proposal", claim: "The approach reaches only knowing adoption, not emergent collusion." });
  updateSection(intro.id, { status: "drafted", word_target: 800 });
  updateSection(doctrine.id, { status: "notes", word_target: 2500 });

  // Sources.
  const twombly = createSource(p, {
    type: "case",
    citation: "Bell Atlantic Corp. v. Twombly, 550 U.S. 544 (2007)",
    short_cite: "Twombly",
    year: 2007,
    publisher: "U.S. Supreme Court",
    url: "",
    read_status: "read",
    relevance: "Pleading standard for inferring agreement from parallel conduct.",
    tags: "agreement, pleading",
  });
  const theatre = createSource(p, {
    type: "case",
    citation: "Theatre Enterprises, Inc. v. Paramount Film Distributing Corp., 346 U.S. 537 (1954)",
    short_cite: "Theatre Enterprises",
    year: 1954,
    publisher: "U.S. Supreme Court",
    url: "",
    read_status: "skimmed",
    relevance: "Conscious parallelism alone is not a Section 1 violation.",
    tags: "agreement, parallelism",
  });
  const article = createSource(p, {
    type: "article",
    citation: "A. Placeholder & B. Example, Artificial Intelligence and Collusion: When Computers Inhibit Competition, 99 Placeholder L. Rev. 1 (2020)",
    short_cite: "Placeholder & Example",
    year: 2020,
    publisher: "Placeholder Law Review",
    url: "https://example.com/placeholder-article",
    read_status: "read",
    relevance: "Taxonomy of algorithmic collusion scenarios; placeholder PDF attached.",
    tags: "algorithms, taxonomy",
  });
  const statute = createSource(p, {
    type: "statute",
    citation: "15 U.S.C. § 1 (Sherman Act § 1)",
    short_cite: "Sherman Act § 1",
    year: 1890,
    publisher: "",
    url: "https://www.law.cornell.edu/uscode/text/15/1",
    read_status: "unread",
    relevance: "The operative text: 'contract, combination ... or conspiracy'.",
    tags: "statute",
  });
  attachPdf(
    article,
    paper.slug,
    "placeholder-article.pdf",
    makePlaceholderPdf([
      "PLACEHOLDER PDF - Artificial Intelligence and Collusion",
      "99 Placeholder L. Rev. 1 (2020)",
      "",
      "This file was generated by the seed script so the PDF viewer has",
      "something to show. Replace it by uploading a real PDF on the source page.",
      "",
      "p. 12: Four scenarios: messenger, hub-and-spoke, predictable agent, autonomous machine.",
      "p. 19: The autonomous-machine scenario has no human meeting of the minds.",
    ]),
  );

  // Section–source links (each writes a citation log row).
  createSectionSourceLink(doctrine.id, twombly, "support", "Establishes that parallel conduct alone does not plead an agreement.");
  createSectionSourceLink(plusFactors.id, twombly, "support", "Source of the 'plus factors' framing in modern pleading.");
  createSectionSourceLink(counter.id, article, "counter", "Describes the hub-and-spoke scenario that the objection relies on.");

  // Extracts: 6, two left unlinked so the map's staging cluster shows something.
  createExtract(twombly, p, {
    pin_cite: "at 553",
    text: "The crucial question is whether the challenged anticompetitive conduct stems from independent decision or from an agreement, tacit or express.",
    note: "Core framing for the agreement requirement.",
    kind: "support",
    tags: "agreement",
    section_ids: [doctrine.id],
  });
  createExtract(twombly, p, {
    pin_cite: "at 556-57",
    text: "A bare assertion of conspiracy will not suffice ... an allegation of parallel conduct and a bare assertion of conspiracy will not suffice.",
    note: "Use when describing the pleading hurdle.",
    kind: "support",
    tags: "pleading",
    section_ids: [plusFactors.id],
  });
  createExtract(theatre, p, {
    pin_cite: "at 541",
    text: "This Court has never held that proof of parallel business behavior conclusively establishes agreement or, phrased differently, that such behavior itself constitutes a Sherman Act offense.",
    note: "Classic statement that conscious parallelism is lawful.",
    kind: "support",
    tags: "parallelism",
    section_ids: [],
  });
  createExtract(article, p, {
    pin_cite: "at 12",
    text: "Four scenarios: messenger, hub-and-spoke, predictable agent, autonomous machine.",
    note: "Taxonomy to structure Part III.",
    kind: "definition",
    tags: "taxonomy, algorithms",
    section_ids: [algos.id],
  });
  createExtract(article, p, {
    pin_cite: "at 19",
    text: "In the autonomous-machine scenario there is no human meeting of the minds to point to; the algorithms learn to collude.",
    note: "The hardest case for current doctrine; central to the thesis.",
    kind: "support",
    tags: "algorithms",
    section_ids: [doctrine.id, proposal.id],
  });
  createExtract(article, p, {
    pin_cite: "at 24",
    text: "Where competitors knowingly adopt the same vendor's pricing tool, the vendor is a classic hub.",
    note: "The objection in its strongest form.",
    kind: "counter",
    tags: "hub-and-spoke",
    section_ids: [],
  });

  // A manual citation log row, plus one verified row.
  addManualLogEntry(p, { source_id: statute, pin_cite: null, section_id: doctrine.id, extract_id: null, used_in: "fn 1", note: "Quote the statutory text in the first footnote." });
  const log = listCitationLog(p);
  const first = log.find((r) => r.origin === "extract_link");
  if (first) updateLogEntry(first.id, { verified: true, used_in: "fn 23" });

  // Open questions.
  addOpenQuestion(p, "Does the FTC's Section 5 authority survive the recent circuit decisions narrowing 'unfair methods'?", proposal.id);
  addOpenQuestion(p, "Is there any case treating algorithm adoption itself as a plus factor?", null);

  // One generated placeholder .docx draft.
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: "Placeholder Paper: Algorithmic Pricing and Tacit Collusion" }),
          new Paragraph({ text: "This is a generated placeholder draft. It exists so the drafts page and the word count against the word limit have something to show." }),
          new Paragraph({
            text: "Section 1 of the Sherman Act reaches contracts, combinations, and conspiracies in restraint of trade. Whether independently adopted pricing algorithms that converge on supra-competitive prices fall within that language is the question this paper takes up. Part I describes the agreement requirement; Part II describes how pricing algorithms converge; Part III considers the hub-and-spoke objection; Part IV proposes a facilitating-practices approach.",
          }),
        ],
      },
    ],
  });
  const bytes = await Packer.toBuffer(doc);
  await addDraft(p, paper.slug, "first-draft-placeholder.docx", bytes, "Generated placeholder draft");
  return paper;
}
