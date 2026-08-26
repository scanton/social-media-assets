/* ============================================================
   HeartStamp POP KIT - ARROWS, build two
   ------------------------------------------------------------
   The first arrow set was correct and dull. Six shapes, all
   axis-aligned, all the same weight, all the same silhouette
   logic. Correct is not the job. The job is that an arrow is the
   second sentence in the annotation, and a second sentence has a
   TONE.

   So this set is organised by tone, not by geometry:

     A  cursor    someone is driving. The most human mark we own,
                  because it implies a hand on a mouse.
     B  solid     the shout. Chunky, confident, unmissable.
     C  leader    the long reach. Gets across the frame without
                  crossing the subject's face.
     D  hand      drawn, not placed. Warm, imperfect, apologetic.
     E  motion    energy rather than direction. Chase and impact.
     F  editorial quiet. Small, precise, typographic.

   EVERY ARROW DECLARES ITS BEARING
   An arrow is authored in whatever direction is natural to draw
   it, and states which way that is. Aiming is then one rotation
   about the TIP, so the point lands exactly where you asked and
   the tail swings out of the way. No arrow needs a mirrored twin
   and no arrow needs to be redrawn to face a new direction.

   EVERY ARROW TAKES A REGISTER
   sticker, chrome, letterpress. Same geometry, three eras. See
   finish.js for why all three exist.
   ============================================================ */

import { BRAND } from './tokens.js';
import { flatten } from './frames.js';
import { dress, shade, uid, W as FW } from './finish.js';

const INK = BRAND.ink;
const f = n => Math.round(n * 100) / 100;

/* triangular head with the tip at (x,y), aimed along ang degrees
   where 0 is east. Curved arrows use this so the head sits on the
   real end tangent instead of a guessed angle. */
export function headAt(x, y, ang, size = 34, sweep = 0.62) {
  const a = (ang * Math.PI) / 180;
  const bx = x - Math.cos(a) * size, by = y - Math.sin(a) * size;
  const nx = -Math.sin(a) * size * sweep, ny = Math.cos(a) * size * sweep;
  return `M ${f(x)} ${f(y)} L ${f(bx + nx)} ${f(by + ny)} L ${f(bx - nx)} ${f(by - ny)} Z`;
}

/* ============================================================
   THE SET
   vb      [w,h] of the authoring box
   bearing the compass direction the arrow points as drawn
           (0 up, 90 right, 180 down, 270 left)
   tip     the point that lands on the target
   kind    'fill'  one closed path, dressed like a frame
           'stroke' a spine plus a head, dressed as linework
   ============================================================ */
export const ARROWS = {

  /* ---------- A. CURSOR ------------------------------------ */

  /* A01. The mark that says a person is doing this, not a system.
     Authored up-left because that is the only orientation anyone
     has ever seen it in. */
  cursor: {
    fam: 'A', label: 'Cursor', vb: [100, 100], bearing: 315, tip: [7, 5], kind: 'fill',
    d: 'M 7 5 L 7 79 L 26 61 L 39 93 L 56 86 L 43 55 L 68 55 Z',
    use: 'Someone is driving. Default pointer for product and tutorial.'
  },

  /* A02. Same idea, fatter, so it still reads under a caption at
     44px where the classic goes to a smudge. */
  cursorFat: {
    fam: 'A', label: 'Cursor, fat', vb: [100, 100], bearing: 315, tip: [8, 6], kind: 'fill',
    d: 'M 8 6 L 8 74 L 30 56 L 45 88 L 66 79 L 51 49 L 76 46 Z',
    use: 'The cursor at small sizes and on busy footage.'
  },

  /* A03. Cursor mid-drag. Two trailing pips read as movement
     without committing to a motion line. */
  cursorDrag: {
    fam: 'A', label: 'Cursor, dragging', vb: [130, 130], bearing: 315, tip: [8, 6], kind: 'fill',
    d: 'M 8 6 L 8 74 L 30 56 L 45 88 L 66 79 L 51 49 L 76 46 Z '
     + 'M 84 62 L 100 56 L 106 72 L 90 78 Z M 104 88 L 116 84 L 120 96 L 108 100 Z',
    use: 'Mid-drag. Reordering, swiping, moving a card in the editor.'
  },

  /* A04. Cursor with a click ring. The tap beat. */
  cursorTap: {
    fam: 'A', label: 'Cursor, tapping', vb: [130, 130], bearing: 315, tip: [26, 24], kind: 'stroke',
    spine: 'M 80.37 32.74 A 45 45 0 0 0 63.39 21.71 M 94.73 24.79 A 61 61 0 0 0 63.79 5.08',
    head: 'M 26 24 L 26 92 L 48 74 L 63 106 L 84 97 L 69 67 L 94 64 Z',
    weight: 7, cap: 'round',
    use: 'The tap. Cursor plus two impact arcs, the confirm beat.'
  },

  /* ---------- B. SOLID ------------------------------------- */

  /* B01. The workhorse. Shaft tapers into the head so it reads as
     one gesture rather than a stick with a hat on. */
  dart: {
    fam: 'B', label: 'Dart', vb: [130, 100], bearing: 90, tip: [130, 50], kind: 'fill',
    d: 'M 6 40 L 66 34 L 66 16 L 130 50 L 66 84 L 66 66 L 6 60 Z',
    use: 'The default arrow. Use it unless there is a reason not to.'
  },

  /* B02. No shaft at all. The loudest thing in the set and the
     one that survives being 30px wide. */
  wedge: {
    fam: 'B', label: 'Wedge', vb: [100, 100], bearing: 90, tip: [100, 50], kind: 'fill',
    d: 'M 2 6 L 100 50 L 2 94 L 24 50 Z',
    use: 'Loudest mark we own. Reveals, price drops, punchlines.'
  },

  /* B03. Rounded shaft with a domed cap. Reads as an object
     rather than a symbol, which is why the reference frames use
     it when the arrow is the joke. */
  tube: {
    fam: 'B', label: 'Tube', vb: [125, 100], bearing: 90, tip: [125, 50], kind: 'fill',
    d: 'M 64 10 L 125 50 L 64 90 L 64 70 L 28 70 Q 6 70 6 50 Q 6 30 28 30 L 64 30 Z',
    use: 'When the arrow is the joke. Physical, three-dimensional.'
  },

  /* B04. Long taper to a fine point. The precise one. */
  blade: {
    fam: 'B', label: 'Blade', vb: [160, 100], bearing: 90, tip: [160, 50], kind: 'fill',
    d: 'M 4 44 L 108 22 L 108 6 L 160 50 L 108 94 L 108 78 L 4 56 Z',
    use: 'Precision. Pointing at one word, one pixel, one detail.'
  },

  /* B05. Short and fat. For the gap between a medallion and the
     thing it is about, where a long arrow would not fit. */
  nub: {
    fam: 'B', label: 'Nub', vb: [72, 100], bearing: 90, tip: [72, 50], kind: 'fill',
    d: 'M 4 34 L 30 34 L 30 12 L 72 50 L 30 88 L 30 66 L 4 66 Z',
    use: 'Tight spaces. Medallion to subject, one hop.'
  },

  /* B06. Swept barbs and a concave back. Hand-cut, not drafted. */
  barb: {
    fam: 'B', label: 'Barb', vb: [125, 100], bearing: 90, tip: [125, 50], kind: 'fill',
    d: 'M 125 50 L 50 4 Q 66 40 42 44 L 4 44 L 4 56 L 42 56 Q 66 60 50 96 Z',
    use: 'Character over clarity. Editorial, snark, running gags.'
  },

  /* B07. The dart, split down the diagonal into two brand
     colours. The reference frames do this and it is the cheapest
     way to stop an arrow looking like clip art. */
  splitDart: {
    fam: 'B', label: 'Dart, split fill', vb: [130, 100], bearing: 90, tip: [130, 50], kind: 'fill',
    d: 'M 6 40 L 66 34 L 66 16 L 130 50 L 66 84 L 66 66 L 6 60 Z',
    split: 'M -12 96 L 152 6 L 152 -60 L -12 -60 Z',
    use: 'Two-tone. Stops an arrow reading as clip art.'
  },

  /* ---------- C. LEADER ------------------------------------ */

  /* C01. Straight and long. */
  leader: {
    fam: 'C', label: 'Leader', vb: [210, 80], bearing: 90, tip: [210, 40], kind: 'fill',
    d: 'M 4 30 L 148 30 L 148 8 L 210 40 L 148 72 L 148 50 L 4 50 Z',
    use: 'Distance in a straight line. Caption on one side, subject on the other.'
  },

  /* C02. Turns a corner. Use when a straight leader would cross a
     face, which it will, because faces are in the middle. */
  elbow: {
    fam: 'C', label: 'Elbow', vb: [150, 140], bearing: 90, tip: [150, 96], kind: 'fill',
    d: 'M 10 6 L 40 6 L 40 82 L 100 82 L 100 60 L 150 96 L 100 132 L 100 110 L 10 110 Z',
    use: 'Goes around the subject instead of across them.'
  },

  /* C03. Quarter turn, drawn as a curve. Softer than the elbow. */
  hook: {
    fam: 'C', label: 'Hook', vb: [165, 145], bearing: 90, tip: [158, 112], kind: 'stroke',
    spine: 'M 22 12 C 22 84 62 110 122 112',
    head: 'M 116 88 L 158 112 L 116 136 Z', weight: 15, cap: 'round',
    use: 'The soft turn. Sincere beats where an elbow feels clinical.'
  },

  /* C04. S-curve with a ball at the tail, so the eye knows which
     end started. Longest reach in the set. */
  swoop: {
    fam: 'C', label: 'Swoop', vb: [210, 180], bearing: 45, tip: [195.93, 14], kind: 'stroke',
    spine: 'M 25 154.59 C 61 52.59 125 158.59 177 52.59',
    head: 'M 195.93 14 L 187.7 63.3 L 161.99 50.68 Z', ball: [25, 154.59, 11], weight: 14, cap: 'round',
    use: 'Long reach across a busy frame. Ball marks the start.'
  },

  /* C05. Two steps. Reads as a route rather than a jab. */
  stair: {
    fam: 'C', label: 'Stair', vb: [185, 165], bearing: 90, tip: [178, 128], kind: 'stroke',
    spine: 'M 12 14 L 12 70 L 86 70 L 86 128 L 142 128',
    head: 'M 136 104 L 178 128 L 136 152 Z', weight: 15, cap: 'butt', join: 'miter',
    use: 'A route, not a jab. Multi-step instructions.'
  },

  /* C06. Doubles back on itself. The "no, the other one" beat. */
  loop: {
    fam: 'C', label: 'Loop', vb: [190, 175], bearing: 180, tip: [166, 168], kind: 'stroke',
    spine: 'M 18 162 L 18 84 C 18 40 54 16 96 16 C 138 16 166 42 166 84 L 166 120',
    head: 'M 142 118 L 166 168 L 190 118 Z', weight: 15, cap: 'round',
    use: 'Doubles back. Corrections, callbacks, the running gag.'
  },

  /* C07. Curls before it commits. The most characterful leader we
     have and the one to reach for when the copy is teasing. */
  pigtail: {
    fam: 'C', label: 'Pigtail', vb: [191, 157], bearing: 45, tip: [172.58, 143.94], kind: 'stroke',
    spine: 'M 13 26 C 67 26 105 42 105 76 C 105 100 81 110 69 96 C 57 82 75 62 105 66 C 137 70 151 90 159 110',
    head: 'M 172.58 143.94 L 136.76 114 L 177.86 97.55 Z', weight: 13, cap: 'round',
    use: 'Teasing copy. Curls before it commits.'
  },

  /* ---------- D. HAND -------------------------------------- */

  /* D01. One marker stroke, thick to thin. */
  brush: {
    fam: 'D', label: 'Brush', vb: [250, 120], bearing: 90, tip: [248, 50], kind: 'fill',
    d: 'M 8 100 C 62 48 132 26 196 36 L 184 8 L 248 50 L 182 82 L 194 54 C 134 46 74 64 26 110 Z',
    use: 'Loosest mark in the set. Where a chunky arrow feels like a diagram.'
  },

  /* D02. Scribbled, then aimed. Underlines and points in one. */
  scrawl: {
    fam: 'D', label: 'Scrawl', vb: [276, 104], bearing: 90, tip: [263.55, 63.89], kind: 'stroke',
    spine: 'M 12 67.18 C 62 29.18 104 91.18 152 53.18 C 176 35.18 190 49.18 200 51.18',
    head: 'M 263.55 63.89 L 188.21 88.71 L 203.55 12 Z', weight: 12, cap: 'round',
    use: 'Underline and aim in one mark. Handwritten register.'
  },

  /* D03. Open, two-stroke, no fill. A pen sketch, and the only
     arrow here that does not shout. */
  sketch: {
    fam: 'D', label: 'Sketch', vb: [200, 110], bearing: 90, tip: [190, 55], kind: 'stroke',
    spine: 'M 10 58 C 70 50 130 52 184 55 M 148 26 L 190 55 L 148 84',
    head: null, weight: 11, cap: 'round', open: true,
    use: 'Quiet. Notes, annotations, the sincere register.'
  },

  /* D04. Dashed leader with a ball at the start. Says "this thing,
     over here" without drawing a line through the middle. */
  dashLeader: {
    fam: 'D', label: 'Dashed leader', vb: [230, 100], bearing: 90, tip: [222, 50], kind: 'stroke',
    spine: 'M 16 50 L 178 50', head: 'M 172 24 L 222 50 L 172 76 Z',
    ball: [16, 50, 12], weight: 10, cap: 'round', dash: [2, 26],
    use: 'Connects without drawing a line through the subject.'
  },

  /* D05. Ring the thing. The only mark in the kit that is placed
     by its CENTRE rather than its tip, because a lasso does not
     point at a subject, it surrounds one. The composer knows this
     from `centred` and skips the rotation. */
  lasso: {
    fam: 'D', label: 'Lasso', vb: [232, 196], bearing: 90, tip: [113, 96], kind: 'stroke', centred: true,
    spine: 'M 120 20 C 180 18 218 56 218 96 C 218 140 170 172 110 172 C 52 172 10 138 10 96 C 10 54 54 20 114 18 C 152 18 184 30 206 52',
    head: null, weight: 13, cap: 'round', open: true,
    use: 'Surrounds the subject instead of pointing at it. Centred, never rotated.'
  },

  /* ---------- E. MOTION ------------------------------------ */

  /* E01. Three chevrons, falling weight. Direction without a
     single target, and it animates as a chase. */
  chevrons: {
    fam: 'E', label: 'Chevrons', vb: [190, 110], bearing: 90, tip: [186, 55], kind: 'fill',
    d: 'M 10 12 L 58 55 L 10 98 L 10 70 L 26 55 L 10 40 Z '
     + 'M 68 12 L 116 55 L 68 98 L 68 70 L 84 55 L 68 40 Z '
     + 'M 126 12 L 174 55 L 126 98 L 126 70 L 142 55 L 126 40 Z',
    use: 'Direction with no single target. Animates as a chase.'
  },

  /* E02. Not an arrow, an impact. Fires on the beat and points by
     accident, which is exactly the right amount of pointing. */
  bolt: {
    fam: 'E', label: 'Bolt', vb: [110, 140], bearing: 180, tip: [42, 136], kind: 'fill',
    d: 'M 74 4 L 14 74 L 52 74 L 30 136 L 100 56 L 58 56 Z',
    use: 'Impact, not direction. Fires on the beat.'
  },

  /* E03. Dart with speed lines struck off the back. */
  speed: {
    fam: 'E', label: 'Speed', vb: [200, 110], bearing: 90, tip: [196, 55], kind: 'fill',
    d: 'M 72 45 L 132 39 L 132 21 L 196 55 L 132 89 L 132 71 L 72 65 Z '
     + 'M 0 28 L 58 22 L 58 36 L 4 42 Z M 16 50 L 60 46 L 60 60 L 20 64 Z '
     + 'M 2 78 L 58 70 L 58 84 L 6 92 Z',
    use: 'Arrival. Something just landed, fast.'
  },

  /* E04. A bent V. Comes back at you. */
  boomerang: {
    fam: 'E', label: 'Boomerang', vb: [180, 172], bearing: 150, tip: [140, 164], kind: 'fill',
    d: 'M 10 14 C 84 18 132 64 144 116 L 172 106 L 140 164 L 96 124 L 122 114 '
     + 'C 110 74 74 44 12 44 Z',
    use: 'Returns. Comparisons and callbacks.'
  },

  /* E05. Winds in to a point. Attention landing on one spot. */
  spiral: {
    fam: 'E', label: 'Spiral', vb: [178, 178], bearing: 90, tip: [128, 122], kind: 'stroke',
    spine: 'M 168 88 C 168 44 132 10 88 10 C 44 10 10 44 10 88 C 10 130 42 162 84 162 C 120 162 146 136 146 102 C 146 74 126 54 100 54 C 78 54 62 70 62 92 C 62 108 74 120 88 120',
    head: 'M 94 96 L 128 122 L 94 148 Z', weight: 12, cap: 'round',
    use: 'Attention winding down onto one spot.'
  },

  /* ---------- F. EDITORIAL --------------------------------- */

  /* F01. A banner that ends in a point. Carries a short label,
     drawn by the caption layer, never baked in. */
  ribbon: {
    fam: 'F', label: 'Ribbon', vb: [230, 90], bearing: 90, tip: [228, 45], kind: 'fill',
    d: 'M 4 8 L 168 8 L 228 45 L 168 82 L 4 82 L 34 45 Z',
    use: 'Takes a word inside it. Kickers, prices, credits.'
  },

  /* F02. Bracket the span, tick the point. The measurement mark. */
  bracketTick: {
    fam: 'F', label: 'Bracket and tick', vb: [220, 120], bearing: 180, tip: [110, 112], kind: 'stroke',
    spine: 'M 10 20 L 10 56 M 10 56 L 210 56 M 210 20 L 210 56 M 110 56 L 110 92',
    head: 'M 88 88 L 110 116 L 132 88 Z', weight: 11, cap: 'round', join: 'miter',
    use: 'Measures a span and points at its middle. Specs and sizes.'
  },

  /* F03. The smallest mark in the kit. A footnote that aims. */
  caret: {
    fam: 'F', label: 'Caret', vb: [70, 60], bearing: 0, tip: [35, 4], kind: 'fill',
    d: 'M 35 4 L 68 52 L 47 52 L 35 32 L 23 52 L 2 52 Z',
    use: 'The smallest mark we have. Footnotes and inline asides.'
  },

  /* F04. Rotational. Flip it, turn it, open it. Which is a card. */
  arc: {
    fam: 'F', label: 'Arc', vb: [201, 142], bearing: 45, tip: [186.47, 47.77], kind: 'stroke',
    spine: 'M 14 127.6 C 22 61.6 76 23.6 140 37.6',
    head: 'M 186.47 47.77 L 130.28 59.11 L 140.15 14 Z', weight: 14, cap: 'round',
    use: 'Rotation. Flip the card, turn it over, open it.'
  },

  /* F05. A pin, not an arrow. Lands on a spot and stays there,
     which is what a map or a print detail wants. */
  pin: {
    fam: 'F', label: 'Pin', vb: [100, 140], bearing: 180, tip: [50, 136], kind: 'fill',
    d: 'M 50 136 C 26 100 8 78 8 52 C 8 26 27 6 50 6 C 73 6 92 26 92 52 C 92 78 74 100 50 136 Z',
    hole: 'M 50 32 C 61 32 70 41 70 52 C 70 63 61 72 50 72 C 39 72 30 63 30 52 C 30 41 39 32 50 32 Z',
    use: 'Lands on a spot and stays. Locations, print details, map beats.'
  },

  /* F06. An underline that changes its mind and turns up into a
     head. Sits under a word inside a caption. */
  underscore: {
    fam: 'F', label: 'Underscore', vb: [232, 104], bearing: 0, tip: [198, 16.67], kind: 'stroke',
    spine: 'M 10 92 L 160 92 C 186 92 196 78 196 46',
    head: 'M 196.0 16.67 L 218.0 50.2 L 174.0 50.2 Z', weight: 12, cap: 'round',
    use: 'Underlines a word and then points up out of the caption.'
  }
};

export const ARROW_NAMES = Object.keys(ARROWS);
export const FAMILIES = {
  A: 'Cursor, someone is driving',
  B: 'Solid, the shout',
  C: 'Leader, the long reach',
  D: 'Hand, drawn not placed',
  E: 'Motion, energy over direction',
  F: 'Editorial, quiet and precise'
};

/* ============================================================
   DRESSING
   ============================================================ */

function strokeBody(a, o) {
  const ink = o.ink || INK, cream = o.cream || BRAND.cream;
  const fill = o.fill || BRAND.red;
  const reg = o.register || 'sticker';
  const w = (o.weight ?? a.weight ?? 13);
  const k = o.key ?? FW.key;
  const cap = a.cap || 'round', join = a.join || 'round';
  const dash = a.dash ? ` stroke-dasharray="${a.dash[0]} ${a.dash[1]}"` : '';
  const ballOf = c => a.ball ? `<circle cx="${a.ball[0]}" cy="${a.ball[1]}" r="${a.ball[2]}" fill="${c}"/>` : '';
  const headOf = (c, sw) => a.head
    ? `<path d="${a.head}" fill="${c}"${sw ? ` stroke="${c}" stroke-width="${sw}" stroke-linejoin="round"` : ''}/>` : '';

  const spine = (c, sw) =>
    `<path d="${a.spine}" fill="none" stroke="${c}" stroke-width="${f(sw)}" stroke-linecap="${cap}" stroke-linejoin="${join}"${dash}/>`;

  const core = [];
  /* 1 keyline pass, expanded */
  core.push(spine(ink, w + 2 * k), headOf(ink, 2 * k), a.ball ? `<circle cx="${a.ball[0]}" cy="${a.ball[1]}" r="${a.ball[2] + k}" fill="${ink}"/>` : '');
  /* 2 colour pass */
  if (reg === 'letterpress') {
    /* the quiet register is a cream body with a hairline around it,
       exactly as the letterpress frames are. Filling it with ink
       would make the arrow shout, which is the one thing this
       register exists not to do. */
    core.length = 0;
    const hair = FW.hair;
    core.push(spine(ink, w + 2 * hair), headOf(ink, 2 * hair),
              a.ball ? `<circle cx="${a.ball[0]}" cy="${a.ball[1]}" r="${a.ball[2] + hair}" fill="${ink}"/>` : '',
              spine(fill, w), a.open ? '' : headOf(fill, 0), ballOf(fill));
  } else {
    core.push(spine(fill, w), a.open ? '' : headOf(fill, 0), ballOf(fill));
  }

  const out = [];
  if (reg === 'sticker') {
    out.push(`<g transform="translate(${FW.slabX},${FW.slabY})">${spine(ink, w + 2 * k)}${headOf(ink, 2 * k)}${a.ball ? `<circle cx="${a.ball[0]}" cy="${a.ball[1]}" r="${a.ball[2] + k}" fill="${ink}"/>` : ''}</g>`);
    out.push(spine(cream, w + 2 * k + 2 * FW.sticker), headOf(cream, 2 * k + 2 * FW.sticker),
             a.ball ? `<circle cx="${a.ball[0]}" cy="${a.ball[1]}" r="${a.ball[2] + k + FW.sticker}" fill="${cream}"/>` : '');
  }
  if (reg === 'chrome') {
    const id = uid('ab');
    out.push(`<filter id="${id}" x="-30%" y="-30%" width="170%" height="170%"><feGaussianBlur stdDeviation="3"/></filter>`);
    out.push(`<g filter="url(#${id})" opacity="0.45" transform="translate(2,3)">${spine(ink, w + 2 * k)}${headOf(ink, 2 * k)}</g>`);
  }
  return out.concat(core).filter(Boolean).join('\n');
}

function fillBody(a, o) {
  const pseudo = { d: a.d, pts: flatten(a.d), core: flatten(a.d) };
  const { defs, body } = dress(pseudo, {
    register: o.register || 'sticker',
    fill: o.fill || BRAND.red,
    fill2: o.fill2,
    ink: o.ink, cream: o.cream, accent: o.accent,
    borders: o.borders
  });
  let extra = '';
  /* split fill: a second colour clipped to the silhouette along a
     diagonal, drawn over the flat fill and under the keyline. */
  if (a.split && o.fill2) {
    const cid = uid('sp');
    extra = `<clipPath id="${cid}"><path d="${a.d}"/></clipPath>
             <g clip-path="url(#${cid})"><path d="${a.split}" fill="${o.fill2}"/></g>`;
  }
  /* pin hole, knocked out in the ground colour */
  if (a.hole) extra += `<path d="${a.hole}" fill="${o.holeColor || o.cream || BRAND.cream}" stroke="${o.ink || INK}" stroke-width="${FW.hair}"/>`;
  return { defs, body: extra ? insertBeforeKeyline(body, extra) : body };
}

/* the keyline is always the last fragment dress() emits, so an
   overlay that must sit under it goes second from the end */
function insertBeforeKeyline(body, extra) {
  const parts = body.split('\n');
  let i = -1;
  parts.forEach((p, n) => { if (p.includes('fill="none"') && p.includes('stroke-width')) i = n; });
  if (i < 0) return body + '\n' + extra;
  parts.splice(i, 0, extra);
  return parts.join('\n');
}

/* ---------- public: one arrow, one standalone SVG ----------- */
export function arrowSvg(name, o = {}) {
  const a = ARROWS[name];
  if (!a) throw new Error('no arrow ' + name);
  const [w, h] = a.vb;
  const pad = o.pad ?? 16;
  const scale = (o.size || 0) ? o.size / Math.max(w, h) : 1;
  let defs = '', body = '';
  if (a.kind === 'stroke') body = strokeBody(a, o);
  else ({ defs, body } = fillBody(a, o));
  const W_ = Math.round((w + pad * 2) * (scale || 1));
  const H_ = Math.round((h + pad * 2) * (scale || 1));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W_}" height="${H_}"
   viewBox="${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}" fill="none">
  <defs>${defs}</defs>
  ${body}
</svg>`;
}

/* ---------- public: an arrow placed on a canvas -------------
   at       where the TIP lands, in canvas units
   bearing  which way it points, clock-face degrees
   size     the arrow's long dimension in canvas units
   ------------------------------------------------------------ */
export function arrowGroup(name, { at = [0, 0], bearing = 90, size = 120, ...o } = {}) {
  const a = ARROWS[name];
  if (!a) throw new Error('no arrow ' + name);
  const s = size / Math.max(a.vb[0], a.vb[1]);
  const rot = bearing - a.bearing;
  let defs = '', body = '';
  if (a.kind === 'stroke') body = strokeBody(a, o);
  else ({ defs, body } = fillBody(a, o));
  return {
    defs,
    g: `<g transform="translate(${f(at[0])},${f(at[1])}) rotate(${f(rot)}) scale(${f(s)}) translate(${f(-a.tip[0])},${f(-a.tip[1])})">
${body}
</g>`
  };
}

export default ARROWS;
