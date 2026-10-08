import { test } from "node:test";
import assert from "node:assert/strict";
import { legalLabel, numberingLabel, toAlpha, toRoman } from "../src/lib/numbering.ts";

test("roman and alpha numerals", () => {
  assert.equal(toRoman(1), "I");
  assert.equal(toRoman(4), "IV");
  assert.equal(toRoman(14), "XIV");
  assert.equal(toRoman(0), "");
  assert.equal(toAlpha(1), "A");
  assert.equal(toAlpha(26), "Z");
  assert.equal(toAlpha(27), "AA");
});

test("legal numbering cycles I. A. 1. a. i. (1) (a) (i)", () => {
  const first = [0, 1, 2, 3, 4, 5, 6, 7].map((d) => legalLabel(d, 0));
  assert.deepEqual(first, ["I.", "A.", "1.", "a.", "i.", "(1)", "(a)", "(i)"]);
  assert.equal(legalLabel(8, 1), "II.");
  assert.equal(legalLabel(1, 2), "C.");
});

test("decimal and bullet labels", () => {
  assert.equal(numberingLabel("decimal", [0]), "1.");
  assert.equal(numberingLabel("decimal", [0, 2]), "1.3");
  assert.equal(numberingLabel("decimal", [1, 0, 3]), "2.1.4");
  assert.equal(numberingLabel("bullets", [0]), "•");
  assert.equal(numberingLabel("bullets", [0, 0]), "◦");
  assert.equal(numberingLabel("bullets", [0, 0, 0, 0]), "•");
  assert.equal(numberingLabel("legal", []), "");
});
