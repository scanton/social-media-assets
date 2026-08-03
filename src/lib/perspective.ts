"use client";

export type Pt = { x: number; y: number };
/** Screen corners in source-image pixels, always ordered TL, TR, BR, BL. */
export type Quad = [Pt, Pt, Pt, Pt];

/**
 * Projective map of the unit square onto a quad (Heckbert's formulation).
 * (0,0)->q[0], (1,0)->q[1], (1,1)->q[2], (0,1)->q[3].
 */
function unitSquareToQuad(q: Quad) {
  const [p0, p1, p2, p3] = q;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;

  // Parallelogram — the map is affine and the projective terms vanish.
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9) {
    return {
      a: p1.x - p0.x, b: p3.x - p0.x, c: p0.x,
      d: p1.y - p0.y, e: p3.y - p0.y, f: p0.y,
      g: 0, h: 0,
    };
  }

  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const den = dx1 * dy2 - dy1 * dx2;

  const g = (sx * dy2 - sy * dx2) / den;
  const h = (dx1 * sy - dy1 * sx) / den;

  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
}

type Proj = ReturnType<typeof unitSquareToQuad>;

const project = (m: Proj, u: number, v: number): Pt => {
  const w = m.g * u + m.h * v + 1;
  return { x: (m.a * u + m.b * v + m.c) / w, y: (m.d * u + m.e * v + m.f) / w };
};

/** Nudges a triangle outward from its centroid to hide seams between cells. */
function expand(p: Pt[], by: number): Pt[] {
  const cx = (p[0].x + p[1].x + p[2].x) / 3;
  const cy = (p[0].y + p[1].y + p[2].y) / 3;
  return p.map(({ x, y }) => {
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: x + (dx / len) * by, y: y + (dy / len) * by };
  });
}

/** Draws one source triangle into one destination triangle with an affine map. */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  s: Pt[],
  d: Pt[],
) {
  const den = (s[1].x - s[0].x) * (s[2].y - s[0].y) - (s[2].x - s[0].x) * (s[1].y - s[0].y);
  if (Math.abs(den) < 1e-9) return;

  const a = ((d[1].x - d[0].x) * (s[2].y - s[0].y) - (d[2].x - d[0].x) * (s[1].y - s[0].y)) / den;
  const c = ((d[2].x - d[0].x) * (s[1].x - s[0].x) - (d[1].x - d[0].x) * (s[2].x - s[0].x)) / den;
  const b = ((d[1].y - d[0].y) * (s[2].y - s[0].y) - (d[2].y - d[0].y) * (s[1].y - s[0].y)) / den;
  const e = ((d[2].y - d[0].y) * (s[1].x - s[0].x) - (d[1].y - d[0].y) * (s[2].x - s[0].x)) / den;

  ctx.save();
  const grown = expand(d, 0.6);
  ctx.beginPath();
  ctx.moveTo(grown[0].x, grown[0].y);
  ctx.lineTo(grown[1].x, grown[1].y);
  ctx.lineTo(grown[2].x, grown[2].y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, e, d[0].x - a * s[0].x - c * s[0].y, d[0].y - b * s[0].x - e * s[0].y);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

/**
 * Warps an image onto an arbitrary quad.
 *
 * Canvas 2D can only do affine transforms, so the unit square is subdivided into
 * a mesh and each cell drawn affinely. At this density the error inside a cell is
 * well under a pixel, which is what lets the artwork land pixel-accurate instead
 * of being re-imagined by the image model.
 */
export function drawImageInQuad(
  ctx: CanvasRenderingContext2D,
  img: ImageBitmap,
  quad: Quad,
  steps = 32,
) {
  const m = unitSquareToQuad(quad);
  const sw = img.width;
  const sh = img.height;

  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const u0 = i / steps;
      const u1 = (i + 1) / steps;
      const v0 = j / steps;
      const v1 = (j + 1) / steps;

      const s00 = { x: u0 * sw, y: v0 * sh };
      const s10 = { x: u1 * sw, y: v0 * sh };
      const s11 = { x: u1 * sw, y: v1 * sh };
      const s01 = { x: u0 * sw, y: v1 * sh };

      const d00 = project(m, u0, v0);
      const d10 = project(m, u1, v0);
      const d11 = project(m, u1, v1);
      const d01 = project(m, u0, v1);

      drawTriangle(ctx, img, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(ctx, img, [s00, s11, s01], [d00, d11, d01]);
    }
  }
}

export const quadArea = (q: Quad) => {
  let a = 0;
  for (let i = 0; i < 4; i++) {
    const p = q[i];
    const n = q[(i + 1) % 4];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
};
