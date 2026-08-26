/* ============================================================
   POP KIT - MEDIA WELLS
   A well is a POP KIT shell with a hole in it. The frame, the mask,
   the keyline, the extrude and the caption are code. The picture or
   the clip is a prop.

   This is the same rule the whole kit runs on. Shells are code, copy
   is a prop, geometry is code. A well just extends it to pixels: the
   creator uploads the reaction shot of someone opening a card, and
   the kit guarantees it lands in a correctly masked, correctly keyed,
   correctly sized frame every single time, on every canvas.

   WHY THIS EXISTS
   The three references all do it. VH1 dropped a second picture inside
   the bubble whenever the fact was about a person or a place, and it
   is the single move that stops a lower third reading as a subtitle.
   A caption tells you something. A caption with a face in it shows
   you. For UGC that is the whole game: the card arrives, the face
   goes, and the nugget is the frame around the face.

   STILL VERSUS MOTION
   Satori cannot render <video>. It has no timeline and no decoder.
   So every well carries BOTH:
     src     the clip, used by the DOM renderer and by Remotion
     poster  a still frame, used by Satori and by any static export
   Call with kind 'image' and only poster is used. Call with kind
   'video' and the DOM path gets a real <video>, while the Satori
   path silently falls back to the poster. One template, both routes,
   no branching in the caller. That fallback is the reason a well is
   safe to put in a template at all.

   SAFE AREA
   Media is user-supplied and will be the wrong aspect. Every well
   uses object-fit cover plus a centre-weighted focal point, so the
   subject survives the crop. Never contain. Letterboxing inside a
   bubble reads as a mistake.
   ============================================================ */

import { BRAND } from './tokens.js';
import { wrap as wrapText, measureLine } from './measure.js';

const INK = BRAND.ink;
const uri = svg => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- well shapes ----------
   Each returns { clip, frame } where clip is a CSS value for the
   media layer and frame is the SVG drawn behind and around it.
   Keeping the mask in CSS rather than in the SVG means the media
   element is a plain <img> or <video>, which is what both Satori
   and Remotion want. */

export const WELL_SHAPES = {
  /* the medallion well. Same disc as a glyph medallion, holding a face */
  disc:     { radius: '999px', ratio: 1 },
  /* the default. A card-shaped window, matches the product */
  rounded:  { radius: '28px',  ratio: 4 / 5 },
  /* wide, for screen recordings and product shots */
  wide:     { radius: '22px',  ratio: 16 / 9 },
  /* vertical, for a phone-shot reaction clip dropped in whole */
  portrait: { radius: '26px',  ratio: 9 / 16 },
  /* square, feed-native */
  square:   { radius: '24px',  ratio: 1 },
  /* the polaroid. Adds a caption lip under the image */
  polaroid: { radius: '10px',  ratio: 1, lip: 0.22 },
  /* the CRT, a nod to where this came from. Slightly barrelled corners */
  crt:      { radius: '34px',  ratio: 4 / 3 },
};

/* ---------- the frame, drawn as SVG behind the media ---------- */
function wellFrame({ w, h, key, ink, fill, extrude = 'slab', radius = 28, sx = 11, sy = 13 }) {
  const r = radius === 999 ? Math.min(w, h) / 2 : radius;
  const rect = (x, y, ww, hh, rr, f) =>
    `<rect x="${x}" y="${y}" width="${ww}" height="${hh}" rx="${rr}" fill="${f}"/>`;
  const body = rect(key / 2, key / 2, w - key, h - key, r, fill);
  const ex = extrude === 'slab'
    ? `<g transform="translate(${sx},${sy})">${rect(key / 2, key / 2, w - key, h - key, r, ink)}</g>` : '';
  const line = `<rect x="${key / 2}" y="${key / 2}" width="${w - key}" height="${h - key}" rx="${r}"
                 fill="none" stroke="${ink}" stroke-width="${key}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w + sx}" height="${h + sy}"
            viewBox="0 0 ${w + sx} ${h + sy}" fill="none">${ex}${body}${line}</svg>`;
}

/* ---------- the media layer ----------
   Satori renders <img> and ignores anything it cannot decode, so the
   video branch is only emitted when the caller says the target is a
   DOM or Remotion renderer. */
function mediaLayer({ kind, src, poster, w, h, radius, focal = '50% 40%', target }) {
  const common = `width:${w}px;height:${h}px;object-fit:cover;object-position:${focal};border-radius:${radius};`;
  if (kind === 'video' && target !== 'satori') {
    return `<video src="${src}" poster="${poster || ''}" autoplay muted loop playsinline
              style="${common}display:block;"></video>`;
  }
  return `<img src="${kind === 'video' ? (poster || src) : src}" style="${common}display:block;"/>`;
}

/* ============================================================
   renderWell(spec, canvasKey, target)
     spec.shape    key of WELL_SHAPES
     spec.kind     'image' | 'video'
     spec.src      clip or image URL, or a data URI
     spec.poster   still frame, required when kind is 'video'
     spec.size     multiplier on the canvas base, same as a nugget
     spec.caption  optional strip under the media
     spec.kicker   optional small label above the caption
     spec.badge    optional corner chip, e.g. a record dot or a play mark
     spec.focal    object-position, defaults to a face-safe 50% 40%
     target        'satori' | 'dom'. Only changes the media element.
   ============================================================ */

/* ============================================================
   THE GEOMETRY, ON ITS OWN

   renderWell() worked its layout out inline and emitted HTML, which
   is right for the DOM, Satori and Remotion and no use at all to
   anything drawing on a canvas or rasterising an SVG. Pulling the
   numbers out into wellLayout() lets a second renderer place a well
   without a second opinion about where its parts go: renderWell now
   asks the same function, so the two cannot drift.

   wellSvg() is that second renderer. wellFrame already emitted SVG;
   only the media and the copy were HTML, and both have SVG forms.
   ============================================================ */

/** Every measurement of a well, in px, for a given canvas. */
export function wellLayout(spec = {}, C) {
  const {
    shape = 'rounded', size = 1, caption = null, kicker = null,
  } = spec;

  const S = WELL_SHAPES[shape] || WELL_SHAPES.rounded;
  const key = C.k;
  const fs = Math.round(C.base * size * 0.62);

  /* the well is sized off the canvas, not off the media. User media
     never dictates layout, or one tall clip reflows the whole frame. */
  const mediaW = Math.round(C.w * 0.34 * size);
  const mediaH = Math.round(mediaW / S.ratio);
  const lip = S.lip ? Math.round(mediaH * S.lip) : 0;
  const pad = Math.round(key * 1.6);

  /* the caption is measured and wrapped before the frame is sized, so
     the box always fits its own copy. */
  const lineH = Math.round(fs * 1.18);
  const capLines = caption ? wrapText(caption, fs, Math.round(mediaW * 0.94), 'sans') : [];
  const capH = caption ? capLines.length * lineH + Math.round(fs * 0.34) : 0;
  const kickFs = Math.round(fs * 0.7);
  const kickH = kicker ? Math.round(kickFs * 1.7) : 0;

  const w = mediaW + pad * 2;
  const h = mediaH + lip + pad * 2 + capH + kickH;
  const sx = 11, sy = 13;                       /* the slab offsets */

  return {
    shape: S, key, fs, pad, lip,
    mediaW, mediaH,
    /* where the media sits inside the frame */
    mediaX: pad, mediaY: pad,
    radius: shape === 'disc' ? Math.min(w, h) / 2 : parseInt(S.radius, 10),
    capLines, capH, lineH, kickFs, kickH,
    /* the copy block, under the media and its lip */
    textX: pad, textY: pad + mediaH + lip + Math.round(fs * 0.34),
    /* the frame, and the box including its extrude */
    w, h, sx, sy, outerW: w + sx, outerH: h + sy,
  };
}

/**
 * A well as one self-contained SVG.
 *
 * The same thing renderWell() draws, in the form anything that
 * rasterises can use. A clip cannot live in an SVG <image>, so
 * `kind: 'video'` draws the poster if there is one and otherwise
 * leaves the media area empty for a renderer to fill.
 */
export function wellSvg(spec = {}, C) {
  const L = wellLayout(spec, C);
  const {
    kind = 'image', src = '', poster = null, caption = null, kicker = null,
    badge = null, fill = BRAND.cream, accent = BRAND.red, tilt = 0,
  } = spec;

  const still = kind === 'video' ? poster : src;
  const cid = 'wm' + Math.random().toString(36).slice(2, 8);
  const font = "'PK Stack',sans-serif";

  const media = still
    ? `<clipPath id="${cid}"><rect x="${L.mediaX}" y="${L.mediaY}" width="${L.mediaW}" height="${L.mediaH}"
         rx="${L.radius}"/></clipPath>
       <g clip-path="url(#${cid})"><image href="${still}" x="${L.mediaX}" y="${L.mediaY}"
         width="${L.mediaW}" height="${L.mediaH}" preserveAspectRatio="xMidYMid slice"/></g>`
    : '';

  let y = L.textY;
  let copy = '';
  if (kicker) {
    y += L.kickFs;
    copy += `<text x="${L.textX}" y="${y}" font-family="${font}" font-weight="700"
      font-size="${L.kickFs}" letter-spacing="${L.kickFs * 0.14}" fill="${accent}"
      >${esc(String(kicker).toUpperCase())}</text>`;
    y += Math.round(L.kickFs * 0.7);
  }
  for (const line of L.capLines) {
    y += L.lineH;
    copy += `<text x="${L.textX}" y="${y - Math.round(L.fs * 0.28)}" font-family="${font}"
      font-weight="700" font-size="${L.fs}" fill="${INK}">${esc(line)}</text>`;
  }

  const badgeEl = badge ? (() => {
    const bh = Math.round(L.fs * 1.5);
    const bfs = Math.round(L.fs * 0.66);
    const bw = Math.round(String(badge.text || 'LIVE').length * bfs * 0.78 + L.fs * 1.6);
    const bx = L.pad + 10, by = L.pad + 10;
    return `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${bh / 2}"
        fill="${badge.bg || accent}" stroke="${INK}" stroke-width="${Math.max(3, Math.round(L.key * 0.6))}"/>
      <text x="${bx + L.fs * 0.5}" y="${by + bh / 2 + bfs * 0.36}" font-family="${font}"
        font-weight="700" font-size="${bfs}" letter-spacing="${bfs * 0.1}" fill="${BRAND.cream}"
        >${esc(String(badge.text || 'LIVE').toUpperCase())}</text>`;
  })() : '';

  /* wellFrame draws its own <svg>; take its guts so this is one document */
  const frame = wellFrame({
    w: L.w, h: L.h, key: L.key, ink: INK, fill,
    extrude: spec.extrude || 'slab', radius: L.radius, sx: L.sx, sy: L.sy,
  }).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

  const spin = tilt ? ` transform="rotate(${tilt} ${L.outerW / 2} ${L.outerH / 2})"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${L.outerW}" height="${L.outerH}"
    viewBox="0 0 ${L.outerW} ${L.outerH}" fill="none"><g${spin}>${frame}${media}${copy}${badgeEl}</g></svg>`;
}

export function renderWell(spec = {}, C, target = 'dom') {
  const {
    shape = 'rounded', kind = 'image', src = '', poster = null,
    size = 1, caption = null, kicker = null, badge = null,
    focal = '50% 40%', fill = BRAND.cream, accent = BRAND.red,
    tilt = 0, extrude = 'slab',
  } = spec;

  /* one source of geometry, shared with wellSvg */
  const L = wellLayout(spec, C);
  const { S, key, fs, mediaW, mediaH, lip, pad, lineH, capLines, kickFs, w, h } =
    { ...L, S: L.shape };

  const frame = wellFrame({ w, h, key, ink: INK, fill, extrude, radius: shape === 'disc' ? 999 : parseInt(S.radius) });
  const media = mediaLayer({ kind, src, poster, w: mediaW, h: mediaH, radius: S.radius, focal, target });

  const badgeEl = badge ? `
    <div style="position:absolute;left:${pad + 10}px;top:${pad + 10}px;height:${Math.round(fs * 1.5)}px;
      padding:0 ${Math.round(fs * 0.5)}px;border-radius:999px;background:${badge.bg || accent};
      border:${Math.max(3, Math.round(key * 0.6))}px solid ${INK};display:flex;align-items:center;">
      ${badge.dot !== false ? `<div style="width:${Math.round(fs * 0.5)}px;height:${Math.round(fs * 0.5)}px;
        border-radius:999px;background:${BRAND.cream};margin-right:${Math.round(fs * 0.34)}px;"></div>` : ''}
      <div style="font-family:${'Stack Sans, system-ui'};font-size:${Math.round(fs * 0.66)}px;font-weight:700;
        letter-spacing:0.1em;color:${BRAND.cream};">${esc((badge.text || 'LIVE').toUpperCase())}</div>
    </div>` : '';

  return `<div style="position:relative;width:${w + 11}px;height:${h + 13}px;display:flex;transform:rotate(${tilt}deg);">
    <img src="${uri(frame)}" style="position:absolute;left:0;top:0;width:${w + 11}px;height:${h + 13}px;"/>
    <div style="position:absolute;left:${pad}px;top:${pad}px;display:flex;">${media}</div>
    ${badgeEl}
    ${(kicker || caption) ? `<div style="position:absolute;left:${pad}px;top:${pad + mediaH + lip + Math.round(fs * 0.34)}px;
      width:${mediaW}px;display:flex;flex-direction:column;">
      ${kicker ? `<div style="display:flex;font-family:Stack Sans, system-ui;font-size:${kickFs}px;font-weight:700;
        letter-spacing:0.14em;line-height:${Math.round(kickFs * 1.7)}px;color:${accent};">${esc(kicker.toUpperCase())}</div>` : ''}
      ${capLines.map(l => `<div style="display:flex;font-family:Stack Sans, system-ui;font-size:${fs}px;
        font-weight:700;line-height:${lineH}px;color:${INK};white-space:pre;">${esc(l)}</div>`).join('')}
    </div>` : ''}
  </div>`;
}

/* ============================================================
   THE MEDIA TEMPLATES
   Same discipline as the nugget registry. The template fixes shape,
   proportion and furniture. The creator supplies the clip and, at
   most, one line of copy.
   ============================================================ */
export const WELL_TEMPLATES = [
  { id: 'W01', name: 'Reaction Well', use: 'The face when the card is opened. The workhorse.',
    spec: { shape: 'portrait', kind: 'video', caption: 'She read the inside first.', badge: { text: 'UGC' } } },

  { id: 'W02', name: 'Reaction Disc', use: 'Same beat, medallion form. Sits beside a caption nugget.',
    spec: { shape: 'disc', kind: 'video', size: 0.7 } },

  { id: 'W03', name: 'Unboxing Strip', use: 'Envelope to card to face. Three wells in a row, one per beat.',
    spec: { shape: 'square', kind: 'video', size: 0.62, kicker: 'the open' } },

  { id: 'W04', name: 'Product Card', use: 'The printed card itself, held. Portrait, card proportions.',
    spec: { shape: 'rounded', kind: 'image', caption: 'Printed, sealed, posted.' } },

  { id: 'W05', name: 'Screen Recording', use: 'Stampy building the card. Wide, for app capture.',
    spec: { shape: 'wide', kind: 'video', kicker: 'in the app', caption: 'Forty seconds, start to sent.' } },

  { id: 'W06', name: 'Polaroid', use: 'A memory, not a demo. Caption lip under the image.',
    spec: { shape: 'polaroid', kind: 'image', caption: 'Mum, 2019.' } },

  { id: 'W07', name: 'CRT Well', use: 'The house nod to where the format came from. Use sparingly.',
    spec: { shape: 'crt', kind: 'video', badge: { text: 'REC', bg: BRAND.red } } },

  { id: 'W08', name: 'Before and After', use: 'Two wells, one bracket between them.',
    spec: { shape: 'square', kind: 'image', size: 0.72, kicker: 'before' } },

  { id: 'W09', name: 'Picture in Nugget', use: 'A small well replacing the medallion inside a caption nugget.',
    spec: { shape: 'disc', kind: 'image', size: 0.5 } },

  { id: 'W10', name: 'Quote Well', use: 'Customer face plus what they actually typed.',
    spec: { shape: 'square', kind: 'image', size: 0.8, caption: '"I cried in the post office."', kicker: 'support ticket' } },
];

export const WELL_IDS = WELL_TEMPLATES.map(t => t.id);
