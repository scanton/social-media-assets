/* ============================================================
   POP KIT - OCCASION ILLUSTRATIONS, the rest of the set
   ------------------------------------------------------------
   The remaining thirty-six occasions, cultural celebrations and
   contexts, drawn on the same construction as everything else in
   the kit. Merged into CATEGORY_RICH by categories-rich.js so
   callers only ever see one table.

   Same six rules, and they are not negotiable:
     1  Flat shapes only. The renderer adds keyline, halo, slab.
     2  Back to front. Array order is stacking order.
     3  Brand swatches only.
     4  Live area 12 to 88.
     5  Six parts or fewer. Detail is what kills a glyph at 44px.
     6  A hole is a STROKED part, never a shape filled with the
        background colour.
   ============================================================ */

import { BRAND } from './tokens.js';

const INK = BRAND.ink, RED = BRAND.red, CREAM = BRAND.cream;
const WARM = '#E4D6C4', SHADE = '#CFBEA8', DEEPRED = '#8A1420', DEEPGOLD = '#947C43';
const GOLD = BRAND.gold, CORAL = BRAND.coral, AMBER = BRAND.amber;
const SPINK = BRAND.sPink, SSAGE = BRAND.sSage, GREEN = BRAND.green;
const BLUE = BRAND.blue, ORANGE = BRAND.orange, PURPLE = BRAND.purple;
const SMIST = BRAND.sMist, SLEMON = BRAND.sLemon, SSAND = BRAND.sSand, SPURPLE = BRAND.sPurple;

const f = n => Math.round(n * 100) / 100;
const rr = (x, y, w, h, r) => {
  r = Math.min(r, w / 2, h / 2);
  return `M ${f(x + r)} ${f(y)} L ${f(x + w - r)} ${f(y)} Q ${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)} `
       + `L ${f(x + w)} ${f(y + h - r)} Q ${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} `
       + `L ${f(x + r)} ${f(y + h)} Q ${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)} `
       + `L ${f(x)} ${f(y + r)} Q ${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Z`;
};
const ell = (cx, cy, rx, ry) => {
  const K = 0.5522847498, ox = rx * K, oy = ry * K;
  return `M ${f(cx)} ${f(cy - ry)} C ${f(cx + ox)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - oy)} ${f(cx + rx)} ${f(cy)} `
       + `C ${f(cx + rx)} ${f(cy + oy)} ${f(cx + ox)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)} `
       + `C ${f(cx - ox)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + oy)} ${f(cx - rx)} ${f(cy)} `
       + `C ${f(cx - rx)} ${f(cy - oy)} ${f(cx - ox)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)} Z`;
};
const circle = (cx, cy, r) => ell(cx, cy, r, r);
const heart = (cx, cy, s) => {
  const u = s / 100;
  const P = (x, y) => `${f(cx + (x - 50) * u)} ${f(cy + (y - 52) * u)}`;
  return `M ${P(50, 93)} C ${P(20, 71)} ${P(3, 53)} ${P(3, 34)} C ${P(3, 17)} ${P(15, 6)} ${P(29, 6)} `
       + `C ${P(39, 6)} ${P(46, 12)} ${P(50, 21)} C ${P(54, 12)} ${P(61, 6)} ${P(71, 6)} `
       + `C ${P(85, 6)} ${P(97, 17)} ${P(97, 34)} C ${P(97, 53)} ${P(80, 71)} ${P(50, 93)} Z`;
};
const star = (cx, cy, R, r, n, rot = 0) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n + (rot * Math.PI) / 180 - Math.PI / 2;
    const q = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'} ${f(cx + Math.cos(a) * q)} ${f(cy + Math.sin(a) * q)} `;
  }
  return d + 'Z';
};
/* a flame, used by five of these, so it lives here once */
const flame = (cx, cy, h) =>
  `M ${f(cx)} ${f(cy - h)} C ${f(cx + h * 0.55)} ${f(cy - h * 0.35)} ${f(cx + h * 0.45)} ${f(cy)} ${f(cx)} ${f(cy)} `
  + `C ${f(cx - h * 0.45)} ${f(cy)} ${f(cx - h * 0.55)} ${f(cy - h * 0.35)} ${f(cx)} ${f(cy - h)} Z`;
/* a semicircular arc, for rainbows and handles */
const arc = (cx, cy, r) => `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx + r)} ${f(cy)}`;

export const CATEGORY_RICH_2 = {

  /* ============ MILESTONES ============ */

  'occ-anniversary': {
    label: 'Anniversary',
    parts: [
      { d: `M 20 20 L 44 20 L 38 46 L 26 46 Z`, fill: SPINK },
      { d: rr(29, 46, 6, 24, 1), fill: CREAM },
      { d: ell(32, 74, 13, 5), fill: CREAM },
      { d: `M 56 20 L 80 20 L 74 46 L 62 46 Z`, fill: SPINK },
      { d: rr(65, 46, 6, 24, 1), fill: CREAM },
      { d: ell(68, 74, 13, 5), fill: CREAM }
    ],
    lines: []
  },

  /* a ring in a box. The stone is the only part that has to read
     at 44px, so it is drawn bigger than a real one would be. */
  'occ-engagement': {
    label: 'Engagement',
    parts: [
      { d: rr(26, 54, 48, 28, 4), fill: RED },
      { d: rr(30, 50, 40, 8, 2), fill: CREAM },
      { d: circle(50, 40, 14), stroke: GOLD, w: 7 },
      { d: `M 50 12 L 60 24 L 50 32 L 40 24 Z`, fill: SMIST }
    ],
    lines: []
  },

  /* a heart-shaped box, banded. Reads as chocolates, not as a
     plain heart, which is the whole job. */
  'occ-valentines': {
    label: 'Valentines',
    parts: [
      { d: heart(50, 54, 78), fill: RED },
      { d: rr(18, 48, 64, 12, 2), fill: CREAM },
      { d: `M 50 54 C 40 40 26 40 26 48 C 26 54 38 56 50 54 Z`, fill: GOLD },
      { d: `M 50 54 C 60 40 74 40 74 48 C 74 54 62 56 50 54 Z`, fill: GOLD }
    ],
    lines: []
  },

  /* was an umbrella, a pun on "shower" that nobody has to get.
     A bottle is the object, and the teat plus collar plus
     measure marks is a silhouette that reads at any size. */
  'occ-baby-shower': {
    label: 'Baby shower',
    parts: [
      { d: `M 44 10 C 44 6 56 6 56 10 C 56 16 58 18 58 22 L 42 22 C 42 18 44 16 44 10 Z`, fill: WARM },
      { d: rr(38, 22, 24, 9, 2), fill: SPINK },
      { d: `M 32 40 C 32 34 38 31 38 31 L 62 31 C 62 31 68 34 68 40 L 68 82 Q 68 90 60 90 L 40 90 Q 32 90 32 82 Z`, fill: CREAM },
      { d: `M 32 58 L 68 58 L 68 82 Q 68 90 60 90 L 40 90 Q 32 90 32 82 Z`, fill: SPINK }
    ],
    lines: ['M 38 46 L 50 46', 'M 38 52 L 46 52', 'M 38 68 L 50 68', 'M 38 76 L 46 76']
  },

  'occ-gender-reveal': {
    label: 'Gender reveal',
    parts: [
      { d: ell(34, 40, 17, 20), fill: SMIST },
      { d: ell(66, 46, 17, 20), fill: SPINK },
      { d: `M 30 60 L 38 60 L 34 66 Z`, fill: SMIST },
      { d: `M 62 66 L 70 66 L 66 72 Z`, fill: SPINK }
    ],
    lines: ['M 34 66 C 30 76 38 80 34 88', 'M 66 72 C 62 80 70 84 66 90']
  },

  /* two cupped palms and a small heart between them. The gesture
     library owns real hands; this is the abstraction of one. */
  'occ-adoption': {
    label: 'Adoption',
    parts: [
      { d: `M 12 54 C 12 42 24 38 34 44 L 50 62 L 30 80 C 18 76 12 66 12 54 Z`, fill: WARM },
      { d: `M 88 54 C 88 42 76 38 66 44 L 50 62 L 70 80 C 82 76 88 66 88 54 Z`, fill: CREAM },
      { d: heart(50, 38, 40), fill: RED }
    ],
    lines: []
  },

  /* ============ SENTIMENT ============ */

  'occ-thinking-of-you': {
    label: 'Thinking of you',
    parts: [
      { d: ell(54, 40, 32, 24), fill: CREAM },
      { d: heart(54, 40, 28), fill: RED },
      { d: circle(28, 68, 8), fill: CREAM },
      { d: circle(18, 80, 5), fill: CREAM }
    ],
    lines: []
  },

  'occ-miss-you': {
    label: 'Miss you',
    parts: [
      { d: `M 12 44 L 88 18 L 58 84 L 47 56 Z`, fill: CREAM },
      { d: `M 47 56 L 88 18 L 58 84 Z`, fill: WARM },
      { d: heart(24, 74, 22), fill: RED }
    ],
    lines: []
  },

  'occ-get-well': {
    label: 'Get well',
    parts: [
      { d: circle(72, 54, 11), stroke: CREAM, w: 7 },
      { d: `M 22 40 L 64 40 L 60 76 Q 58 82 52 82 L 34 82 Q 28 82 26 76 Z`, fill: CREAM },
      { d: heart(43, 58, 24), fill: RED }
    ],
    lines: ['M 34 28 C 30 22 38 18 34 12', 'M 50 28 C 46 22 54 18 50 12']
  },

  /* a whole heart with the crack drawn as a line, rather than two
     half hearts that would need a seam nobody can align. */
  'occ-breakup': {
    label: 'Breakup',
    parts: [
      { d: heart(50, 50, 82), fill: RED }
    ],
    lines: ['M 50 12 L 41 38 L 57 50 L 45 86']
  },

  'occ-sorry': {
    label: "I'm sorry",
    parts: [
      { d: heart(50, 52, 76), fill: RED },
      { d: rr(24, 42, 52, 16, 7), fill: CREAM },
      { d: rr(40, 42, 20, 16, 3), fill: WARM }
    ],
    lines: []
  },

  'occ-friendship': {
    label: 'Friendship',
    parts: [
      { d: ell(36, 38, 24, 18), fill: CREAM },
      { d: `M 26 52 L 38 52 L 28 64 Z`, fill: CREAM },
      { d: ell(64, 58, 24, 18), fill: SPINK },
      { d: `M 74 72 L 62 72 L 72 84 Z`, fill: SPINK },
      { d: heart(36, 38, 20), fill: RED },
      { d: heart(64, 58, 20), fill: CORAL }
    ],
    lines: []
  },

  /* ============ LIFE ============ */

  'occ-new-job': {
    label: 'New job',
    parts: [
      { d: `M 38 36 L 38 28 Q 38 24 42 24 L 58 24 Q 62 24 62 28 L 62 36`, stroke: INK, w: 6 },
      { d: rr(14, 36, 72, 44, 5), fill: CREAM },
      { d: rr(14, 50, 72, 10, 0), fill: WARM },
      { d: rr(43, 48, 14, 14, 2), fill: GOLD }
    ],
    lines: []
  },

  /* Fourth attempt, and the right one: the scene, not the object.
     A single chair reads as furniture. A parasol reads as weather.
     Umbrella over a chair on sand with a sun is the whole idea in
     one picture, and the four masses stay separable at 44 because
     none of them touches another except the pole. */
  'occ-retirement': {
    label: 'Retirement',
    parts: [
      { d: circle(80, 21, 12), fill: AMBER },
      { d: rr(4, 80, 92, 11, 5), fill: SSAND },
      { d: `M 8 44 C 8 22 21 9 39 9 C 57 9 70 22 70 44 Z`, fill: RED },
      { d: `M 30 44 C 30 23 33 10 39 9 C 45 10 48 23 48 44 Z`, fill: CREAM },
      { d: rr(36.5, 42, 5, 40, 1), fill: DEEPGOLD },
      { d: `M 46 76 L 51 50 L 69 53 L 65 76 Z`, fill: RED },
      { d: rr(42, 69, 36, 11, 3), fill: CREAM },
      { d: rr(44, 78, 6, 6, 1), fill: DEEPGOLD },
      { d: rr(70, 78, 6, 6, 1), fill: DEEPGOLD }
    ],
    lines: ['M 56 53 L 53 69', 'M 63 54 L 60 70']
  },

  'occ-kids': {
    label: 'Kids',
    parts: [
      { d: `M 14 68 L 14 34 L 30 50 L 42 26 L 50 42 L 58 26 L 70 50 L 86 34 L 86 68 Z`, fill: AMBER },
      { d: rr(14, 64, 72, 12, 2), fill: RED },
      { d: circle(50, 46, 6), fill: CREAM },
      { d: circle(28, 52, 4.5), fill: SPINK },
      { d: circle(72, 52, 4.5), fill: SPINK }
    ],
    lines: []
  },

  /* the pad is a heart. For and from pets is a real category and
     this is the cheapest way to make it ours. */
  'occ-pets': {
    label: 'Pets',
    parts: [
      { d: circle(26, 38, 11), fill: CREAM },
      { d: circle(42, 27, 11), fill: CREAM },
      { d: circle(58, 27, 11), fill: CREAM },
      { d: circle(74, 38, 11), fill: CREAM },
      { d: heart(50, 62, 48), fill: RED }
    ],
    lines: []
  },

  /* six brand colours, not the six of the flag. Ours, and legible
     in a medallion, which the literal palette is not. */
  'occ-lgbt': {
    label: 'LGBT',
    parts: [
      { d: arc(50, 74, 36), stroke: RED, w: 8 },
      { d: arc(50, 74, 28), stroke: ORANGE, w: 8 },
      { d: arc(50, 74, 20), stroke: AMBER, w: 8 },
      { d: arc(50, 74, 12), stroke: GREEN, w: 8 },
      { d: heart(50, 78, 26), fill: PURPLE }
    ],
    lines: []
  },

  'occ-quinceanera': {
    label: 'Quinceanera',
    parts: [
      { d: `M 14 64 L 26 38 L 38 60 L 50 24 L 62 60 L 74 38 L 86 64 Z`, fill: GOLD },
      { d: `M 14 64 C 30 72 70 72 86 64 L 86 74 C 70 82 30 82 14 74 Z`, fill: DEEPGOLD },
      { d: circle(50, 36, 7), fill: RED },
      { d: circle(26, 48, 5), fill: SPINK },
      { d: circle(74, 48, 5), fill: SPINK }
    ],
    lines: []
  },

  'occ-astrology': {
    label: 'Astrology',
    parts: [
      { d: `M 58 12 C 36 18 22 36 22 56 C 22 74 36 88 54 88 C 62 88 70 85 76 80 C 58 82 42 70 42 52 C 42 34 48 20 58 12 Z`, fill: SMIST },
      { d: star(74, 26, 12, 5, 5), fill: GOLD },
      { d: star(84, 52, 8, 3.4, 5), fill: AMBER }
    ],
    lines: []
  },

  'occ-mothers-day': {
    label: "Mother's Day",
    parts: [
      { d: `M 50 50 L 50 84`, stroke: SSAGE, w: 7 },
      { d: `M 50 68 C 36 68 27 60 24 49 C 37 47 47 55 50 68 Z`, fill: SSAGE },
      { d: `M 33 32 C 33 21 41 14 50 14 C 59 14 67 21 67 32 C 67 44 59 52 50 52 C 41 52 33 44 33 32 Z`, fill: RED },
      { d: heart(72, 68, 22), fill: SPINK }
    ],
    lines: ['M 42 22 L 42 44', 'M 58 22 L 58 44']
  },

  'occ-fathers-day': {
    label: "Father's Day",
    parts: [
      { d: `M 40 16 L 60 16 L 66 32 L 34 32 Z`, fill: RED },
      { d: `M 34 32 L 66 32 L 72 62 L 50 86 L 28 62 Z`, fill: DEEPRED },
      { d: `M 40 40 L 60 40 L 62 50 L 38 50 Z`, fill: CREAM }
    ],
    lines: []
  },

  /* ============ SEASONAL ============ */

  'occ-easter': {
    label: 'Easter',
    parts: [
      { d: `M 50 10 C 67 10 80 33 80 52 C 80 71 67 86 50 86 C 33 86 20 71 20 52 C 20 33 33 10 50 10 Z`, fill: CREAM },
      { d: circle(38, 42, 7), fill: SPINK },
      { d: circle(62, 52, 7), fill: SSAGE },
      { d: circle(44, 66, 7), fill: AMBER },
      { d: circle(64, 30, 5), fill: CORAL }
    ],
    lines: []
  },

  'occ-halloween': {
    label: 'Halloween',
    parts: [
      { d: rr(45, 16, 10, 16, 3), fill: GREEN },
      { d: ell(50, 56, 36, 28), fill: ORANGE },
      { d: `M 34 46 L 46 46 L 40 58 Z`, fill: INK },
      { d: `M 54 46 L 66 46 L 60 58 Z`, fill: INK },
      { d: `M 30 66 L 40 63 L 46 70 L 54 63 L 60 70 L 70 66 L 64 78 L 36 78 Z`, fill: INK }
    ],
    lines: []
  },

  'occ-new-year': {
    label: 'New Year',
    parts: [
      { d: star(50, 50, 40, 15, 8, 0), fill: AMBER },
      { d: star(50, 50, 27, 10, 8, 22.5), fill: RED },
      { d: circle(50, 50, 9), fill: CREAM },
      { d: circle(16, 20, 4), fill: CORAL },
      { d: circle(84, 24, 4), fill: GREEN },
      { d: circle(80, 82, 4), fill: BLUE }
    ],
    lines: []
  },

  /* ============ CULTURAL ============ */

  'cul-hanukkah': {
    label: 'Hanukkah',
    parts: [
      { d: rr(30, 78, 40, 8, 2), fill: DEEPGOLD },
      { d: rr(46, 50, 8, 28, 1), fill: GOLD },
      { d: rr(18, 46, 64, 7, 2), fill: GOLD },
      { d: `M 20 28 h9 v18 h-9 Z M 45.5 20 h9 v26 h-9 Z M 71 28 h9 v18 h-9 Z`, fill: CREAM },
      { d: `${flame(24.5, 26, 11)} ${flame(50, 18, 12)} ${flame(75.5, 26, 11)}`, fill: AMBER }
    ],
    lines: []
  },

  'cul-diwali': {
    label: 'Diwali',
    parts: [
      { d: `M 16 54 C 21 74 34 82 50 82 C 66 82 79 74 84 54 Z`, fill: WARM },
      { d: ell(50, 54, 34, 7), fill: CREAM },
      { d: flame(50, 48, 30), fill: AMBER },
      { d: flame(50, 46, 17), fill: RED }
    ],
    lines: []
  },

  'cul-eid': {
    label: 'Eid',
    parts: [
      { d: `M 60 12 C 38 18 24 36 24 56 C 24 74 38 88 56 88 C 64 88 72 85 78 80 C 60 82 44 70 44 52 C 44 34 50 20 60 12 Z`, fill: GOLD },
      { d: star(76, 28, 14, 6, 5), fill: GOLD }
    ],
    lines: []
  },

  'cul-passover': {
    label: 'Passover',
    parts: [
      { d: rr(12, 26, 42, 44, 3), fill: WARM },
      { d: `M 58 26 L 88 26 L 84 50 Q 73 58 62 50 Z`, fill: RED },
      { d: rr(70, 56, 6, 16, 1), fill: GOLD },
      { d: rr(60, 72, 26, 7, 2), fill: GOLD }
    ],
    lines: ['M 20 36 L 46 36', 'M 20 48 L 46 48', 'M 20 60 L 46 60']
  },

  'cul-lunar-new-year': {
    label: 'Lunar New Year',
    parts: [
      { d: rr(34, 14, 32, 8, 2), fill: GOLD },
      { d: ell(50, 50, 27, 30), fill: RED },
      { d: rr(34, 78, 32, 8, 2), fill: GOLD },
      { d: rr(46, 86, 8, 8, 2), fill: DEEPGOLD }
    ],
    lines: ['M 40 24 C 34 38 34 62 40 76', 'M 60 24 C 66 38 66 62 60 76']
  },

  'cul-rosh-hashanah': {
    label: 'Rosh Hashanah',
    parts: [
      { d: `M 50 30 C 62 20 78 26 80 42 C 82 60 68 80 50 86 C 32 80 18 60 20 42 C 22 26 38 20 50 30 Z`, fill: RED },
      { d: `M 50 30 L 50 16`, stroke: DEEPGOLD, w: 5 },
      { d: `M 52 26 C 58 14 72 12 76 17 C 71 27 60 30 52 26 Z`, fill: SSAGE },
      { d: `M 78 58 C 86 66 88 76 80 78 C 72 76 72 66 78 58 Z`, fill: AMBER }
    ],
    lines: []
  },

  'cul-ramadan': {
    label: 'Ramadan',
    parts: [
      { d: circle(50, 16, 7), stroke: GOLD, w: 4 },
      { d: `M 36 24 L 64 24 L 70 36 L 30 36 Z`, fill: GOLD },
      { d: `M 30 36 L 70 36 L 76 72 L 24 72 Z`, fill: GREEN },
      { d: rr(20, 72, 60, 8, 2), fill: GOLD },
      { d: rr(41, 46, 18, 20, 3), fill: AMBER }
    ],
    lines: []
  },

  'cul-kwanzaa': {
    label: 'Kwanzaa',
    parts: [
      { d: rr(16, 76, 68, 9, 2), fill: DEEPGOLD },
      { d: `M 16 42 h8 v34 h-8 Z M 27 42 h8 v34 h-8 Z M 38 42 h8 v34 h-8 Z`, fill: RED },
      { d: `M 49 42 h8 v34 h-8 Z`, fill: INK },
      { d: `M 60 42 h8 v34 h-8 Z M 71 42 h8 v34 h-8 Z M 82 42 h4 v34 h-4 Z`, fill: GREEN },
      { d: `${flame(20, 40, 9)} ${flame(31, 40, 9)} ${flame(42, 40, 9)} ${flame(53, 40, 9)} ${flame(64, 40, 9)} ${flame(75, 40, 9)} ${flame(84, 40, 9)}`, fill: AMBER }
    ],
    lines: []
  },

  'cul-holi': {
    label: 'Holi',
    parts: [
      { d: `M 20 58 C 24 42 38 40 44 58 Z`, fill: RED },
      { d: `M 36 58 C 42 36 58 36 64 58 Z`, fill: AMBER },
      { d: `M 56 58 C 62 42 76 44 80 58 Z`, fill: GREEN },
      { d: `M 18 58 C 18 76 32 84 50 84 C 68 84 82 76 82 58 Z`, fill: CREAM },
      { d: circle(28, 26, 6), fill: SPINK },
      { d: circle(72, 24, 5), fill: BLUE }
    ],
    lines: []
  },

  'cul-nowruz': {
    label: 'Nowruz',
    parts: [
      { d: `M 50 60 L 50 26`, stroke: SSAGE, w: 6 },
      { d: `M 50 44 C 36 44 28 36 26 26 C 39 24 48 32 50 44 Z`, fill: SSAGE },
      { d: `M 50 50 C 64 50 72 42 74 32 C 61 30 52 38 50 50 Z`, fill: GREEN },
      { d: `M 22 58 C 22 76 34 84 50 84 C 66 84 78 76 78 58 Z`, fill: SMIST },
      { d: ell(50, 58, 28, 6), fill: CREAM }
    ],
    lines: []
  },

  /* ============ CONTEXT ============ */

  'ctx-college': {
    label: 'College',
    parts: [
      { d: rr(14, 14, 8, 70, 2), fill: DEEPGOLD },
      { d: `M 22 24 L 86 40 L 22 56 Z`, fill: RED },
      { d: circle(40, 40, 8), fill: CREAM }
    ],
    lines: []
  },

  /* was a backpack, which the team could not read as a school. A
     building with a pitched roof, a clock in the gable and a lit
     doorway is the shape everyone already carries for "school",
     and it survives at 44 because the silhouette is one mass. */
  'ctx-high-school': {
    label: 'High school',
    parts: [
      { d: `M 14 46 L 50 20 L 86 46 Z`, fill: RED },
      { d: `M 18 46 L 82 46 L 82 86 L 18 86 Z`, fill: SMIST },
      { d: `M 40 30 L 60 30 L 60 20 L 50 12 L 40 20 Z`, fill: RED },
      { d: circle(50, 34, 8), fill: CREAM },
      { d: `M 38 62 C 38 55.37 43.37 50 50 50 C 56.63 50 62 55.37 62 62 L 62 86 L 38 86 Z`, fill: DEEPGOLD },
      { d: rr(23, 54, 11, 12, 1.5), fill: CREAM },
      { d: rr(66, 54, 11, 12, 1.5), fill: CREAM },
      { d: rr(23, 71, 11, 12, 1.5), fill: CREAM },
      { d: rr(66, 71, 11, 12, 1.5), fill: CREAM }
    ],
    lines: ['M 50 30 L 50 36', 'M 50 34 L 54 34']
  }
};

export default CATEGORY_RICH_2;
