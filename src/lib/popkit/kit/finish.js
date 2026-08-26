/* ============================================================
   HeartStamp POP KIT - FINISH
   ------------------------------------------------------------
   The second of the three things a medallion is made of. FRAMES
   owns the shape. FINISH owns the border, the shadow and the
   surface. Nothing in here knows or cares which shape it is
   decorating, because everything works off the flattened outline
   that frames.js hands over.

   THREE REGISTERS
   The reference frames are two different eras arguing. The
   nineties original is chrome, bevel and silver. The modern
   imitation is a flat sticker with a fat white keyline. Copying
   either one makes us look like a tribute act, so the kit carries
   both plus the one that is actually ours, and the register is a
   parameter, not a redraw.

     sticker      loud, flat, fat cream keyline, hard ink slab.
                  The default. Survives a feed, survives 44px.
     chrome       the nostalgia wink. Gradient, inner highlight,
                  soft drop. Use once a video, never twice.
     letterpress  cream, ink hairline, gold band, no shadow.
                  Premium, sincere, investor and press.

   TREATMENTS STACK
   borders: ['slab','sticker','gold'] is a legal instruction and
   draws in the right order regardless of how it was typed. That
   ordering lives in ORDER below and is the only place it lives.
   ============================================================ */

import { BRAND } from './tokens.js';
import { inset, outset, toPath } from './frames.js';

const INK = BRAND.ink;
const f = n => Math.round(n * 100) / 100;

let _n = 0;
export const uid = (p = 'pk') => `${p}${(_n++).toString(36)}`;

/* ---- weights, in FRAME UNITS (0..100 box) -------------------
   Authoring in units rather than px is what makes a treatment
   scale correctly. 3.4u is the 6px house keyline at the 180
   lockup, and it is still the house keyline at 1024 and at 44.
   ------------------------------------------------------------ */
export const W = {
  hair:    1.3,
  key:     3.4,
  keyFat:  4.6,
  sticker: 7.0,
  gold:    2.3,
  goldIn:  3.4,          // how far the gold band sits inside the edge
  double:  1.8,
  doubleIn:6.4,
  stitch:  1.5,
  stitchIn:7.2,
  gap:     2.0,
  gapOut:  4.6,
  slabX:   3.2,
  slabY:   4.0,
  dropB:   3.0,
  glowB:   5.0
};

/* ---- register defaults ------------------------------------- */
export const REGISTERS = {
  sticker:     { borders: ['slab', 'sticker', 'key'],        fillMode: 'flat' },
  chrome:      { borders: ['drop', 'key', 'emboss'],          fillMode: 'gradient' },
  letterpress: { borders: ['hair', 'gold'],                   fillMode: 'flat' },
  flat:        { borders: ['key'],                            fillMode: 'flat' },
  neon:        { borders: ['slab', 'glow', 'key', 'double'],  fillMode: 'radial' }
};

/* draw order. Lower first. Fill is 100. */
const ORDER = {
  glow: 5, drop: 8, slab: 10, gap: 14, sticker: 18,
  /* fill lands here */
  emboss: 120, gold: 130, double: 135, stitch: 140, tick: 145,
  key: 160, keyFat: 160, hair: 160
};

/* ============================================================
   TREATMENTS
   Each returns an array of SVG fragments. `s` is the shape
   context: { pts, core, d, ink, accent, gold, cream }.
   ============================================================ */
const TREAT = {

  /* --- hard offset slab. The house shadow. No blur, ever.
     A blurred shadow on a flat sticker reads as a mistake at
     small size; an offset copy reads as intent.                */
  slab: (s, o = {}) => [
    `<g transform="translate(${f(o.x ?? s.W.slabX)},${f(o.y ?? s.W.slabY)})">
       <path d="${s.d}" fill="${o.color || s.ink}" stroke="${o.color || s.ink}"
             stroke-width="${f(s.W.key + (o.grow ?? 0))}" stroke-linejoin="round"/></g>`
  ],

  /* --- soft drop. Chrome register only. */
  drop: (s, o = {}) => {
    const id = uid('bl');
    return [
      `<filter id="${id}" x="-30%" y="-30%" width="170%" height="170%">
         <feGaussianBlur stdDeviation="${f(o.blur ?? s.W.dropB)}"/></filter>`,
      `<g filter="url(#${id})" opacity="${o.opacity ?? 0.5}" transform="translate(${f(o.x ?? 1.6)},${f(o.y ?? 2.6)})">
         <path d="${s.d}" fill="${o.color || s.ink}"/></g>`
    ];
  },

  /* --- coloured halo. The neon ring in the reference frames,
     rebuilt so the colour is a brand colour and not a CRT
     artefact.                                                   */
  glow: (s, o = {}) => {
    const id = uid('gl');
    return [
      `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%">
         <feGaussianBlur stdDeviation="${f(o.blur ?? s.W.glowB)}"/></filter>`,
      `<g filter="url(#${id})" opacity="${o.opacity ?? 0.85}">
         <path d="${toPath(outset(s.pts, o.spread ?? 2.4))}" fill="${o.color || s.accent}"/></g>`
    ];
  },

  /* --- the fat cream outline that makes a shape survive being
     dropped on a busy frame. Drawn as an over-wide stroke UNDER
     the fill, so it needs no second path and no offsetting.     */
  sticker: (s, o = {}) => [
    `<path d="${s.d}" fill="none" stroke="${o.color || s.cream}"
           stroke-width="${f(2 * ((o.w ?? s.W.sticker) + s.W.key))}" stroke-linejoin="round"/>`
  ],

  /* --- detached ring with air between it and the shape. The
     "second thought" border. Reads as a spotlight.              */
  gap: (s, o = {}) => [
    `<path d="${toPath(outset(s.pts, o.out ?? s.W.gapOut))}" fill="none"
           stroke="${o.color || s.ink}" stroke-width="${f(o.w ?? s.W.gap)}" stroke-linejoin="round"/>`
  ],

  /* --- keylines. Stroke centred on the path, so half of it eats
     into the fill and half sits proud. That is deliberate: it is
     what keeps the silhouette the shape you asked for.          */
  key:    (s, o = {}) => [`<path d="${s.d}" fill="none" stroke="${o.color || s.ink}" stroke-width="${f(o.w ?? s.W.key)}" stroke-linejoin="round"/>`],
  keyFat: (s, o = {}) => [`<path d="${s.d}" fill="none" stroke="${o.color || s.ink}" stroke-width="${f(o.w ?? s.W.keyFat)}" stroke-linejoin="round"/>`],
  hair:   (s, o = {}) => [`<path d="${s.d}" fill="none" stroke="${o.color || s.ink}" stroke-width="${f(o.w ?? s.W.hair)}" stroke-linejoin="round"/>`],

  /* --- the gold band. 4px at the 180 lockup against 6px for the
     ink keyline, because gold on a dark ground reads heavier than
     ink on a light one and matching the numbers makes it look
     thicker than everything else.                               */
  gold: (s, o = {}) => [
    `<path d="${toPath(inset(s.core, o.in ?? s.W.goldIn))}" fill="none"
           stroke="${o.color || s.gold}" stroke-width="${f(o.w ?? s.W.gold)}" stroke-linejoin="round"/>`
  ],

  /* --- second ink ring, further in. Ledger, certificate, seal. */
  double: (s, o = {}) => [
    `<path d="${toPath(inset(s.core, o.in ?? s.W.doubleIn))}" fill="none"
           stroke="${o.color || s.ink}" stroke-width="${f(o.w ?? s.W.double)}" stroke-linejoin="round"/>`
  ],

  /* --- dashed inset ring. Stitching. Craft, handmade, keepsake. */
  stitch: (s, o = {}) => [
    `<path d="${toPath(inset(s.core, o.in ?? s.W.stitchIn))}" fill="none"
           stroke="${o.color || s.ink}" stroke-width="${f(o.w ?? s.W.stitch)}"
           stroke-linecap="round" stroke-dasharray="${f(o.dash ?? 3.4)} ${f(o.gap ?? 3.4)}"/>`
  ],

  /* --- ticks around the rim. Dial, timer, countdown, "limited". */
  tick: (s, o = {}) => {
    const a = inset(s.core, 1.6), b = inset(s.core, o.len ?? 5.2);
    const n = o.count ?? 36, step = Math.max(1, Math.floor(a.length / n));
    let d = '';
    for (let i = 0; i < a.length; i += step) d += `M ${f(a[i][0])} ${f(a[i][1])} L ${f(b[i][0])} ${f(b[i][1])} `;
    return [`<path d="${d}" stroke="${o.color || s.ink}" stroke-width="${f(o.w ?? 1.2)}" stroke-linecap="round" opacity="${o.opacity ?? 0.8}"/>`];
  },

  /* --- bevel. Inner highlight along the top, inner shade along
     the bottom, both clipped to the shape. This is the whole of
     the chrome look and it is two strokes, not a filter stack.  */
  emboss: (s, o = {}) => {
    const cid = uid('cl');
    const inn = toPath(inset(s.core, o.in ?? 2.2));
    return [
      `<clipPath id="${cid}"><path d="${s.d}"/></clipPath>`,
      `<g clip-path="url(#${cid})">
         <g transform="translate(0,${f(-(o.depth ?? 2.0))})">
           <path d="${inn}" fill="none" stroke="#FFFFFF" stroke-width="${f(o.w ?? 3.0)}" opacity="${o.light ?? 0.55}"/></g>
         <g transform="translate(0,${f(o.depth ?? 2.0)})">
           <path d="${inn}" fill="none" stroke="${s.ink}" stroke-width="${f(o.w ?? 3.0)}" opacity="${o.shade ?? 0.32}"/></g>
       </g>`
    ];
  }
};

export const TREATMENTS = Object.keys(TREAT);

export const TREATMENT_USE = {
  slab:    'Hard offset copy in ink. The house shadow. No blur, at any size.',
  drop:    'Blurred shadow. Chrome register only, never on a flat sticker.',
  glow:    'Coloured halo. The reference neon ring, in a brand colour.',
  sticker: 'Fat cream outline under the keyline. Makes a shape survive a busy frame.',
  gap:     'Detached ring with air inside it. Reads as a spotlight.',
  key:     'The 6px house keyline. The default border.',
  keyFat:  'Heavier keyline for anything landing below 64px.',
  hair:    'Thin keyline. Letterpress register and dense layouts.',
  gold:    'The premium register. 4px at the 180 lockup, inside the ink keyline.',
  double:  'Second ink ring further in. Certificate, seal, ledger.',
  stitch:  'Dashed inset ring. Craft, handmade, keepsake.',
  tick:    'Rim ticks. Dial, countdown, limited run.',
  emboss:  'Inner highlight and shade. The whole chrome look, in two strokes.'
};

/* ============================================================
   FILLS
   ============================================================ */
function fillLayer(s, spec) {
  if (!s.W) s = { ...s, W };
  const { mode, color, color2, media, mediaFit } = spec;
  if (media) {
    const cid = uid('mc');
    return [
      /* media fills the shape, not its safe area.

         `core` is where a GLYPH belongs: inside the drawn edge, clear of
         whatever the outline is doing. A well is the other thing. The
         picture is the subject and the frame is the mask, so it runs to
         the outline and the outline cuts it.

         Identical on seventeen of the eighteen frames, where the two are
         the same path. `stamp` is the one that differs: its core is the
         inner rectangle and its outline is the perforated edge, so the
         picture sat in a box with a margin around it instead of being cut
         by the perforations. */
      `<clipPath id="${cid}"><path d="${toPath(inset(s.pts, s.W.key / 2))}"/></clipPath>`,
      `<path d="${s.d}" fill="${color || s.cream}"/>`,
      `<g clip-path="url(#${cid})"><image href="${media}" x="0" y="0" width="100" height="100"
         preserveAspectRatio="${mediaFit || 'xMidYMid slice'}"/></g>`
    ];
  }
  if (mode === 'gradient') {
    const gid = uid('gr');
    return [
      `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
         <stop offset="0" stop-color="${color2 || '#FFFFFF'}"/>
         <stop offset="0.46" stop-color="${color}"/>
         <stop offset="1" stop-color="${shade(color, -0.30)}"/></linearGradient>`,
      `<path d="${s.d}" fill="url(#${gid})"/>`
    ];
  }
  if (mode === 'radial') {
    const gid = uid('rg');
    return [
      `<radialGradient id="${gid}" cx="0.38" cy="0.32" r="0.82">
         <stop offset="0" stop-color="${shade(color, 0.34)}"/>
         <stop offset="1" stop-color="${color}"/></radialGradient>`,
      `<path d="${s.d}" fill="url(#${gid})"/>`
    ];
  }
  return [`<path d="${s.d}" fill="${color}"/>`];
}

/* lighten or darken a hex by a fraction. Kept here rather than in
   tokens because it must never be used to invent a brand colour,
   only to shade one that already is. */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v =>
    Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)))));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/* ============================================================
   DRESS
   Take a frame, a register and a stack of treatments, return the
   layered <g>. Everything is in the frame's own 0..100 space; the
   caller scales it.
   ============================================================ */
/* ---------- how far a dressed frame paints outside its box ----
   Every treatment above is drawn against the 0..100 frame box, and
   several of them paint PROUD of it: a sticker outline is a stroke
   centred on the edge, so half of it hangs outside; a slab is the
   whole shape shifted and redrawn; a glow is a blur. Anything that
   crops to a dressed medallion has to know that reach or it slices
   off the very outline that makes the medallion read as a sticker.

   Answered in FRAME UNITS, so a caller scales it exactly the way it
   scales the medallion itself. That is the point: the reach grows
   with the shape, and a fixed pixel margin cannot track it.

   Symmetric, and generous by a unit or two. A slab only reaches
   down and right, but a bound that is slightly large on one side is
   invisible, and one that is short is a cut border. */
export function outerReach(opts = {}) {
  const wt = opts.weight ?? 1;
  const w = wt === 1 ? W : Object.fromEntries(Object.entries(W).map(([k, v]) => [k, v * wt]));
  const reg = REGISTERS[opts.register || 'sticker'] || REGISTERS.sticker;
  const list = (opts.borders || reg.borders)
    .map(b => (typeof b === 'string' ? [b, {}] : [b.name, b]));

  /* a Gaussian tail is spent by three standard deviations */
  const BLUR = 3;

  /* only the treatments that leave the box. gold, double, stitch,
     tick and emboss are all inset, so they never widen anything. */
  const OUT = {
    slab:    o => Math.max(o.x ?? w.slabX, o.y ?? w.slabY) + (w.key + (o.grow ?? 0)) / 2,
    drop:    o => Math.max(o.x ?? 1.6, o.y ?? 2.6) + BLUR * (o.blur ?? w.dropB),
    glow:    o => (o.spread ?? 2.4) + BLUR * (o.blur ?? w.glowB),
    sticker: o => (o.w ?? w.sticker) + w.key,
    gap:     o => (o.out ?? w.gapOut) + (o.w ?? w.gap) / 2,
    key:     o => (o.w ?? w.key) / 2,
    keyFat:  o => (o.w ?? w.keyFat) / 2,
    hair:    o => (o.w ?? w.hair) / 2
  };

  let r = 0;
  for (const [name, o] of list) if (OUT[name]) r = Math.max(r, OUT[name](o || {}));
  return r;
}

export function dress(fr, opts = {}) {
  const reg = REGISTERS[opts.register || 'sticker'] || REGISTERS.sticker;
  /* WEIGHT. One multiplier over every border weight, offset and inset
     in the set, so `weight: 1.3` gives a heavier medallion that is
     still in proportion with itself. That is what you want at 44px and
     on busy footage, and it is one number rather than thirteen.
     Individual treatments still override it:
       borders: [{ name: 'gold', w: 3.2, in: 5.0 }]
     Weights are in FRAME UNITS, a 0..100 box, so all of this scales
     WITH the medallion rather than against it. 3.4u is the 6px house
     keyline at the 180 lockup, and it is still the house keyline at
     1024 and at 44. */
  const wt = opts.weight ?? 1;
  const s = {
    W: wt === 1 ? W : Object.fromEntries(Object.entries(W).map(([k, v]) => [k, v * wt])),
    d: fr.d, pts: fr.pts, core: fr.core || fr.pts,
    ink: opts.ink || INK,
    cream: opts.cream || BRAND.cream,
    gold: opts.goldColor || BRAND.gold,
    accent: opts.accent || BRAND.red
  };

  /* normalise the treatment list to [name, opts] */
  const asked = opts.borders || reg.borders;
  const list = asked.map(b => (typeof b === 'string' ? [b, {}] : [b.name, b]))
                    .filter(([n]) => TREAT[n])
                    .sort((a, b) => (ORDER[a[0]] ?? 100) - (ORDER[b[0]] ?? 100));

  const defs = [], under = [], over = [];
  for (const [name, o] of list) {
    const frags = TREAT[name](s, o);
    const bucket = (ORDER[name] ?? 100) < 100 ? under : over;
    for (const g of frags) (g.startsWith('<filter') || g.startsWith('<clipPath') || g.startsWith('<linearGradient') || g.startsWith('<radialGradient') ? defs : bucket).push(g);
  }

  const fillFrags = fillLayer(s, {
    mode: opts.fillMode || reg.fillMode,
    color: opts.fill || BRAND.cream,
    color2: opts.fill2,
    media: opts.media,
    mediaFit: opts.mediaFit
  });
  const fill = [];
  for (const g of fillFrags) (g.startsWith('<clipPath') || g.startsWith('<linearGradient') || g.startsWith('<radialGradient') ? defs : fill).push(g);

  return {
    defs: defs.join('\n'),
    body: [...under, ...fill, ...over].join('\n')
  };
}

/* convenience: one frame, one standalone SVG, at a real pixel size */
export function frameSvg(fr, size = 180, opts = {}) {
  const pad = opts.pad ?? 10;                    /* room for slab and sticker */
  const { defs, body } = dress(fr, opts);
  const inner = opts.inner || '';
  const V = 100 + pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
   viewBox="${-pad} ${-pad} ${V} ${V}" fill="none">
  <defs>${defs}</defs>
  ${body}
  ${inner}
</svg>`;
}
