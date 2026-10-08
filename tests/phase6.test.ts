import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { unzipSync } from "fflate";

// The exporters and the backup read the uploads folder from the data folder, so point it at a scratch
// directory before those modules load.
const tmpData = fs.mkdtempSync(path.join(os.tmpdir(), "law-outlines-test-"));
process.env.LAW_OUTLINES_DATA_DIR = tmpData;

const { openDatabase } = await import("../src/lib/db.ts");
const { createCourse, getOutline, listOutlines } = await import("../src/lib/courses.ts");
const { loadLinks, loadNodes, loadSources, upsertNodes } = await import("../src/lib/nodes.ts");
const { buildNodes } = await import("../src/lib/seed.ts");
const { createLink, createSource, saveImage } = await import("../src/lib/attachments.ts");
const { takeSnapshot } = await import("../src/lib/snapshots.ts");
const { diffTrees, restoreSnapshotAsOutline, treeRows } = await import("../src/lib/snapdiff.ts");
const { imageSize } = await import("../src/lib/imagesize.ts");
const { exportOutline, exportFileName } = await import("../src/lib/export.ts");
const { backupIfStale, listBackups, runBackup } = await import("../src/lib/backup.ts");
const { UPLOADS_DIR } = await import("../src/lib/paths.ts");

/** A valid 8-bit RGB PNG of the given size (solid colour), for the image exports. */
function makePng(width: number, height: number): Buffer {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  const crc = (buf: Buffer) => {
    let c = -1;
    for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const raw = Buffer.alloc((1 + width * 3) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    for (let x = 0; x < width; x++) raw.set([0x33, 0x66, 0x99], y * (1 + width * 3) + 1 + x * 3);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function setup() {
  const db = openDatabase(":memory:");
  const course = createCourse(db, { title: "Contracts", syllabusTopics: ["offer", "acceptance"] });
  const full = listOutlines(db, course.id).find((o) => o.kind === "full")!;
  const nodes = buildNodes(full.id, [
    {
      type: "heading",
      title: "Formation",
      status: "drafted",
      body: "Notes on **formation** with a [link](https://example.com).",
      children: [
        {
          type: "rule",
          title: "Offer",
          status: "final",
          fields: { ruleStatement: "An offer is a manifestation of willingness to enter a bargain.", elements: [{ text: "Manifestation", definition: "Objective test" }, { text: "Willingness to be bound" }], exceptions: [{ text: "Advertisements", element: 1 }] },
          children: [{ type: "hypo", title: "Newspaper ad", fields: { facts: "A store advertises coats for $1.", question: "Offer?", answer: "Usually not, unless it is clear and explicit." } }],
        },
        { type: "statute", title: "UCC 2-204", fields: { cite: "Wis. Stat. 402.204", quotedText: "A contract for sale of goods may be made in any manner sufficient to show agreement." } },
        { type: "table", title: "Comparison", fields: { grid: { columns: ["Common law", "UCC"], rows: [["Mirror image", "2-207"]] } } },
        { type: "flag", title: "Exam favourite", fields: { text: "Professor loves this", color: "amber" } },
        { type: "image", title: "Diagram" },
      ],
    },
    { type: "heading", title: "Defenses", children: [{ type: "definition", title: "Duress", fields: { definition: "An improper threat that leaves no reasonable alternative." } }] },
  ]);
  upsertNodes(db, nodes);
  const byTitle = (t: string) => nodes.find((n) => n.title === t)!;
  createSource(db, byTitle("Offer").id, "casebook", "Casebook p. 12", null);
  createSource(db, byTitle("Duress").id, "handout", "R2d 175", "https://example.com/r2d");
  createLink(db, byTitle("Newspaper ad").id, byTitle("Offer").id, "applies");
  saveImage(db, byTitle("Diagram").id, course.slug, "lot.png", makePng(40, 20), "A lot");
  return { db, course, full, nodes, byTitle };
}

test("imageSize reads PNG and JPEG headers", () => {
  const png = imageSize(makePng(40, 20));
  assert.deepEqual(png, { width: 40, height: 20, type: "png" });
  // A minimal JPEG: SOI, then a SOF0 marker with 16-bit height/width.
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x1e, 0x00, 0x28, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);
  assert.deepEqual(imageSize(jpg), { width: 40, height: 30, type: "jpg" });
  assert.equal(imageSize(Buffer.from("<svg/>")), null);
});

test("snapshot diff reports added, removed, changed and moved nodes", () => {
  const { db, full, nodes, byTitle } = setup();
  const a = takeSnapshot(db, full.id, "before")!;
  // Change a title, move a node under another parent, delete one and add one.
  const offer = { ...byTitle("Offer"), title: "Offer (revised)" };
  const duress = { ...byTitle("Duress"), parentId: byTitle("Formation").id, position: 99 };
  const added = buildNodes(full.id, [{ type: "policy", title: "Freedom of contract" }]);
  upsertNodes(db, [offer, duress, ...added]);
  db.prepare("DELETE FROM nodes WHERE id = ?").run(byTitle("Exam favourite").id);
  const b = takeSnapshot(db, full.id, "after")!;
  const treeA = (await_(db, a.id)).tree;
  const treeB = (await_(db, b.id)).tree;
  const diff = diffTrees(treeA, treeB);
  assert.equal(diff.added, 1);
  assert.equal(diff.removed, 1);
  assert.equal(diff.changed, 1);
  assert.equal(diff.moved, 1);
  assert.deepEqual(diff.entries[offer.id].changedFields, ["title"]);
  assert.equal(diff.entries[duress.id].status, "moved");
  assert.equal(diff.entries[added[0].id].status, "added");
  assert.equal(diff.entries[byTitle("Exam favourite").id].status, "removed");
  assert.equal(diff.entries[byTitle("Formation").id].status, "same");
  assert.equal(treeRows(treeA).length, nodes.length);
  // Rows come in document order with depths.
  assert.equal(treeRows(treeB)[0].node.title, "Formation");
  assert.equal(treeRows(treeB).find((r) => r.node.id === duress.id)?.depth, 1);
});

function await_(db: ReturnType<typeof openDatabase>, id: string) {
  const row = db.prepare("SELECT tree_json FROM snapshots WHERE id = ?").get(id) as { tree_json: string };
  return { tree: JSON.parse(row.tree_json) };
}

test("restoring a snapshot makes a new outline and leaves the current one alone", () => {
  const { db, course, full, nodes, byTitle } = setup();
  const snap = takeSnapshot(db, full.id, "keep")!;
  upsertNodes(db, [{ ...byTitle("Offer"), title: "Changed after the snapshot" }]);
  const restored = restoreSnapshotAsOutline(db, snap.id, "From snapshot")!;
  assert.ok(restored);
  assert.notEqual(restored.id, full.id);
  assert.equal(restored.courseId, course.id);
  assert.equal(restored.name, "From snapshot");
  assert.equal(getOutline(db, full.id)!.name, full.name);
  // The current outline keeps its later edit; the restored one has the snapshot's content under fresh ids.
  assert.equal(loadNodes(db, full.id).find((n) => n.id === byTitle("Offer").id)!.title, "Changed after the snapshot");
  const restoredNodes = loadNodes(db, restored.id);
  assert.equal(restoredNodes.length, nodes.length);
  assert.ok(restoredNodes.some((n) => n.title === "Offer"));
  assert.ok(restoredNodes.every((n) => !nodes.some((o) => o.id === n.id)), "ids are new");
  const restoredOffer = restoredNodes.find((n) => n.title === "Offer")!;
  const restoredHypo = restoredNodes.find((n) => n.title === "Newspaper ad")!;
  assert.equal(restoredHypo.parentId, restoredOffer.id, "parents are remapped");
  const links = loadLinks(db, restored.id);
  assert.equal(links.length, 1);
  assert.equal(links[0].fromNode, restoredHypo.id);
  assert.equal(links[0].toNode, restoredOffer.id);
  assert.equal(loadSources(db, restored.id).length, 2);
  assert.equal(loadLinks(db, full.id).length, 1, "the original keeps its links");
  // Restoring with no name falls back to "<name> (restored)".
  assert.equal(restoreSnapshotAsOutline(db, snap.id, "  ")!.name, `${full.name} (restored)`);
  assert.equal(restoreSnapshotAsOutline(db, "missing", "x"), null);
});

test("export file names carry course, outline and date", () => {
  const { course, full } = setup();
  const name = exportFileName(course.slug, full, "docx");
  assert.match(name, new RegExp(`^${course.slug}-${full.name.toLowerCase()}-\\d{4}-\\d{2}-\\d{2}\\.docx$`));
  assert.match(exportFileName(course.slug, full, "md", "Formation"), /-formation-\d{4}-\d{2}-\d{2}\.md$/);
});

test("markdown export keeps structure, notes, images and sources", async () => {
  const { db, full, byTitle } = setup();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "law-outlines-export-"));
  const result = (await exportOutline(db, full.id, { format: "md", sectionId: null, sources: "footnotes", revealAnswers: false }, dir))!;
  assert.ok(result && fs.existsSync(result.path));
  const md = fs.readFileSync(result.path, "utf8");
  assert.match(md, /^# Full\n/);
  assert.match(md, /^## I\. Formation/m);
  assert.match(md, /^### A\. Offer _\(rule\)_\[\^1\]/m);
  assert.match(md, /^\*\*Elements\*\*\n\n1\. Manifestation — _Objective test_\n2\. Willingness to be bound/m);
  assert.match(md, /^> A contract for sale of goods/m);
  assert.match(md, /\| Common law \| UCC \|/);
  assert.match(md, /<details><summary>Answer<\/summary>/, "hypo answers stay hidden unless asked");
  assert.match(md, /Notes on \*\*formation\*\*/);
  assert.match(md, /!\[A lot\]\(.*-images\/.*lot\.png\)/);
  assert.match(md, /^\[\^1\]: casebook: Casebook p\. 12$/m);
  assert.match(md, /^\[\^2\]: handout: R2d 175 \(https:\/\/example\.com\/r2d\)$/m);
  const imageDir = path.join(dir, result.file.replace(/\.md$/, "-images"));
  assert.equal(fs.readdirSync(imageDir).length, 1, "images are copied next to the file");
  // One section, inline sources, answers shown.
  const section = (await exportOutline(db, full.id, { format: "md", sectionId: byTitle("Formation").id, sources: "inline", revealAnswers: true }, dir))!;
  const md2 = fs.readFileSync(section.path, "utf8");
  assert.match(md2, /^# Formation\n/);
  assert.doesNotMatch(md2, /Defenses/);
  assert.match(md2, /\*\*Answer\.\*\* Usually not/);
  assert.match(md2, /_Sources: casebook: Casebook p\. 12_/);
  assert.doesNotMatch(md2, /\[\^1\]/);
  assert.equal(await exportOutline(db, "missing", { format: "md", sectionId: null, sources: "none", revealAnswers: false }, dir), null);
});

test("docx export is a Word file with real heading styles, a footer page number and the image", async () => {
  const { db, full } = setup();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "law-outlines-export-"));
  const result = (await exportOutline(db, full.id, { format: "docx", sectionId: null, sources: "footnotes", revealAnswers: true }, dir))!;
  const data = fs.readFileSync(result.path);
  assert.equal(data.subarray(0, 2).toString("ascii"), "PK");
  const entries = unzipSync(new Uint8Array(data));
  const xml = Buffer.from(entries["word/document.xml"]).toString("utf8");
  assert.match(xml, /w:pStyle w:val="Heading1"/);
  assert.match(xml, /w:pStyle w:val="Heading2"/);
  assert.match(xml, /w:pStyle w:val="Heading3"/);
  assert.match(xml, /Formation/);
  assert.match(xml, /Usually not, unless/);
  assert.match(xml, /<w:tbl>/, "tables come out as Word tables");
  assert.match(xml, /TOC \\h \\o &quot;1-2&quot;/, "a table of contents field is present");
  assert.match(xml, /w:footnoteReference/);
  assert.match(Buffer.from(entries["word/footnotes.xml"]).toString("utf8"), /Casebook p\. 12/);
  assert.match(Buffer.from(entries["word/footer1.xml"]).toString("utf8"), /PAGE/);
  assert.ok(Object.keys(entries).some((k) => k.startsWith("word/media/")), "the image is embedded");
  const styles = Buffer.from(entries["word/styles.xml"]).toString("utf8");
  assert.match(styles, /w:styleId="Heading1"/);
});

test("pdf export produces a PDF with pages, a contents list and page numbers", async () => {
  const { db, full } = setup();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "law-outlines-export-"));
  const result = (await exportOutline(db, full.id, { format: "pdf", sectionId: null, sources: "inline", revealAnswers: false }, dir))!;
  const data = fs.readFileSync(result.path);
  assert.equal(data.subarray(0, 5).toString("ascii"), "%PDF-");
  const text = data.toString("latin1");
  const pages = (text.match(/\/Type \/Page[^s]/g) ?? []).length;
  assert.ok(pages >= 2, `contents page plus body (${pages} pages)`);
  assert.ok((text.match(/\/Type \/Font/g) ?? []).length >= 2, "Helvetica and Helvetica-Bold are embedded");
  assert.match(text, /\/Subtype \/Image/, "the PNG is embedded");
});

test("backups zip the database and uploads, and only run when stale", async () => {
  const { db, course } = setup();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "law-outlines-backup-"));
  const uploads = path.join(UPLOADS_DIR, course.slug);
  assert.ok(fs.existsSync(uploads), "the image was saved under the uploads folder");
  const now = new Date("2026-03-04T05:06:07");
  const written = await runBackup({ db, dir, now });
  assert.equal(path.basename(written), "2026-03-04_05-06-07.zip");
  const entries = unzipSync(new Uint8Array(fs.readFileSync(written)));
  const names = Object.keys(entries);
  assert.ok(names.includes("outlines.db"));
  assert.ok(names.some((n) => n.startsWith(`uploads/${course.slug}/`) && n.endsWith("lot.png")), `uploads are included (${names.join(", ")})`);
  // The database copy is a working SQLite file with the course in it.
  const copy = path.join(dir, "check.db");
  fs.writeFileSync(copy, entries["outlines.db"]);
  const reopened = openDatabase(copy);
  assert.equal((reopened.prepare("SELECT count(*) AS n FROM courses").get() as { n: number }).n, 1);
  reopened.close();
  // A second backup in the same second gets a suffix instead of overwriting.
  const again = await runBackup({ db, dir, now });
  assert.equal(path.basename(again), "2026-03-04_05-06-07-2.zip");
  assert.equal(listBackups(dir).length, 2);
  // Fresh backups are not repeated; stale ones are.
  assert.equal(await backupIfStale({ db, dir, now: new Date() }), null);
  const later = new Date(Date.now() + 25 * 60 * 60 * 1000);
  assert.ok(await backupIfStale({ db, dir, now: later }));
  assert.equal(listBackups(dir).length, 3);
});
