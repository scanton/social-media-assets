/* ============================================================
   POP KIT - OBJECT ILLUSTRATIONS
   ------------------------------------------------------------
   The monoline object glyphs were built for the wrong job. A
   monoline icon is a UI mark: it belongs in a filter chip, a
   category rail, a 44px medallion in a lower third. Put one in a
   paid social ad and it reads as a wireframe, because that is
   what it is.

   This is the same fourteen objects drawn the way the HAND
   GESTURES are drawn, which is already our house illustration
   style and the only drawing language in the kit that has ever
   survived a feed:

     flat brand-colour fills, no gradients
     heavy ink keyline on every part, including internal seams
     a fat cream outline round the whole silhouette
     one hard offset ink slab, never a blur

   That gives an object that is a sticker at 1024 and still a
   readable shape at 44, which a monoline icon is not and a
   photograph is not either.

   TWO TIERS, SAME NAMES
   Both sets ship. `glyphs-objects.js` is the UI tier, this is the
   social tier, and the names match, so a component can swap on
   size or on surface without the caller knowing.

   HOW A PART LIST WORKS
   An object is an ordered back-to-front list of closed paths.
   Layering does the rest: every part gets a fat cream stroke in
   one pass, then every part is filled and ink-stroked in a second
   pass. The fills in pass two cover the cream inside the
   silhouette, so only the outer halo survives, and every internal
   seam keeps its own keyline. No path union anywhere.
   ============================================================ */

import { BRAND } from './tokens.js';

const INK = BRAND.ink;
const RED = BRAND.red;
const DEEPRED = '#8A1420';
const CREAM = BRAND.cream;
const WARM = '#E4D6C4';
const SHADE = '#CFBEA8';
const GOLD = BRAND.gold;
const DEEPGOLD = '#947C43';

const f = n => Math.round(n * 100) / 100;

/* rounded rectangle, quadratic corners */
function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M ${f(x + r)} ${f(y)} L ${f(x + w - r)} ${f(y)} Q ${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)} `
       + `L ${f(x + w)} ${f(y + h - r)} Q ${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} `
       + `L ${f(x + r)} ${f(y + h)} Q ${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)} `
       + `L ${f(x)} ${f(y + r)} Q ${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Z`;
}

/* the brand heart, at any centre and size. Used enough times in
   here to be worth having once. */
function heart(cx, cy, s) {
  const u = s / 100;
  const P = (x, y) => `${f(cx + (x - 50) * u)} ${f(cy + (y - 52) * u)}`;
  return `M ${P(50, 93)} C ${P(20, 71)} ${P(3, 53)} ${P(3, 34)} C ${P(3, 17)} ${P(15, 6)} ${P(29, 6)} `
       + `C ${P(39, 6)} ${P(46, 12)} ${P(50, 21)} C ${P(54, 12)} ${P(61, 6)} ${P(71, 6)} `
       + `C ${P(85, 6)} ${P(97, 17)} ${P(97, 34)} C ${P(97, 53)} ${P(80, 71)} ${P(50, 93)} Z`;
}


/* a perforated rectangle, the scalloped edge that makes a shape
   read as a postage stamp rather than a card. Semicircular bites
   are cut OUT of the silhouette on all four sides, which means
   the keyline and the cream halo follow the scallops for free.
   n is bites per side; it is forced odd so a bite, not a flat,
   lands at the midpoint of each edge. */
function perfRect(x, y, w, h, r = 3.2) {
  const nx = 9, ny = 9;
  const sx = w / nx, sy = h / ny;
  const p = [];
  p.push(`M ${f(x)} ${f(y)}`);
  for (let i = 0; i < nx; i++) {
    const a = x + i * sx, b = a + sx;
    p.push(`L ${f(a + (sx / 2 - r))} ${f(y)}`);
    p.push(`A ${f(r)} ${f(r)} 0 0 0 ${f(a + (sx / 2 + r))} ${f(y)}`);
    p.push(`L ${f(b)} ${f(y)}`);
  }
  for (let i = 0; i < ny; i++) {
    const a = y + i * sy, b = a + sy;
    p.push(`L ${f(x + w)} ${f(a + (sy / 2 - r))}`);
    p.push(`A ${f(r)} ${f(r)} 0 0 0 ${f(x + w)} ${f(a + (sy / 2 + r))}`);
    p.push(`L ${f(x + w)} ${f(b)}`);
  }
  for (let i = 0; i < nx; i++) {
    const a = x + w - i * sx, b = a - sx;
    p.push(`L ${f(a - (sx / 2 - r))} ${f(y + h)}`);
    p.push(`A ${f(r)} ${f(r)} 0 0 0 ${f(a - (sx / 2 + r))} ${f(y + h)}`);
    p.push(`L ${f(b)} ${f(y + h)}`);
  }
  for (let i = 0; i < ny; i++) {
    const a = y + h - i * sy, b = a - sy;
    p.push(`L ${f(x)} ${f(a - (sy / 2 - r))}`);
    p.push(`A ${f(r)} ${f(r)} 0 0 0 ${f(x)} ${f(a - (sy / 2 + r))}`);
    p.push(`L ${f(x)} ${f(b)}`);
  }
  return p.join(' ') + ' Z';
}

/* ============================================================
   THE OBJECTS
   parts  back to front, each { d, fill }
   lines  interior detail, stroked in ink, drawn last
   dots   small solid marks, drawn last
   ============================================================ */
export const OBJECTS = {

  /* --- the 6x9 mailer, closed. Landscape body, darker tear band
     across the top with its pull dots at the left, dashed
     perforation under it, heart mark on the face. */
  'obj-mailer': {
    label: 'Mailer, closed',
    parts: [
      { d: rr(7, 25, 86, 50, 5), fill: RED },
      /* the tear band. Three round dots along it made the whole
         thing read as a browser window, which is the single most
         embarrassing thing an object glyph can do, so the pull is
         a TAB sticking out of the left end instead. */
      { d: `M 12 25 L 88 25 Q 93 25 93 30 L 93 36 L 7 36 L 7 30 Q 7 25 12 25 Z`, fill: DEEPRED },
      { d: `M 4 27 L 14 27 L 14 34 L 4 34 L 8 30.5 Z`, fill: CREAM },
      { d: heart(50, 56, 28), fill: CREAM }
    ],
    lines: ['M 12 36 L 88 36'],
    dash: '4 4'
  },

  /* --- the mailer with the strip pulled and the message showing.
     The reveal is the product moment, so the inside panel is the
     brightest thing in the drawing. */
  'obj-mailer-open': {
    label: 'Mailer, open',
    parts: [
      { d: `M 7 36 L 93 36 L 93 70 Q 93 75 88 75 L 12 75 Q 7 75 7 70 Z`, fill: RED },
      { d: `M 7 36 L 16 20 L 84 20 L 93 36 Z`, fill: DEEPRED },
      { d: rr(20, 44, 60, 24, 3), fill: CREAM },
      { d: heart(29, 56, 13), fill: RED }
    ],
    lines: ['M 38 51 L 72 51', 'M 38 61 L 64 61']
  },

  /* --- a greeting card standing open. THE product object, so
     everything else in the set defers to it. */
  'obj-card-open': {
    label: 'Card, open',
    parts: [
      { d: `M 50 20 L 15 32 L 15 78 L 50 66 Z`, fill: CREAM },
      { d: `M 50 20 L 85 32 L 85 78 L 50 66 Z`, fill: WARM },
      { d: heart(67, 50, 22), fill: RED }
    ],
    lines: ['M 50 20 L 50 66', 'M 23 44 L 42 38', 'M 23 54 L 42 48', 'M 23 64 L 36 59']
  },

  /* --- the inside print, which is the thing almost nobody else
     does and therefore the thing worth drawing properly. */
  'obj-card-inside': {
    label: 'Card, inside printed',
    parts: [
      { d: rr(12, 22, 76, 56, 3), fill: CREAM },
      { d: `M 50 22 L 88 22 L 88 78 L 50 78 Z`, fill: WARM },
      { d: heart(30, 46, 26), fill: RED }
    ],
    lines: ['M 50 22 L 50 78', 'M 58 38 L 80 38', 'M 58 48 L 80 48', 'M 58 58 L 72 58']
  },

  /* --- more than one. Range, library, bundle, HeartCredits. */
  'obj-card-stack': {
    label: 'Card, stack',
    parts: [
      { d: rr(30, 14, 46, 58, 3), fill: SHADE },
      { d: rr(22, 20, 46, 58, 3), fill: WARM },
      { d: rr(14, 26, 46, 58, 3), fill: CREAM },
      { d: heart(37, 50, 24), fill: RED }
    ],
    lines: []
  },

  /* --- the envelope we actually ship. A euro flap is a DEEP
     pointed flap, and that depth is the only thing separating it
     from every other envelope drawing in the world. */
  'obj-envelope-euro': {
    label: 'Envelope, euro flap',
    parts: [
      { d: rr(8, 28, 84, 46, 4), fill: CREAM },
      { d: `M 12 28 L 88 28 Q 92 28 92 32 L 50 66 L 8 32 Q 8 28 12 28 Z`, fill: WARM }
    ],
    lines: ['M 8 70 L 33 50', 'M 92 70 L 67 50']
  },

  /* --- posted. Same envelope, stamp on the corner, postmark
     arcs running off it. */
  'obj-envelope-stamp': {
    label: 'Envelope, stamped',
    parts: [
      { d: rr(6, 32, 78, 44, 4), fill: CREAM },
      { d: `M 10 32 L 80 32 Q 84 32 84 36 L 45 62 L 6 36 Q 6 32 10 32 Z`, fill: WARM },
      { d: rr(64, 12, 30, 30, 2), fill: CREAM },
      { d: heart(79, 27, 19), fill: RED }
    ],
    lines: ['M 6 72 L 26 56', 'M 52 20 C 56 24 56 32 52 36', 'M 46 22 C 49 25 49 31 46 34']
  },

  /* --- postage. Four still joined, perforations as dashes
     because bites at this size turn to fuzz. */
  'obj-stamp-sheet': {
    label: 'Stamp sheet',
    parts: [
      /* the scalloped edge is the whole point. Without it this is a
         window pane, which is what the team said it read as. */
      { d: perfRect(14, 14, 72, 72, 3.4), fill: CREAM },
      { d: `M 50 17 L 83 17 L 83 50 L 50 50 Z`, fill: WARM },
      { d: `M 17 50 L 50 50 L 50 83 L 17 83 Z`, fill: WARM },
      { d: heart(33.5, 33.5, 21), fill: RED },
      { d: heart(66.5, 66.5, 21), fill: RED },
      { d: heart(66.5, 33.5, 15), fill: DEEPRED },
      { d: heart(33.5, 66.5, 15), fill: DEEPRED }
    ],
    lines: ['M 50 17 L 50 83', 'M 17 50 L 83 50'],
    dash: '3.2 4.4'
  },

  /* --- arrival. Flag up, because the flag is the only part
     anyone reads at small size. */
  'obj-mailbox': {
    label: 'Mailbox',
    parts: [
      { d: `M 14 48 C 14 34 26 25 40 25 L 70 25 C 56 25 45 34 45 48 L 45 72 L 14 72 Z`, fill: CREAM },
      { d: `M 45 25 L 70 25 C 84 25 95 34 95 48 L 95 72 L 45 72 Z`, fill: WARM },
      { d: `M 88 46 L 88 10 L 68 10 L 68 24 L 88 24 Z`, fill: RED },
      { d: rr(40, 72, 24, 15, 2), fill: SHADE },
      { d: heart(70, 50, 20), fill: RED }
    ],
    lines: ['M 22 42 L 38 42']
  },

  /* --- delivery. The cab wedge is what stops a van reading as a
     bus, so it is drawn hard. */
  'obj-van': {
    label: 'Delivery van',
    parts: [
      { d: rr(6, 30, 52, 36, 3), fill: CREAM },
      { d: `M 58 38 L 74 38 L 90 54 L 90 66 L 58 66 Z`, fill: WARM },
      { d: rr(62, 42, 14, 11, 2), fill: SHADE },
      { d: heart(30, 47, 22), fill: RED },
      { d: `M 22 66 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0 Z`, fill: INK },
      { d: `M 74 66 m -10 0 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0 Z`, fill: INK },
      { d: `M 22 66 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0 Z`, fill: CREAM },
      { d: `M 74 66 m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0 Z`, fill: CREAM }
    ],
    lines: []
  },

  /* --- the gifting add-on. Box, lid, ribbon down the face, and a
     bow that is two loops and a knot rather than a squiggle. */
  'obj-gift': {
    label: 'Gift box',
    parts: [
      { d: rr(14, 42, 72, 38, 3), fill: CREAM },
      { d: rr(10, 30, 80, 14, 3), fill: GOLD },
      { d: `M 44 44 L 56 44 L 56 80 L 44 80 Z`, fill: GOLD },
      { d: `M 50 30 C 36 12 16 10 13 20 C 11 28 26 33 50 30 Z`, fill: GOLD },
      { d: `M 50 30 C 64 12 84 10 87 20 C 89 28 74 33 50 30 Z`, fill: GOLD },
      { d: `M 50 24 m -7 0 a 7 6 0 1 0 14 0 a 7 6 0 1 0 -14 0 Z`, fill: DEEPGOLD }
    ],
    lines: ['M 10 44 L 90 44']
  },

  /* --- Digital cards. A phone with a card ON it, because a phone
     with an empty screen is a rounded rectangle. */
  'obj-iphone-card': {
    label: 'Phone, card on screen',
    parts: [
      { d: rr(29, 8, 42, 84, 10), fill: INK },
      { d: rr(33, 13, 34, 74, 7), fill: CREAM },
      { d: rr(38, 28, 24, 34, 3), fill: RED },
      { d: heart(50, 45, 17), fill: CREAM },
      { d: rr(43, 15, 14, 4, 2), fill: INK }
    ],
    lines: ['M 44 78 L 56 78']
  },

  /* --- the app on a phone, empty screen, for anything about the
     editor rather than the card. */
  'obj-iphone': {
    label: 'Phone',
    parts: [
      { d: rr(31, 8, 38, 84, 10), fill: INK },
      { d: rr(35, 13, 30, 74, 7), fill: CREAM },
      { d: rr(43, 15, 14, 4, 2), fill: INK },
      { d: heart(50, 46, 22), fill: RED }
    ],
    lines: ['M 44 79 L 56 79']
  },

  /* --- desktop web, the studio. A laptop is the lid wedge plus
     the base slab, and the base is what sells it. */
  'obj-macbook': {
    label: 'Laptop',
    parts: [
      { d: rr(20, 18, 60, 44, 3), fill: INK },
      { d: rr(24, 22, 52, 33, 1.5), fill: CREAM },
      { d: `M 8 64 L 92 64 L 86 78 L 14 78 Z`, fill: WARM },
      { d: heart(50, 38, 20), fill: RED }
    ],
    lines: ['M 42 68 L 58 68']
  },

  /* --- written by you. The nib is the tell, so the barrel is
     short and the nib is long. */
  'obj-pen': {
    label: 'Pen',
    parts: [
      { d: `M 18 82 L 23 64 L 63 24 L 76 37 L 36 77 Z`, fill: CREAM },
      { d: `M 18 82 L 27 78 L 23 64 Z`, fill: INK },
      { d: `M 63 24 L 70 17 Q 76 11 82 17 L 83 18 Q 89 24 83 30 L 76 37 Z`, fill: GOLD }
    ],
    lines: ['M 57 30 L 70 43']
  }
};

export const OBJECT_RICH_NAMES = Object.keys(OBJECTS);

/* ============================================================
   RENDER
   ============================================================ */
export function objectSvg(name, {
  size = 512, ink = INK, cream = CREAM, key = 3.0, halo = 5.5,
  slab = true, sx = 2.8, sy = 3.6, pad = 10, tint = null
} = {}) {
  const o = OBJECTS[name];
  if (!o) throw new Error('no object ' + name);

  /* a tint recolours every brand-red part in one go, so the same
     drawing can be red for the house look and gold for premium
     without a second copy of the artwork */
  const px = p => (tint && p.fill === RED ? tint : p.fill);

  /* A part is normally a filled shape. It can instead be a STROKED
     shape, `{ d, stroke, w }`, which is the only way to draw a ring,
     a wreath, a balloon string or anything else with a genuine hole
     in it without knowing what colour is behind it. Same three
     passes either way. */
  const isStroke = p => !!p.stroke;
  const cap = 'round';
  const asSlab = p => isStroke(p)
    ? `<path d="${p.d}" fill="none" stroke="${ink}" stroke-width="${f(p.w + key)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`
    : `<path d="${p.d}" fill="${ink}" stroke="${ink}" stroke-width="${key}" stroke-linejoin="round"/>`;
  const asHalo = p => isStroke(p)
    ? `<path d="${p.d}" fill="none" stroke="${cream}" stroke-width="${f(p.w + key + halo * 2)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`
    : `<path d="${p.d}" fill="none" stroke="${cream}" stroke-width="${f(key + halo * 2)}" stroke-linejoin="round"/>`;
  const asBody = p => isStroke(p)
    ? `<path d="${p.d}" fill="none" stroke="${ink}" stroke-width="${f(p.w + key)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`
      + `<path d="${p.d}" fill="none" stroke="${tint && p.stroke === RED ? tint : p.stroke}" stroke-width="${f(p.w)}" stroke-linecap="${cap}" stroke-linejoin="round"/>`
    : `<path d="${p.d}" fill="${px(p)}" stroke="${ink}" stroke-width="${key}" stroke-linejoin="round"/>`;

  const slabG = slab ? `<g transform="translate(${sx},${sy})">${o.parts.map(asSlab).join('')}</g>` : '';

  /* pass one: the fat cream halo round the whole silhouette */
  const haloG = o.parts.map(asHalo).join('\n');

  /* pass two: fill and keyline, back to front. The fills cover the
     halo inside the silhouette, so only the outer ring survives,
     and every internal seam keeps its own keyline. */
  const bodyG = o.parts.map(asBody).join('\n');

  const lineG = (o.lines || []).map(d =>
    `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${f(key * 0.85)}" stroke-linecap="round"${
      o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`).join('\n');

  const dotG = (o.dots || []).map(([x, y, r]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${o.dotFill || ink}" stroke="${ink}" stroke-width="${f(key * 0.7)}"/>`).join('\n');

  const V = 100 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
   viewBox="${-pad} ${-pad} ${V} ${V}" fill="none">
${slabG}
${haloG}
${bodyG}
${lineG}
${dotG}
</svg>`;
}

export default OBJECTS;
