/* ============================================================
   HeartStamp POP KIT - CAPTION SHELLS
   ------------------------------------------------------------
   The border around the words. Twelve of them, and the reason
   there are twelve rather than one is that the border is doing
   editorial work: an ink slab with a cream pill inside it reads
   as a broadcast fact, the same sentence on a torn ticket reads
   as an offer, and on an index card it reads as a note someone
   wrote. Same words, three different speakers.

   THE RULE, UNCHANGED
   A shell is a function of the TEXT BLOCK SIZE. Nothing in here
   knows what the sentence says. You measure the copy, you get a
   shell that fits it, and the copy is drawn on top as its own
   layer. Never bake the words into the art.

   WHAT COMES BACK
     { W, H, tx, ty, defs, body }
   W,H  the whole shell
   tx,ty where the text block's top-left goes
   body  SVG, already positioned in the shell's own space

   The one the references lean on hardest is `insetPill`: a heavy
   ink slab with a cream pill floating inside it. It survives
   being dropped on any footage, because the ink does the
   separating and the cream does the reading. If you are unsure,
   use that one.
   ============================================================ */

import { BRAND } from './tokens.js';
import { uid, shade } from './finish.js';

const INK = BRAND.ink;
const f = n => Math.round(n * 100) / 100;

/* rounded rectangle, absolute, arcs written as quadratics so the
   whole kit stays parseable by frames.flatten */
export function rr(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  return `M ${f(x + r)} ${f(y)} L ${f(x + w - r)} ${f(y)} Q ${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}
          L ${f(x + w)} ${f(y + h - r)} Q ${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}
          L ${f(x + r)} ${f(y + h)} Q ${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}
          L ${f(x)} ${f(y + r)} Q ${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Z`.replace(/\s+/g, ' ');
}

/* a speech tail on any edge, at any position along it. Drawn as a
   separate path and merged by draw order: every silhouette is
   stroked first, then every silhouette is filled, so the seam
   between body and tail disappears without any path arithmetic. */
function tailPath(edge, at, W, H, size) {
  const s = size;
  switch (edge) {
    case 'bottom': { const x = at * W; return `M ${f(x - s * 0.62)} ${f(H - 2)} L ${f(x + s * 0.30)} ${f(H + s)} L ${f(x + s * 0.66)} ${f(H - 2)} Z`; }
    case 'top':    { const x = at * W; return `M ${f(x - s * 0.62)} 2 L ${f(x + s * 0.30)} ${f(-s)} L ${f(x + s * 0.66)} 2 Z`; }
    case 'left':   { const y = at * H; return `M 2 ${f(y - s * 0.62)} L ${f(-s)} ${f(y + s * 0.30)} L 2 ${f(y + s * 0.66)} Z`; }
    default:       { const y = at * H; return `M ${f(W - 2)} ${f(y - s * 0.62)} L ${f(W + s)} ${f(y + s * 0.30)} L ${f(W - 2)} ${f(y + s * 0.66)} Z`; }
  }
}

/* ============================================================
   THE SHELLS
   Each is [padX, padY, draw]. draw(ctx) returns SVG for a shell
   of size W x H, where W,H already include the padding.
   ============================================================ */

export const CAPTIONS = {

  /* --- S01 pill. Cream stadium, ink keyline, hard slab. The
     house default and the one that disappears fastest, which is
     the point: the copy is the star. */
  pill: {
    label: 'Pill', pad: [1.10, 0.46],
    use: 'House default. Gets out of the way of the sentence.',
    draw: c => body(c, rr(0, 0, c.W, c.H, c.H / 2))
  },

  /* --- S02 inset pill. Ink slab outside, cream pill inside. The
     strongest thing in the reference frames and the only shell
     that is legible over absolutely anything, because the ink
     does the separating and the cream does the reading. */
  insetPill: {
    label: 'Inset pill', pad: [1.55, 1.00], inset: true,
    use: 'Over busy or unpredictable footage. The safest shell we have.',
    draw: c => {
      const g = c.k * 2.6;
      const outer = rr(0, 0, c.W, c.H, c.H / 2);
      const inner = rr(g, g, c.W - g * 2, c.H - g * 2, (c.H - g * 2) / 2);
      return [
        slab(c, outer),
        ...tailStrokes(c, outer),
        `<path d="${outer}" fill="${c.ink}"/>`,
        ...tailFills(c, c.ink),
        `<path d="${inner}" fill="${c.fill}"/>`
      ].join('\n');
    }
  },

  /* --- S03 slab. Small radius. Facts, specs, dates. */
  slab: {
    label: 'Slab', pad: [0.85, 0.46],
    use: 'Filed facts. Dates, prices, specs, credits.',
    draw: c => body(c, rr(0, 0, c.W, c.H, c.k * 1.6))
  },

  /* --- S04 bevel. The nineties surface, rebuilt honestly: a
     vertical gradient, one light line inside the top, one dark
     line inside the bottom, and a real blur behind it. Use once. */
  bevel: {
    label: 'Bevel', pad: [0.95, 0.50], register: 'chrome',
    use: 'The nostalgia wink. One per video, never two.',
    draw: c => {
      const gid = uid('cg'), fid = uid('cf');
      const r = c.k * 1.9;
      const d = rr(0, 0, c.W, c.H, r);
      const inn = rr(c.k * 1.1, c.k * 1.1, c.W - c.k * 2.2, c.H - c.k * 2.2, Math.max(1, r - c.k));
      return `
      <defs>
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.5" stop-color="${c.fill}"/>
          <stop offset="1" stop-color="${shade(c.fill, -0.22)}"/></linearGradient>
        <filter id="${fid}" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="${f(c.k * 0.9)}"/></filter>
      </defs>
      <g filter="url(#${fid})" opacity="0.42" transform="translate(${f(c.k * 0.5)},${f(c.k * 0.9)})">
        <path d="${d}" fill="${c.ink}"/></g>
      ${tailStrokes(c, d).join('')}
      <path d="${d}" fill="url(#${gid})" stroke="${c.ink}" stroke-width="${f(c.k * 0.55)}"/>
      ${tailFills(c, `url(#${gid})`)}
      <clipPath id="${gid}c"><path d="${d}"/></clipPath>
      <g clip-path="url(#${gid}c)">
        <g transform="translate(0,${f(-c.k * 0.8)})"><path d="${inn}" fill="none" stroke="#FFFFFF"
              stroke-width="${f(c.k * 0.75)}" opacity="0.8"/></g>
        <g transform="translate(0,${f(c.k * 0.9)})"><path d="${inn}" fill="none" stroke="${c.ink}"
              stroke-width="${f(c.k * 0.55)}" opacity="0.24"/></g>
      </g>`;
    }
  },

  /* --- S05 sticker. Fat cream outline outside the keyline. Cut
     out and stuck on. The loud register. */
  sticker: {
    label: 'Sticker', pad: [1.05, 0.48],
    use: 'Loud. UGC, TikTok, anything that has to win a busy feed.',
    draw: c => {
      const d = rr(0, 0, c.W, c.H, c.H * 0.34);
      return [
        slab(c, d, c.k * 1.2),
        ...tailStrokes(c, d, c.k * 2 + c.k * 3.2),
        `<path d="${d}" fill="none" stroke="${c.cream}" stroke-width="${f(c.k * 2 + c.k * 3.2)}" stroke-linejoin="round"/>`,
        ...tailStrokes(c, d),
        `<path d="${d}" fill="none" stroke="${c.ink}" stroke-width="${f(c.k * 2)}" stroke-linejoin="round"/>`,
        `<path d="${d}" fill="${c.fill}"/>`,
        ...tailFills(c, c.fill)
      ].join('\n');
    }
  },

  /* --- S06 ticket. Bitten at both ends. Offers, codes,
     HeartCredits, anything redeemable. */
  ticket: {
    label: 'Ticket', pad: [1.35, 0.52],
    use: 'Offers, promo codes, HeartCredits. Anything redeemable.',
    draw: c => {
      const b = Math.min(c.H * 0.24, c.k * 3.4), r = c.k * 1.4, my = c.H / 2;
      const d = `M ${f(r)} 0 L ${f(c.W - r)} 0 Q ${f(c.W)} 0 ${f(c.W)} ${f(r)}
        L ${f(c.W)} ${f(my - b)} C ${f(c.W - b * 1.1)} ${f(my - b * 0.55)} ${f(c.W - b * 1.1)} ${f(my + b * 0.55)} ${f(c.W)} ${f(my + b)}
        L ${f(c.W)} ${f(c.H - r)} Q ${f(c.W)} ${f(c.H)} ${f(c.W - r)} ${f(c.H)}
        L ${f(r)} ${f(c.H)} Q 0 ${f(c.H)} 0 ${f(c.H - r)}
        L 0 ${f(my + b)} C ${f(b * 1.1)} ${f(my + b * 0.55)} ${f(b * 1.1)} ${f(my - b * 0.55)} 0 ${f(my - b)}
        L 0 ${f(r)} Q 0 0 ${f(r)} 0 Z`.replace(/\s+/g, ' ');
      return body(c, d) +
        `<path d="M ${f(c.W * 0.74)} ${f(c.k * 1.6)} L ${f(c.W * 0.74)} ${f(c.H - c.k * 1.6)}"
               stroke="${c.ink}" stroke-width="${f(c.k * 0.5)}" stroke-dasharray="${f(c.k)} ${f(c.k * 1.1)}" opacity="0.5"/>`;
    }
  },

  /* --- S07 stamp edge. Perforated top and bottom. Ours. */
  stampEdge: {
    label: 'Stamp edge', pad: [1.0, 0.60],
    use: 'The physical card, postage, mailing. Brand-owned shape.',
    draw: c => {
      const p = Math.min(c.H * 0.13, c.k * 1.9);
      const n = Math.max(4, Math.round(c.W / (p * 3.1))), s = c.W / n;
      let d = `M 0 0 `;
      for (let i = 0; i < n; i++) { const x = i * s + s / 2; d += `L ${f(x - p)} 0 Q ${f(x)} ${f(p * 1.5)} ${f(x + p)} 0 `; }
      d += `L ${f(c.W)} 0 L ${f(c.W)} ${f(c.H)} `;
      for (let i = n - 1; i >= 0; i--) { const x = i * s + s / 2; d += `L ${f(x + p)} ${f(c.H)} Q ${f(x)} ${f(c.H - p * 1.5)} ${f(x - p)} ${f(c.H)} `; }
      d += `L 0 ${f(c.H)} Z`;
      return body(c, d);
    }
  },

  /* --- S08 index card. Square, hairline, one ruled line under the
     first row. A note somebody wrote, not a graphic somebody made. */
  index: {
    label: 'Index card', pad: [0.80, 0.62], register: 'letterpress',
    use: 'A note somebody wrote. Sincere register, quotes, letters.',
    draw: c => {
      const d = rr(0, 0, c.W, c.H, c.k * 0.9);
      return [
        `<path d="${d}" fill="${c.fill}"/>`,
        `<path d="M ${f(c.k * 1.4)} ${f(c.padY + c.line * 0.98)} L ${f(c.W - c.k * 1.4)} ${f(c.padY + c.line * 0.98)}"
               stroke="${c.accent}" stroke-width="${f(c.k * 0.35)}" opacity="0.55"/>`,
        `<path d="${d}" fill="none" stroke="${c.ink}" stroke-width="${f(c.k * 0.5)}"/>`
      ].join('\n');
    }
  },

  /* --- S09 ribbon. Notched tail on the left, point on the right.
     Takes a kicker, a price, a credit. */
  ribbon: {
    label: 'Ribbon', pad: [1.5, 0.46],
    use: 'Kickers, prices, credits. Short copy only.',
    draw: c => {
      const t = c.H * 0.42;
      const d = `M 0 0 L ${f(c.W - t)} 0 L ${f(c.W)} ${f(c.H / 2)} L ${f(c.W - t)} ${f(c.H)} L 0 ${f(c.H)} L ${f(t * 0.72)} ${f(c.H / 2)} Z`;
      return body(c, d);
    }
  },

  /* --- S10 bar. No silhouette at all, just a colour band behind
     the words. The quietest option and the fastest to read. */
  bar: {
    label: 'Bar', pad: [0.55, 0.30],
    use: 'Quietest option. Dense sequences and subtitles-adjacent use.',
    draw: c => `<path d="${rr(0, 0, c.W, c.H, c.k * 0.4)}" fill="${c.fill}"/>`
  },

  /* --- S11 brackets. Corner marks only, nothing behind the copy,
     so the footage stays visible. Needs a light or dark plate
     under the text in practice, which the caller decides. */
  brackets: {
    label: 'Brackets', pad: [1.0, 0.62],
    use: 'Keeps the footage visible. Product shots and reveals.',
    draw: c => {
      const a = Math.min(c.W, c.H) * 0.34, w = c.k * 1.5;
      const L = (x, y, dx, dy) => `M ${f(x + dx * a)} ${f(y)} L ${f(x)} ${f(y)} L ${f(x)} ${f(y + dy * a)}`;
      const d = [L(0, 0, 1, 1), L(c.W, 0, -1, 1), L(0, c.H, 1, -1), L(c.W, c.H, -1, -1)].join(' ');
      return `<path d="${d}" fill="none" stroke="${c.ink}" stroke-width="${f(w * 1.9)}" stroke-linecap="round"/>
              <path d="${d}" fill="none" stroke="${c.accent}" stroke-width="${f(w)}" stroke-linecap="round"/>`;
    }
  },

  /* --- S12 torn. A deckle edge along the bottom. Paper, letters,
     the card itself. The one shape here that looks like it was
     made by hand, because it was. */
  torn: {
    label: 'Torn', pad: [0.95, 0.62],
    use: 'Paper and letters. The physical product, the handwritten beat.',
    draw: c => {
      const a = Math.min(c.H * 0.10, c.k * 1.5), r = c.k * 1.2;
      const n = Math.max(5, Math.round(c.W / (c.k * 5))), s = c.W / n;
      let d = `M ${f(r)} 0 L ${f(c.W - r)} 0 Q ${f(c.W)} 0 ${f(c.W)} ${f(r)} L ${f(c.W)} ${f(c.H - a)}`;
      for (let i = 0; i < n; i++) {
        const x1 = c.W - (i + 0.5) * s, x2 = c.W - (i + 1) * s;
        d += ` Q ${f(x1)} ${f(c.H + (i % 2 ? a : -a))} ${f(x2)} ${f(c.H - a)}`;
      }
      d += ` L 0 ${f(r)} Q 0 0 ${f(r)} 0 Z`;
      return body(c, d);
    }
  }
};

/* ---------- shared draw helpers ----------------------------- */
function slab(c, d, grow = 0) {
  if (c.register === 'letterpress' || c.noSlab) return '';
  return `<g transform="translate(${f(c.k * 0.95)},${f(c.k * 1.2)})">
    <path d="${d}" fill="${c.ink}" stroke="${c.ink}" stroke-width="${f(c.k + grow)}" stroke-linejoin="round"/></g>`;
}
function tailStrokes(c, _d, w) {
  if (!c.tail) return [];
  return [`<path d="${tailPath(c.tail.edge, c.tail.at ?? 0.28, c.W, c.H, c.tail.size ?? c.H * 0.55)}"
      fill="none" stroke="${c.ink}" stroke-width="${f(w ?? c.k * 2)}" stroke-linejoin="round"/>`];
}
function tailFills(c, fill) {
  if (!c.tail) return [];
  return [`<path d="${tailPath(c.tail.edge, c.tail.at ?? 0.28, c.W, c.H, c.tail.size ?? c.H * 0.55)}" fill="${fill}"/>`];
}

/* the common case: slab, tail, keyline, fill */
function body(c, d) {
  return [
    slab(c, d),
    ...tailStrokes(c, d),
    `<path d="${d}" fill="none" stroke="${c.ink}" stroke-width="${f(c.k * 2)}" stroke-linejoin="round"/>`,
    `<path d="${d}" fill="${c.fill}"/>`,
    ...tailFills(c, c.fill)
  ].filter(Boolean).join('\n');
}

export const CAPTION_NAMES = Object.keys(CAPTIONS);

/* ============================================================
   BUILD
   textW, textH  the measured copy block
   k             keyline weight in px for this canvas
   ============================================================ */
/* ---- how a shell is sized, in one place --------------------
   Three dials, in order of how often you will reach for them:

   1. fontSize and maxTextW  change the COPY, and the shell follows.
      This is the main one. A shell is a function of the measured
      text block, so a bigger font or a narrower wrap gives a bigger
      or taller shell with no other change.
   2. padScale                one multiplier over the breathing room.
      0.7 is tight and broadcast, 1.4 is generous and premium.
   3. padX / padY             absolute overrides in px, when a layout
      needs an exact number rather than a proportion.

   The per-style defaults in S.pad are multiples of the LINE HEIGHT,
   not fixed pixels, which is why a pill looks like a pill at 15px on
   iOS and at 46px on a Reel.
   ------------------------------------------------------------ */
export function caption({
  textW = 400, textH = 100, line = 46, style = 'pill',
  fill = BRAND.cream, ink = INK, cream = BRAND.cream, accent = BRAND.red,
  k = 7, tail = null, register = null, noSlab = false,
  padScale = 1, padX: padXOverride = null, padY: padYOverride = null,
  padL: padLOverride = null, padR: padROverride = null
} = {}) {
  const S = CAPTIONS[style] || CAPTIONS.pill;
  const padX = Math.round(padXOverride ?? (k * 2.0 + line * S.pad[0]) * padScale);
  const padY = Math.round(padYOverride ?? (k * 1.4 + line * S.pad[1]) * padScale);
  /* PER-END PADDING. padX is one number for both ends, which is right
     until a medallion laps over one of them: closing the gap on that
     end with padX drags the far end in by the same amount and pushes
     the copy against it. padL/padR override one end at a time and
     default to padX, so nothing that does not ask for them changes. */
  const padLeft = Math.round(padLOverride ?? padX);
  const padRight = Math.round(padROverride ?? padX);
  const W = Math.round(textW + padLeft + padRight);
  const H = Math.round(textH + padY * 2);
  const c = { W, H, k, fill, ink, cream, accent, tail, padX, padY, line,
              padL: padLeft, padR: padRight,
              register: register || S.register || 'sticker', noSlab };
  const out = S.draw(c);
  const defs = (out.match(/<defs>[\s\S]*?<\/defs>/) || [''])[0];
  return {
    W, H, tx: padLeft, ty: padY, style,
    defs: defs.replace(/<\/?defs>/g, ''),
    body: out.replace(/<defs>[\s\S]*?<\/defs>/, '')
  };
}

export default caption;
