"use client";

import { quadArea, type Pt, type Quad } from "@/lib/perspective";

/**
 * Locates the blank device screen in a generated scene.
 *
 * The scene prompt asks for a pure flat white screen with all four corners in
 * frame and no glare, which makes it the largest clean bright quadrilateral in
 * the shot. That's what this looks for: the biggest near-white low-saturation
 * blob whose shape is genuinely rectangular.
 *
 * Runs on a downscaled copy — corner precision at ~2px of the source is plenty,
 * and the caller can nudge the result by hand anyway.
 */

/* Higher costs a few ms of flood fill but halves the corner error, which is the
   difference between a clean edge and a bright sliver of bare screen. */
const WORK_EDGE = 900;

type Mask = { data: Uint8Array; w: number; h: number };

function buildMask(bitmap: ImageBitmap): { mask: Mask; scale: number } | null {
  const scale = Math.min(1, WORK_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Threshold relative to the brightest part of the image so a warm or slightly
  // dimmed screen still qualifies.
  const hist = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    hist[Math.min(data[i], data[i + 1], data[i + 2])]++;
  }
  const total = w * h;
  let seen = 0;
  let p98 = 255;
  for (let v = 255; v >= 0; v--) {
    seen += hist[v];
    if (seen >= total * 0.02) {
      p98 = v;
      break;
    }
  }
  const minLum = Math.max(150, p98 - 40);

  const raw = new Uint8Array(w * h);
  for (let i = 0, px = 0; i < data.length; i += 4, px++) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lo = Math.min(r, g, b);
    const hi = Math.max(r, g, b);
    raw[px] = lo >= minLum && hi - lo <= 38 ? 1 : 0;
  }

  // Erode once so a white screen touching a white table doesn't fuse into one blob.
  const mask = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      mask[i] =
        raw[i] && raw[i - 1] && raw[i + 1] && raw[i - w] && raw[i + w] ? 1 : 0;
    }
  }
  return { mask: { data: mask, w, h }, scale };
}

/** Largest 4-connected blob, returned as its pixel indices. */
function largestBlob({ data, w, h }: Mask): number[] | null {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let best: number[] | null = null;

  for (let start = 0; start < data.length; start++) {
    if (!data[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    const blob: number[] = [];

    while (top > 0) {
      const i = stack[--top];
      blob.push(i);
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0 && data[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && data[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && data[i - w] && !seen[i - w]) { seen[i - w] = 1; stack[top++] = i - w; }
      if (y < h - 1 && data[i + w] && !seen[i + w]) { seen[i + w] = 1; stack[top++] = i + w; }
    }
    if (!best || blob.length > best.length) best = blob;
  }
  return best;
}

/** Corner extraction for a convex, roughly upright quad. */
function cornersOf(blob: number[], w: number): Quad {
  let tl = 0, tr = 0, br = 0, bl = 0;
  let tlV = Infinity, trV = -Infinity, brV = -Infinity, blV = Infinity;

  for (const i of blob) {
    const x = i % w;
    const y = (i / w) | 0;
    const sum = x + y;
    const diff = x - y;
    if (sum < tlV) { tlV = sum; tl = i; }
    if (sum > brV) { brV = sum; br = i; }
    if (diff > trV) { trV = diff; tr = i; }
    if (diff < blV) { blV = diff; bl = i; }
  }
  const pt = (i: number): Pt => ({ x: i % w, y: (i / w) | 0 });
  return [pt(tl), pt(tr), pt(br), pt(bl)];
}

export type Detection = { quad: Quad; confidence: number };

export function detectScreenQuad(bitmap: ImageBitmap): Detection | null {
  const built = buildMask(bitmap);
  if (!built) return null;
  const { mask, scale } = built;

  const blob = largestBlob(mask);
  if (!blob) return null;

  const frameArea = mask.w * mask.h;
  if (blob.length < frameArea * 0.015) return null; // too small to be the screen
  if (blob.length > frameArea * 0.85) return null; // that's the whole picture

  const quad = cornersOf(blob, mask.w);
  const area = quadArea(quad);
  if (area <= 0) return null;

  // A rectangle fills its own corner-quad; an ellipse only fills ~78% of it.
  // This is what keeps plates, cups and mugs from being mistaken for a screen.
  const fill = blob.length / area;
  if (fill < 0.86) return null;

  const width = Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y);
  const height = Math.hypot(quad[3].x - quad[0].x, quad[3].y - quad[0].y);
  if (width < 8 || height < 8) return null;
  const ratio = width / height;
  if (ratio < 0.15 || ratio > 6) return null;

  /*
   * The erode step and the brightness threshold both bite ~1px off every edge at
   * working scale, which becomes several pixels once scaled back up. Push each
   * corner back out along its ray from the centre to undo that.
   *
   * Deliberately biased slightly outward: artwork spilling a hair onto the black
   * bezel is invisible, whereas falling short leaves a bright sliver of bare
   * screen around the card.
   */
  const inv = 1 / scale;
  const full = quad.map((p) => ({ x: p.x * inv, y: p.y * inv }));

  const cx = (full[0].x + full[1].x + full[2].x + full[3].x) / 4;
  const cy = (full[0].y + full[1].y + full[2].y + full[3].y) / 4;
  /* Overhang onto the dark bezel is invisible at social sizes; falling short
     leaves a bright rim of bare screen around the card, which is not. */
  const OUTSET = 13; // source pixels
  const grown = full.map(({ x, y }) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: x + (dx / len) * OUTSET, y: y + (dy / len) * OUTSET };
  }) as Quad;

  return { quad: grown, confidence: Math.min(1, fill) };
}
