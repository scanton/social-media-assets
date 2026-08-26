/* ============================================================
   HeartStamp POP KIT - COMPOSE
   ------------------------------------------------------------
   The thing Keith actually asked for: type the sentence, pick a
   medallion, pick an arrow, get a finished annotation.

     compose({ text, caption, left, right, arrows })

   Everything it needs is already true elsewhere. FRAMES knows
   where the edge of a heart is. FINISH knows what a gold band on
   that heart looks like. ARROWS knows which way an arrow is
   facing. CAPTIONS knows how big a shell has to be for a given
   block of copy. This module only has to place them, and placing
   them is arithmetic.

   WHAT MAKES IT A SYSTEM RATHER THAN A TEMPLATE
   The arrow does not attach to a hard-coded corner. It attaches
   to a BEARING on the medallion, and the medallion works out
   where that bearing leaves its own outline. So "arrow off the
   four o'clock" is one instruction that means the right thing on
   a disc, a diamond, a triangle and a postage stamp, and none of
   them needed a special case.

   TEXT IS STILL A PROP
   The copy is measured with kit/measure.js and drawn as <text>
   in its own layer. It is never part of the shell art.
   ============================================================ */

import { BRAND, PALETTES, CANVAS, MOTION, TYPE, COLORWAYS } from './tokens.js';
import { frame, anchor, safeBox } from './frames.js';
import { dress, outerReach } from './finish.js';
import { arrowGroup, ARROWS } from './arrows2.js';
import { caption as buildCaption } from './captions.js';
import { wrap, blockSize } from './measure.js';

const f = n => Math.round(n * 100) / 100;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rad = d => ((d - 90) * Math.PI) / 180;

/* ---------- a dressed medallion, placed --------------------- */
function medallion(spec, x, y, size, pal, reg, weight = 1, cw = {}) {
  const fr = frame(spec.frame || 'circle');
  const { defs, body } = dress(fr, {
    register: spec.register || reg,
    fill: spec.fill || cw.medallionFill || pal.accent,
    fill2: spec.fill2,
    borders: spec.borders,
    weight: spec.weight ?? weight,
    media: spec.media,
    /* every colour in a medallion is overridable, in this order:
       the part-level prop, then the colourway, then the palette. */
    ink: spec.ink || cw.captionInk || BRAND.ink,
    goldColor: spec.gold || cw.accent,
    cream: spec.cream || cw.cream || BRAND.cream,
    accent: spec.accent || cw.accent || pal.pop
  });

  /* the glyph, dropped into the shape's real safe area rather than
     its bounding box, so a hand gesture in a triangle is scaled to
     what a triangle can actually hold */
  let inner = '';
  if (spec.glyph) {
    const sb = safeBox(fr.core || fr.pts, 1);
    const g = (spec.glyphFrac ?? 0.86) * sb.w;
    inner = `<image href="${spec.glyph}" x="${f(sb.cx - g / 2)}" y="${f(sb.cy - g / 2)}"
             width="${f(g)}" height="${f(g)}" preserveAspectRatio="xMidYMid meet"/>`;
  }

  const s = size / 100;
  return {
    fr, defs,
    g: `<g transform="translate(${f(x)},${f(y)}) scale(${f(s)})">${body}${inner}</g>`,
    /* where a bearing leaves this medallion, in canvas units */
    at: bearing => {
      const p = anchor(fr.pts, bearing);
      return [x + p[0] * s, y + p[1] * s];
    }
  };
}

/* ============================================================
   COMPOSE
   ============================================================ */
export function compose(o = {}) {
  const cv = typeof o.canvas === 'string' ? CANVAS[o.canvas] : (o.canvas || CANVAS.reels);
  const pal = PALETTES[o.palette || 'house'];
  const reg = o.register || 'sticker';
  /* A colourway sets every part at once. Anything passed explicitly
     still wins, so it is a starting point rather than a cage. */
  const cw = { ...(COLORWAYS[o.colorway] || {}) };
  const base = o.fontSize || cv.base;
  const line = Math.round(base * 1.18);
  const k = o.k || cv.k;

  /* ---- copy ---- */
  const maxW = o.maxTextW || Math.round(cv.w * 0.62);
  const lines = o.text ? wrap(o.text, base, maxW, 'sans') : [];
  const blk = lines.length ? blockSize(lines, base, line, 'sans') : { w: 0, h: 0 };

  /* ---- caption shell ----
     Built twice on purpose. The first pass only needs the HEIGHT,
     because that is what sets the medallion diameter. Once the
     medallion is sized we know how far it laps over the end of the
     caption, and the copy has to start clear of it, so the second
     pass rebuilds the shell with that much extra padding on the
     overlapped side. Without this the first word sits under the
     medallion, which is exactly what the reference frames avoid
     and exactly what a naive build gets wrong. */
  const capOpts = {
    textH: blk.h, line, k,
    style: o.caption || 'insetPill',
    fill: o.captionFill || cw.captionFill || (o.caption === 'bar' ? pal.accent : pal.fill),
    ink: o.captionInk || cw.captionInk || BRAND.ink,
    accent: o.captionAccent || cw.accent || pal.accent,
    cream: o.captionCream || cw.cream || BRAND.cream,
    tail: o.tail || null, register: o.captionRegister || reg,
    padScale: o.captionPad ?? 1, padX: o.captionPadX ?? null, padY: o.captionPadY ?? null,
    padL: o.captionPadL ?? null, padR: o.captionPadR ?? null
  };
  const pass1 = o.text ? buildCaption({ ...capOpts, textW: blk.w }) : null;

  const capH = pass1 ? pass1.H : Math.round(base * 2.6);
  const medSize = Math.round(capH * (o.medallionScale ?? 1.52));
  const overlap = o.overlap ?? 0.30;          /* how far a medallion sits over the caption end */

  /* how far each medallion actually reaches into the caption. Uses
     the shape's real edge, so a heart, which does not fill its box
     at the waist, does not get padded as if it were a disc. */
  const reach = (spec, side) => {
    if (!spec) return 0;
    const fr = frame(spec.frame || 'circle');
    const e = side === 'left' ? anchor(fr.pts, 90)[0] / 100 : anchor(fr.pts, 270)[0] / 100;
    const cover = side === 'left' ? medSize * (overlap + e - 1) : medSize * (overlap - e);
    return Math.max(0, Math.round(cover + k * 1.6));
  };
  const exL = reach(o.left, 'left'), exR = reach(o.right, 'right');
  const cap = o.text ? buildCaption({ ...capOpts, textW: blk.w + exL + exR }) : null;
  if (cap) cap.tx += exL;

  /* ---- lay out on a working canvas, then crop ---- */
  const ORG = 800;                             /* generous origin, cropped at the end */
  const capX = ORG, capY = ORG;
  const parts = [], defs = [];

  const mkSide = (spec, side) => {
    if (!spec) return null;
    const w = medSize;
    const x = side === 'left'
      ? capX - w + w * overlap
      : capX + (cap ? cap.W : 0) - w * overlap;
    const y = capY + (capH - w) / 2 + (spec.dy || 0);
    return medallion(spec, x, y, w, pal, reg, o.borderWeight ?? 1, cw);
  };

  const L = mkSide(o.left, 'left');
  const R = mkSide(o.right, 'right');

  /* ---- arrows ---- */
  const arrows = [];
  for (const a of (o.arrows || [])) {
    const def = ARROWS[a.name];
    if (!def) continue;
    const size = a.size || Math.round(medSize * (a.scale ?? 0.68));
    const gap = a.gap ?? Math.round(medSize * 0.06);
    let host = a.from === 'right' ? R : a.from === 'left' ? L : null;
    let px, py, bearing = a.bearing;

    if (a.at) { [px, py] = a.at; bearing = bearing ?? 135; }
    else if (host) {
      const b = a.anchor ?? 225;
      const [ax, ay] = host.at(b);
      const dir = [Math.cos(rad(b)), Math.sin(rad(b))];
      const out = a.point === 'in' ? gap : gap + size * (a.reach ?? 0.9);
      px = ax + dir[0] * out; py = ay + dir[1] * out;
      bearing = bearing ?? (a.point === 'in' ? b + 180 : b);
    } else {
      /* hung off the caption: edge plus a fraction along it */
      const e = a.edge || 'top', t = a.at01 ?? 0.78;
      const W_ = cap ? cap.W : 0;
      const pt = e === 'top' ? [capX + W_ * t, capY]
               : e === 'bottom' ? [capX + W_ * t, capY + capH]
               : e === 'left' ? [capX, capY + capH * t]
               : [capX + W_, capY + capH * t];
      const b = a.anchor ?? (e === 'top' ? 0 : e === 'bottom' ? 180 : e === 'left' ? 270 : 90);
      const dir = [Math.cos(rad(b)), Math.sin(rad(b))];
      px = pt[0] + dir[0] * (gap + size * (a.reach ?? 0.9));
      py = pt[1] + dir[1] * (gap + size * (a.reach ?? 0.9));
      bearing = bearing ?? b;
    }

    if (def.centred) { bearing = 90; }          /* a lasso is placed, not aimed */
    const built = arrowGroup(a.name, {
      at: [px, py], bearing, size,
      register: a.register || reg,
      fill: a.fill || cw.arrowFill || pal.accent,
      fill2: a.fill2 || cw.arrowFill2,
      cream: a.cream || cw.cream || BRAND.cream,
      ink: a.ink || cw.captionInk || BRAND.ink
    });
    defs.push(built.defs);
    arrows.push({ g: built.g, over: a.over !== false, layer: a.layer || null, x: px, y: py, r: size * 1.05 });
  }

  /* ---- assemble in draw order ---- */
  /* THREE LAYERS, not two. `over: false` tucks an arrow under the whole
     caption so its tail disappears beneath the shell, which is what a
     popup arrow wants -- until the arrow lies mostly over the caption,
     at which point the shell swallows it and only the tip shows. `over:
     true` cures that but puts the arrow over the medallion too. `layer:
     'mid'` is the one that was missing: above the shell, below the
     medallion, and still under the copy so it can never cover a word. */
  const layerOf = a => a.layer || (a.over ? 'over' : 'under');
  const under = arrows.filter(a => layerOf(a) === 'under').map(a => a.g);
  const mid = arrows.filter(a => layerOf(a) === 'mid').map(a => a.g);
  const over = arrows.filter(a => layerOf(a) === 'over').map(a => a.g);
  if (L) defs.push(L.defs);
  if (R) defs.push(R.defs);
  if (cap) defs.push(cap.defs);

  const capG = cap ? `<g transform="translate(${capX},${capY})">${cap.body}</g>` : '';
  const textG = cap ? `<g transform="translate(${capX + cap.tx},${capY + cap.ty})"
    font-family="${o.fontFamily || TYPE.display}" font-weight="${o.fontWeight || 700}"
    font-size="${base}" fill="${o.textColor || cw.textColor || pal.ink}">
    ${lines.map((l, i) => `<text x="0" y="${f(line * (i + 0.78))}">${esc(l)}</text>`).join('')}
  </g>` : '';

  parts.push(...under, capG, ...mid, L ? L.g : '', R ? R.g : '', textG, ...over);

  /* ---- crop ----
     Track the real extent as things are placed rather than padding
     by a guess. An arrow is bounded by a circle of its own length
     around its tip, which is generous by a few percent and never
     wrong, and that beats a fixed margin that is three times too
     big on a caption-only build. */
  let x0 = capX, y0 = capY, x1 = capX + (cap ? cap.W : 0), y1 = capY + capH;
  const grow = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
  if (cap) grow(capX - k, capY - k, capX + cap.W + k * 2, capY + capH + k * 2.5);
  if (o.tail) {
    const ts = o.tail.size ?? capH * 0.55;
    grow(capX - ts, capY - ts, capX + (cap ? cap.W : 0) + ts, capY + capH + ts);
  }
  for (const [S, side] of [[o.left, 'left'], [o.right, 'right']]) {
    if (!S) continue;
    const mx = side === 'left' ? capX - medSize + medSize * overlap
                               : capX + (cap ? cap.W : 0) - medSize * overlap;
    const my = capY + (capH - medSize) / 2 + (S.dy || 0);
    /* the dressed border paints proud of the medallion box, and by
       how much is a property of the medallion, not of the keyline:
       a sticker outline hangs ten frame units out, which is 46px on
       a 441px medallion against the 7px this used to allow. Growing
       by k alone sliced the top off the cream outline on every large
       nugget. Ask finish.js what it is about to paint instead. */
    const br = Math.max(k, outerReach({
      register: S.register || reg,
      weight: S.weight ?? o.borderWeight ?? 1,
      borders: S.borders
    }) * medSize / 100);
    grow(mx - br, my - br, mx + medSize + br, my + medSize + br);
  }
  for (const a of arrows) grow(a.x - a.r, a.y - a.r, a.x + a.r, a.y + a.r);

  const pad = o.pad ?? Math.round(k * 1.5);
  const vb = o.viewBox || [f(x0 - pad), f(y0 - pad), f(x1 - x0 + pad * 2), f(y1 - y0 + pad * 2)];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}"
  width="${f(vb[2])}" height="${f(vb[3])}" fill="none">
<defs>${defs.filter(Boolean).join('\n')}</defs>
${parts.filter(Boolean).join('\n')}
</svg>`;

  const arrowsAt = arrows.map(a => ({ x: f(a.x - vb[0]), y: f(a.y - vb[1]), r: f(a.r) }));
  return { svg, W: vb[2], H: vb[3], viewBox: vb, lines, capW: cap ? cap.W : 0, capH, medSize, arrows: arrowsAt };
}

/* ---------- a beat, for the editor timeline -----------------
   Point, then tell, then confirm. The arrow lands 15 frames
   before its caption, and that lead is enforced here rather than
   left to whoever is cutting.
   ------------------------------------------------------------ */
export function beat(spec, startFrame = 0) {
  const dwell = Math.round((MOTION.dwellBase + (String(spec.text || '').length / 10) * MOTION.dwellPer10Chars) * 30);
  return {
    arrows: { in: startFrame, out: startFrame + MOTION.pointerLead + dwell },
    caption: { in: startFrame + MOTION.pointerLead, out: startFrame + MOTION.pointerLead + dwell },
    chip: { in: startFrame + MOTION.pointerLead + Math.round(dwell * 0.55) },
    total: MOTION.pointerLead + dwell + MOTION.out.frames
  };
}

export default compose;
