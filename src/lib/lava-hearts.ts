/**
 * Lava Hearts — metaball field rendered as a grid of hearts.
 *
 * Vendored from the user's own https://github.com/scanton/loader-animation
 * (`src/lib/animations/`), consolidated into one file because this app uses
 * exactly one of that repo's animations. The function bodies are unchanged from
 * upstream so a re-sync stays a diff rather than a rewrite:
 *
 *   core/lavaMath.ts  → NUM_BLOBS…computeField
 *   core/heartMath.ts → smoothstep
 *   core/gridMath.ts  → computeGrid, forEachGridPoint, HEART_DOT_MAX_RADIUS_RATIO
 *   heartPath.ts      → drawHeart
 *   lavaHearts.ts     → drawHeartsFrame
 *
 * Colour is a parameter rather than upstream's palette module: here it comes
 * from the HeartStamp brand ramp, not that repo's dark/light palettes.
 */

export interface Blob {
  x: number;
  y: number;
  vx: number;
  vy: number;
  strength: number;
}

/* ------------------------------ lava math ------------------------------ */

const NUM_BLOBS = 3;
const SPEED = 0.4;

// Blob size scales with the canvas: each blob's "core" radius (where dots hit
// full size, i.e. where the field crosses FIELD_HIGH) is a random fraction of
// the smaller canvas dimension, and its strength is derived from that radius:
//   field(coreRadius) = FIELD_HIGH  ⇒  strength = FIELD_HIGH × (1 + coreRadius²)
const CORE_RADIUS_FRACTION_MIN = 0.13;
const CORE_RADIUS_FRACTION_MAX = 0.18;

// Smoothstep thresholds (raw field units): dots are full-size at FIELD_HIGH
// (the blob core) and taper to minimum by FIELD_LOW (~2.7× the core radius).
const FIELD_LOW = 350;
const FIELD_HIGH = 2500;

export function initBlobs(width: number, height: number): Blob[] {
  const minDim = Math.min(width, height);
  const blobs: Blob[] = [];
  for (let i = 0; i < NUM_BLOBS; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = SPEED + Math.random() * SPEED;
    const coreFraction =
      CORE_RADIUS_FRACTION_MIN +
      Math.random() * (CORE_RADIUS_FRACTION_MAX - CORE_RADIUS_FRACTION_MIN);
    const coreRadius = coreFraction * minDim;
    blobs.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      strength: FIELD_HIGH * (1 + coreRadius * coreRadius),
    });
  }
  return blobs;
}

export function updateBlobs(blobs: Blob[], width: number, height: number, speed = 1): void {
  for (const blob of blobs) {
    blob.x += blob.vx * speed;
    blob.y += blob.vy * speed;
    if (blob.x < 0 || blob.x > width) blob.vx *= -1;
    if (blob.y < 0 || blob.y > height) blob.vy *= -1;
    blob.x = Math.max(0, Math.min(width, blob.x));
    blob.y = Math.max(0, Math.min(height, blob.y));
  }
}

function computeField(gx: number, gy: number, blobs: Blob[]): number {
  let field = 0;
  for (const blob of blobs) {
    const dx = gx - blob.x;
    const dy = gy - blob.y;
    field += blob.strength / (1 + dx * dx + dy * dy);
  }
  return field;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/* ------------------------------ grid math ------------------------------ */

// Lava Hearts renders slightly smaller than Lava Dots at the same field value —
// heart silhouettes read as "larger" than circles of the same radius, so the
// max is nudged down to keep visual weight consistent between the two modes.
const HEART_DOT_MAX_RADIUS_RATIO = 0.22;

function forEachGridPoint(
  width: number,
  height: number,
  gridSpacing: number,
  fn: (gx: number, gy: number) => void,
): void {
  const cols = Math.floor(width / gridSpacing);
  const rows = Math.floor(height / gridSpacing);
  const offsetX = (width - cols * gridSpacing) / 2 + gridSpacing / 2;
  const offsetY = (height - rows * gridSpacing) / 2 + gridSpacing / 2;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      fn(offsetX + col * gridSpacing, offsetY + row * gridSpacing);
    }
  }
}

/* ------------------------------ heart path ----------------------------- */

/** Draws a heart centred at (cx, cy) with the given radius. */
function drawHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number): void {
  const steps = 64;
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const s = radius / 16;
    if (i === 0) ctx.moveTo(cx + hx * s, cy + hy * s);
    else ctx.lineTo(cx + hx * s, cy + hy * s);
  }
  ctx.closePath();
}

/* -------------------------------- frame -------------------------------- */

export function drawHeartsFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  blobs: Blob[],
  gridSpacing: number,
  color: string,
): void {
  ctx.clearRect(0, 0, width, height);

  const minR = 0.8;
  const maxR = gridSpacing * HEART_DOT_MAX_RADIUS_RATIO;

  ctx.fillStyle = color;

  forEachGridPoint(width, height, gridSpacing, (gx, gy) => {
    const field = computeField(gx, gy, blobs);
    const t = smoothstep(FIELD_LOW, FIELD_HIGH, field);
    const r = minR + (maxR - minR) * t;

    if (r < 1.5) {
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(0.5, r), 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(gx, gy);
      drawHeart(ctx, 0, 0, r);
      ctx.fill();
      ctx.restore();
    }
  });
}
