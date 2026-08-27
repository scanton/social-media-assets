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
  /*
   * Any drawable, not just an ImageBitmap. A media well corner-pinned into a
   * scene is often a clip, and turning each frame into a bitmap first would
   * mean an async hop inside a paint loop that has to stay synchronous.
   * drawTriangle already accepted a CanvasImageSource; only this signature
   * did not.
   */
  img: CanvasImageSource,
  quad: Quad,
  opts: { srcRect?: { x: number; y: number; w: number; h: number }; steps?: number } = {},
) {
  const steps = opts.steps ?? 32;
  const m = unitSquareToQuad(quad);
  const src = opts.srcRect ?? { x: 0, y: 0, w: sourceW(img), h: sourceH(img) };

  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const u0 = i / steps;
      const u1 = (i + 1) / steps;
      const v0 = j / steps;
      const v1 = (j + 1) / steps;

      const s00 = { x: src.x + u0 * src.w, y: src.y + v0 * src.h };
      const s10 = { x: src.x + u1 * src.w, y: src.y + v0 * src.h };
      const s11 = { x: src.x + u1 * src.w, y: src.y + v1 * src.h };
      const s01 = { x: src.x + u0 * src.w, y: src.y + v1 * src.h };

      const d00 = project(m, u0, v0);
      const d10 = project(m, u1, v0);
      const d11 = project(m, u1, v1);
      const d01 = project(m, u0, v1);

      drawTriangle(ctx, img, [s00, s10, s11], [d00, d10, d11]);
      drawTriangle(ctx, img, [s00, s11, s01], [d00, d11, d01]);
    }
  }
}

/** Average pixel width and height of a quad's opposing edges. */
export function quadSize(q: Quad) {
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
  return {
    w: (d(q[0], q[1]) + d(q[3], q[2])) / 2,
    h: (d(q[0], q[3]) + d(q[1], q[2])) / 2,
  };
}

/**
 * Centre-crops a source image to the quad's aspect ratio, so artwork covers the
 * screen without being stretched. A 9:16 card on a ~19.5:9 phone screen loses a
 * sliver from each side rather than being squashed.
 *
 * `overscan` pushes the crop slightly tighter still, so the very edge of the
 * artwork — which may be a soft or off-colour margin — never lands right on the
 * screen boundary.
 */
export function coverCrop(
  img: { width: number; height: number },
  quad: Quad,
  overscan = 0,
) {
  const { w: qw, h: qh } = quadSize(quad);
  const target = qw / qh;
  const source = img.width / img.height;

  let w = img.width;
  let h = img.height;
  if (source > target) w = img.height * target;
  else h = img.width / target;

  w *= 1 - overscan;
  h *= 1 - overscan;

  return { x: (img.width - w) / 2, y: (img.height - h) / 2, w, h };
}

/**
 * Outline of the quad with rounded corners, as a projected polyline.
 *
 * Device screens are rounded, so filling the sharp-cornered quad would paint
 * artwork over the bezel's corners. The radius is deliberately a little smaller
 * than a real phone's, which keeps the corners fully covered.
 */
export function roundedQuadPath(quad: Quad, radiusPx: number, perCorner = 10): Pt[] {
  const m = unitSquareToQuad(quad);
  const { w, h } = quadSize(quad);
  const ru = Math.min(0.45, radiusPx / Math.max(w, 1));
  const rv = Math.min(0.45, radiusPx / Math.max(h, 1));

  // Corner centres in unit space, walking TL -> TR -> BR -> BL.
  const arcs: { cu: number; cv: number; from: number }[] = [
    { cu: ru, cv: rv, from: Math.PI },
    { cu: 1 - ru, cv: rv, from: -Math.PI / 2 },
    { cu: 1 - ru, cv: 1 - rv, from: 0 },
    { cu: ru, cv: 1 - rv, from: Math.PI / 2 },
  ];

  const out: Pt[] = [];
  for (const arc of arcs) {
    for (let i = 0; i <= perCorner; i++) {
      const a = arc.from + (Math.PI / 2) * (i / perCorner);
      out.push(project(m, arc.cu + ru * Math.cos(a), arc.cv + rv * Math.sin(a)));
    }
  }
  return out;
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


/* ------------------------- talking to the DOM ------------------------- */

const sourceW = (img: CanvasImageSource): number =>
  (img as HTMLVideoElement).videoWidth ||
  (img as HTMLImageElement).naturalWidth ||
  (img as ImageBitmap).width ||
  1;

const sourceH = (img: CanvasImageSource): number =>
  (img as HTMLVideoElement).videoHeight ||
  (img as HTMLImageElement).naturalHeight ||
  (img as ImageBitmap).height ||
  1;

export { sourceW as sourceWidth, sourceH as sourceHeight };

/**
 * The same projective map as a CSS transform.
 *
 * A homography is exactly what `matrix3d` does when the fourth row is used, so
 * an element sized `w x h` can be corner-pinned live in the DOM by the same
 * numbers the canvas warp uses — one definition of where the thing goes,
 * rather than an editor that approximates what the render will do.
 *
 * `transform-origin: 0 0` is required for this to mean anything: the matrix
 * maps the element's own top-left corner to `quad[0]`.
 */
export function quadToCssMatrix(quad: Quad, w: number, h: number): string {
  const m = unitSquareToQuad(quad);
  // The map is over the unit square, so fold the element's size in first.
  const a = m.a / w, b = m.b / h;
  const d = m.d / w, e = m.e / h;
  const g = m.g / w, hh = m.h / h;
  // Column-major, and the perspective terms live in the fourth row.
  const cells = [a, d, 0, g, b, e, 0, hh, 0, 0, 1, 0, m.c, m.f, 0, 1];
  return `matrix3d(${cells.map((n) => (Number.isFinite(n) ? n : 0).toFixed(6)).join(",")})`;
}

/** A plain rectangle as a quad, in the same winding order. */
export function rectQuad(x: number, y: number, w: number, h: number): Quad {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}
