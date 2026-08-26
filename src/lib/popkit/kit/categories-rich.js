/* ============================================================
   POP KIT - CATEGORY ILLUSTRATIONS, reference set
   ------------------------------------------------------------
   Every occasion, cultural celebration and context in the card
   range, drawn in the house illustration style. The first eleven
   are here; the rest are in categories-rich-2.js and merged in at
   the bottom of this file.

   This is the whole occasion library. There is no thin-line tier:
   a monoline mark reads as a wireframe in a feed, and a feed is
   where this work lives.

   THE DRAWING RULES, which are the whole spec
     1  Flat shapes only. Never draw an outline, a shadow, a
        highlight or a keyline. The renderer adds all four.
     2  Back to front. The array order is the stacking order.
     3  Brand swatches only. Plus the four working shades.
     4  Live area 12 to 88. Nothing outside it.
     5  Six parts or fewer, ideally. Detail is what kills a glyph
        at 44px, and every one of these still has to work there.
     6  A hole needs a STROKED part, { d, stroke, w }, never a
        shape filled with the background colour. The background is
        a medallion in one of eighteen colours and you do not know
        which one.
   ============================================================ */

import { BRAND } from './tokens.js';
import { CATEGORY_RICH_2 } from './categories-rich-2.js';

const INK = BRAND.ink, RED = BRAND.red, CREAM = BRAND.cream;
const WARM = '#E4D6C4', SHADE = '#CFBEA8', DEEPGOLD = '#947C43';
const GOLD = BRAND.gold, CORAL = BRAND.coral, AMBER = BRAND.amber;
const SPINK = BRAND.sPink, SSAGE = BRAND.sSage, GREEN = BRAND.green;

const f = n => Math.round(n * 100) / 100;

function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M ${f(x + r)} ${f(y)} L ${f(x + w - r)} ${f(y)} Q ${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)} `
       + `L ${f(x + w)} ${f(y + h - r)} Q ${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} `
       + `L ${f(x + r)} ${f(y + h)} Q ${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)} `
       + `L ${f(x)} ${f(y + r)} Q ${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Z`;
}
function circle(cx, cy, r) {
  const K = 0.5522847498, o = r * K;
  return `M ${f(cx)} ${f(cy - r)} C ${f(cx + o)} ${f(cy - r)} ${f(cx + r)} ${f(cy - o)} ${f(cx + r)} ${f(cy)} `
       + `C ${f(cx + r)} ${f(cy + o)} ${f(cx + o)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} `
       + `C ${f(cx - o)} ${f(cy + r)} ${f(cx - r)} ${f(cy + o)} ${f(cx - r)} ${f(cy)} `
       + `C ${f(cx - r)} ${f(cy - o)} ${f(cx - o)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} Z`;
}
function heart(cx, cy, s) {
  const u = s / 100;
  const P = (x, y) => `${f(cx + (x - 50) * u)} ${f(cy + (y - 52) * u)}`;
  return `M ${P(50, 93)} C ${P(20, 71)} ${P(3, 53)} ${P(3, 34)} C ${P(3, 17)} ${P(15, 6)} ${P(29, 6)} `
       + `C ${P(39, 6)} ${P(46, 12)} ${P(50, 21)} C ${P(54, 12)} ${P(61, 6)} ${P(71, 6)} `
       + `C ${P(85, 6)} ${P(97, 17)} ${P(97, 34)} C ${P(97, 53)} ${P(80, 71)} ${P(50, 93)} Z`;
}


function star(cx, cy, R, r, n, rot) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = (Math.PI * i) / n + (rot || 0) * Math.PI / 180 - Math.PI / 2;
    const rr2 = i % 2 ? r : R;
    d += `${i ? 'L' : 'M'} ${f(cx + Math.cos(a) * rr2)} ${f(cy + Math.sin(a) * rr2)} `;
  }
  return d + 'Z';
}
function ell(cx, cy, rx, ry) {
  const K = 0.5522847498, ox = rx * K, oy = ry * K;
  return `M ${f(cx)} ${f(cy - ry)} C ${f(cx + ox)} ${f(cy - ry)} ${f(cx + rx)} ${f(cy - oy)} ${f(cx + rx)} ${f(cy)} `
       + `C ${f(cx + rx)} ${f(cy + oy)} ${f(cx + ox)} ${f(cy + ry)} ${f(cx)} ${f(cy + ry)} `
       + `C ${f(cx - ox)} ${f(cy + ry)} ${f(cx - rx)} ${f(cy + oy)} ${f(cx - rx)} ${f(cy)} `
       + `C ${f(cx - rx)} ${f(cy - oy)} ${f(cx - ox)} ${f(cy - ry)} ${f(cx)} ${f(cy - ry)} Z`;
}
function tri(a, b, c) { return `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${c[0]} ${c[1]} Z`; }

export const CATEGORY_RICH = {

  /* --- the biggest category we have. A cake is a slab, a band and
     a candle, and the candle is the only part that has to survive
     44px, so it is drawn fat. */
  'occ-birthday': {
    label: 'Birthday',
    parts: [
      { d: rr(12, 74, 76, 10, 4), fill: SHADE },
      { d: rr(18, 44, 64, 30, 3), fill: CREAM },
      { d: rr(18, 40, 64, 12, 3), fill: WARM },
      { d: rr(18, 58, 64, 8, 0), fill: SPINK },
      { d: rr(45, 18, 10, 24, 3), fill: RED },
      { d: `M 50 6 C 58 14 57 22 50 22 C 43 22 42 14 50 6 Z`, fill: AMBER }
    ],
    lines: []
  },

  /* --- two hearts, offset, so it never collides with the single
     brand heart used as a mark. */
  'occ-love': {
    label: 'Love',
    parts: [
      { d: heart(62, 50, 50), fill: CORAL },
      { d: heart(40, 56, 58), fill: RED }
    ],
    lines: ['M 74 24 L 78 18', 'M 82 30 L 88 28', 'M 80 20 L 84 22']
  },

  /* --- rings. The reason a ring is a STROKED part and not a
     filled donut: the medallion behind it comes in eighteen
     colours and a fake hole would be wrong in seventeen of them. */
  'occ-wedding': {
    label: 'Wedding',
    parts: [
      { d: circle(38, 56, 20), stroke: GOLD, w: 9 },
      { d: circle(62, 56, 20), stroke: DEEPGOLD, w: 9 },
      { d: `M 50 26 L 42 38 L 58 38 Z`, fill: CREAM }
    ],
    lines: []
  },

  /* --- a onesie, not a rattle. A rattle at 44px is a lollipop. */
  'occ-baby': {
    label: 'Baby',
    parts: [
      { d: `M 32 26 L 44 26 Q 50 34 56 26 L 68 26 L 76 38 L 66 46 L 66 68 Q 66 76 58 76 L 42 76 Q 34 76 34 68 L 34 46 L 24 38 Z`, fill: CREAM },
      { d: `M 34 64 L 66 64 L 66 68 Q 66 76 58 76 L 42 76 Q 34 76 34 68 Z`, fill: SPINK },
      { d: heart(50, 48, 20), fill: RED }
    ],
    lines: []
  },

  /* --- graduation. The board and the tassel. The head under it is
     implied by the band, which is enough. */
  'occ-graduation': {
    label: 'Graduation',
    parts: [
      { d: `M 30 46 L 30 64 Q 50 78 70 64 L 70 46 L 50 56 Z`, fill: WARM },
      { d: `M 50 18 L 90 36 L 50 54 L 10 36 Z`, fill: INK },
      { d: circle(84, 62, 7), fill: GOLD }
    ],
    lines: ['M 86 38 L 84 56']
  },

  /* --- thank you. A bouquet, because a card inside a card set is
     a hall of mirrors. */
  'occ-thank-you': {
    label: 'Thank you',
    parts: [
      { d: `M 28 46 C 18 40 18 28 27 24 C 34 30 35 42 30 47 Z`, fill: SSAGE },
      { d: `M 72 46 C 82 40 82 28 73 24 C 66 30 65 42 70 47 Z`, fill: SSAGE },
      { d: circle(36, 42, 12), fill: RED },
      { d: circle(64, 42, 12), fill: AMBER },
      { d: circle(50, 34, 13), fill: CORAL },
      { d: `M 50 50 L 70 58 L 60 84 L 40 84 L 30 58 Z`, fill: CREAM }
    ],
    lines: ['M 42 62 L 58 62']
  },

  /* --- funny. A card pulling a face. Keeps the joke on the
     product rather than on a person, which is the house rule. */
  'occ-funny': {
    label: 'Funny',
    parts: [
      { d: rr(22, 16, 56, 68, 4), fill: CREAM },
      { d: `M 34 48 Q 50 74 66 48 Z`, fill: RED },
      { d: circle(38, 36, 5), fill: INK },
      { d: circle(62, 36, 5), fill: INK }
    ],
    lines: []
  },

  /* --- Christmas. Q4 is most of the year's revenue, so this one
     gets four parts rather than three. */
  'occ-christmas': {
    label: 'Christmas',
    parts: [
      { d: rr(44, 66, 12, 16, 1), fill: DEEPGOLD },
      { d: `M 50 12 L 72 42 L 62 42 L 82 68 L 18 68 L 38 42 L 28 42 Z`, fill: GREEN },
      { d: circle(40, 54, 5), fill: RED },
      { d: circle(60, 58, 5), fill: RED },
      { d: circle(50, 46, 5), fill: CREAM },
      { d: `M 50 4 L 55 14 L 66 15 L 58 23 L 60 34 L 50 28 L 40 34 L 42 23 L 34 15 L 45 14 Z`, fill: AMBER }
    ],
    lines: []
  },

  /* --- sympathy. One stem. The quietest thing in the set, and it
     should stay that way. */
  'occ-sympathy': {
    label: 'Sympathy',
    parts: [
      { d: `M 50 84 C 50 62 50 52 50 42`, stroke: SSAGE, w: 7 },
      { d: `M 50 62 C 38 62 30 56 28 48 C 40 46 48 52 50 62 Z`, fill: SSAGE },
      { d: circle(50, 30, 10), fill: WARM },
      { d: circle(36, 38, 10), fill: CREAM },
      { d: circle(64, 38, 10), fill: CREAM },
      { d: circle(50, 42, 8), fill: GOLD }
    ],
    lines: []
  },

  /* --- new home. Roof, body, door, and a heart where a window
     would be, which is the whole brand in one substitution. */
  'occ-new-home': {
    label: 'New home',
    parts: [
      { d: `M 50 14 L 90 48 L 10 48 Z`, fill: RED },
      { d: rr(20, 48, 60, 34, 2), fill: CREAM },
      { d: rr(43, 58, 14, 24, 1), fill: GOLD },
      { d: heart(31, 60, 18), fill: RED }
    ],
    lines: []
  },

  /* --- congratulations. A burst and four bits of confetti, which
     is the loudest a category glyph is allowed to be. */
  'occ-congrats': {
    label: 'Congratulations',
    parts: [
      { d: `M 50 16 L 58 36 L 80 32 L 66 50 L 84 62 L 62 64 L 64 84 L 50 70 L 36 84 L 38 64 L 16 62 L 34 50 L 20 32 L 42 36 Z`, fill: AMBER },
      { d: heart(50, 50, 26), fill: RED },
      { d: rr(12, 16, 9, 6, 1), fill: CORAL },
      { d: rr(80, 18, 9, 6, 1), fill: GREEN },
      { d: rr(84, 80, 9, 6, 1), fill: SPINK },
      { d: rr(10, 78, 9, 6, 1), fill: BRAND.blue }
    ],
    lines: []
  }
};

/* the rest of the set lives in categories-rich-2.js purely so no
   single file is 900 lines of path data. Callers see one table. */
Object.assign(CATEGORY_RICH, CATEGORY_RICH_2);

export const CATEGORY_RICH_NAMES = Object.keys(CATEGORY_RICH);
export default CATEGORY_RICH;
