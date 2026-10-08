// Numbering labels for outline levels. Pure functions, no imports.
//   legal:   I.  A.  1.  a.  i.  (1)  (a)  (i)  then the same cycle again
//   decimal: 1   1.1   1.1.1
//   bullets: •   ◦   ▪

import type { NumberingStyle } from "./types.ts";

const ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** 1 -> "I", 4 -> "IV". Numbers below 1 give "". */
export function toRoman(n: number): string {
  if (n < 1) return "";
  let out = "";
  let rest = Math.floor(n);
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph;
      rest -= value;
    }
  }
  return out;
}

/** 1 -> "A", 26 -> "Z", 27 -> "AA". */
export function toAlpha(n: number): string {
  if (n < 1) return "";
  let out = "";
  let rest = Math.floor(n);
  while (rest > 0) {
    const r = (rest - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    rest = Math.floor((rest - 1) / 26);
  }
  return out;
}

const LEGAL_FORMS: ((n: number) => string)[] = [
  (n) => `${toRoman(n)}.`,
  (n) => `${toAlpha(n)}.`,
  (n) => `${n}.`,
  (n) => `${toAlpha(n).toLowerCase()}.`,
  (n) => `${toRoman(n).toLowerCase()}.`,
  (n) => `(${n})`,
  (n) => `(${toAlpha(n).toLowerCase()})`,
  (n) => `(${toRoman(n).toLowerCase()})`,
];

/** Legal label for a node at `depth` (0 = top level) that is the `index`-th (0-based) sibling. */
export function legalLabel(depth: number, index: number): string {
  const form = LEGAL_FORMS[depth % LEGAL_FORMS.length];
  return form(index + 1);
}

const BULLETS = ["•", "◦", "▪"];

/**
 * Label for one node. `path` is the 0-based sibling index of every ancestor followed by the node's own index,
 * so a node at depth 2 has a path of length 3. Returns "" for an unknown style.
 */
export function numberingLabel(style: NumberingStyle, path: number[]): string {
  const depth = path.length - 1;
  if (depth < 0) return "";
  switch (style) {
    case "legal":
      return legalLabel(depth, path[depth]);
    case "decimal":
      return path.map((i) => String(i + 1)).join(".") + (depth === 0 ? "." : "");
    case "bullets":
      return BULLETS[depth % BULLETS.length];
    default:
      return "";
  }
}

/** Human description of what level N looks like, for the "collapse to level" menu. */
export function levelExample(style: NumberingStyle, level: number): string {
  const path = Array.from({ length: level }, () => 0);
  return numberingLabel(style, path);
}
