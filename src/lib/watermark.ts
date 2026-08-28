"use client";

/**
 * The HeartStamp wordmark, stamped into the bottom-right corner.
 *
 * Two pre-coloured variants rather than one recoloured at runtime: the source
 * SVG paints its lettering with `currentColor`, which resolves to black when an
 * SVG is loaded through an <img> and has no CSS context to inherit from. Baking
 * the colours into two files removes that trap entirely — see
 * public/TextLogo-on-dark.svg and public/TextLogo-on-light.svg, both generated
 * from public/TextLogo.svg.
 *
 * The heart is always the opposite tone to the lettering it sits beside — red
 * next to white, pink next to black. Pairing pink with white washed both out
 * against a dark frame, which is the mistake this arrangement corrects.
 */

export const LOGO_SRC = {
  /** White lettering, red heart — for dark corners. */
  onDark: "/TextLogo-on-dark.svg",
  /** Black lettering, pink heart — for light corners. */
  onLight: "/TextLogo-on-light.svg",
} as const;

export type LogoVariant = keyof typeof LOGO_SRC;
export type LogoSet = Record<LogoVariant, ImageBitmap>;

/** Width of the wordmark as a fraction of the image's shorter edge. */
const LOGO_SCALE = 0.28;
/** Margin from the right/bottom edges, as a fraction of the shorter edge. */
const LOGO_MARGIN = 0.04;

/**
 * Rasterise width. The wordmark is 140×35, so this is 8× — comfortably above
 * the largest size it is ever drawn at (0.28 of a 3840px edge is ~1075px), which
 * keeps the lettering crisp instead of relying on how a given browser scales an
 * SVG during drawImage.
 */
const RASTER_WIDTH = 1120;

/**
 * Above this relative luminance the corner counts as light, and the dark
 * wordmark is used. Set above 0.5 deliberately: white lettering survives a
 * mid-tone far better than black does, so the tie goes to the light logo.
 */
const LIGHT_CORNER_THRESHOLD = 0.62;

let logoPromise: Promise<LogoSet> | null = null;

/**
 * Rasterises one SVG variant at a fixed size.
 *
 * Goes through an <img> rather than createImageBitmap(blob): SVG support in
 * createImageBitmap is uneven across browsers, while <img> has decoded SVG
 * everywhere for years.
 */
async function rasterise(src: string): Promise<ImageBitmap> {
  const img = new Image();
  img.src = src;
  await img.decode().catch(() => {
    throw new Error(`Could not load the HeartStamp logo (${src}).`);
  });

  const ratio = (img.naturalHeight || 35) / (img.naturalWidth || 140);
  const canvas = document.createElement("canvas");
  canvas.width = RASTER_WIDTH;
  canvas.height = Math.round(RASTER_WIDTH * ratio);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return createImageBitmap(canvas);
}

/** Loads both variants, once per page. */
function loadLogos(): Promise<LogoSet> {
  logoPromise ??= Promise.all([rasterise(LOGO_SRC.onDark), rasterise(LOGO_SRC.onLight)])
    .then(([onDark, onLight]) => ({ onDark, onLight }))
    .catch((err) => {
      logoPromise = null; // let a later attempt retry
      throw err;
    });
  return logoPromise;
}

export const heartStampLogo = loadLogos;

/**
 * The wordmark's own proportions, for callers with no bitmap to measure.
 *
 * The two SVGs are 140x35. A DOM overlay needs the same box as the canvas
 * painter without loading and rasterising anything to ask.
 */
export const LOGO_ASPECT = 35 / 140;

/**
 * Where the wordmark lands, in the pixels of whatever it is being drawn into.
 *
 * Exported because the PopKit editor draws the same mark as a DOM element over
 * a scaled stage while the render paints it into a canvas. Two implementations
 * of "bottom right, 28% of the short edge, 4% in" would agree until one of
 * these constants moved, and then the preview would quietly stop predicting
 * the render.
 */
export function logoBox(width: number, height: number, aspect = LOGO_ASPECT) {
  const shortEdge = Math.min(width, height);
  const w = Math.round(shortEdge * LOGO_SCALE);
  const h = Math.round(w * aspect);
  const margin = Math.round(shortEdge * LOGO_MARGIN);
  return { x: width - w - margin, y: height - h - margin, w, h };
}

/** Where the wordmark lands, in canvas pixels. */
function logoRect(logo: ImageBitmap, width: number, height: number) {
  return logoBox(width, height, logo.height / logo.width);
}

/**
 * Decides which wordmark the bottom-right corner needs.
 *
 * Reads the pixels the logo is about to cover and averages their relative
 * luminance (Rec. 709 on gamma-corrected sRGB — near enough for a threshold, and
 * far cheaper than linearising every sample). Sampling is on a grid rather than
 * every pixel: a few hundred samples settle the question, and reading a
 * 1000×250 block off a 4K frame does not.
 *
 * Must be called *before* the logo is drawn, or it measures its own output.
 */
export function pickLogoVariant(
  ctx: CanvasRenderingContext2D,
  logo: ImageBitmap,
  width: number,
  height: number,
): LogoVariant {
  const { x, y, w, h } = logoRect(logo, width, height);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(x, y, Math.max(1, w), Math.max(1, h)).data;
  } catch {
    // A tainted canvas can't be read. White-on-dark is the safer default: it
    // carries the brand colour and stays legible on all but the palest corners.
    return "onDark";
  }

  const pixels = w * h;
  const step = Math.max(1, Math.floor(pixels / 400));

  let total = 0;
  let counted = 0;
  for (let i = 0; i < pixels; i += step) {
    const p = i * 4;
    total += (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255;
    counted++;
  }

  const luminance = counted ? total / counted : 0;
  return luminance > LIGHT_CORNER_THRESHOLD ? "onLight" : "onDark";
}

/**
 * Draws the wordmark into the bottom-right corner of an already-drawn canvas.
 *
 * Pass `variant` to force one. The video path does exactly that, measuring the
 * clip's last frame and holding that choice throughout: measuring every frame
 * would let the logo flip colour mid-clip the moment something bright moved
 * through the corner, and the last frame is the one the mark has to work on.
 */
export function paintLogo(
  ctx: CanvasRenderingContext2D,
  logos: LogoSet,
  width: number,
  height: number,
  variant?: LogoVariant,
): LogoVariant {
  const chosen = variant ?? pickLogoVariant(ctx, logos.onDark, width, height);
  const logo = logos[chosen];
  const { x, y, w, h } = logoRect(logo, width, height);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logo, x, y, w, h);
  return chosen;
}

/**
 * Where a still lands when cover-cropped into a frame.
 *
 * Exported because the two places that have to agree about which pixels the
 * mark covers both need it: the render, which draws the still this way every
 * frame, and the editor, which has to sample the same patch to predict the
 * colourway. A second copy of `Math.max` here would be a colourway that is
 * right until someone changes how a still is fitted.
 */
export function coverFit(sourceW: number, sourceH: number, width: number, height: number) {
  const k = Math.max(width / (sourceW || 1), height / (sourceH || 1));
  const dw = (sourceW || 1) * k;
  const dh = (sourceH || 1) * k;
  return { dx: (width - dw) / 2, dy: (height - dh) / 2, dw, dh };
}

/**
 * Which colourway a background calls for, without touching anything on screen.
 *
 * Draws the frame onto a canvas of its own and reads the corner. A scratch
 * canvas rather than a live one is the whole point: painting a measurement onto
 * a canvas that something is recording put a frame of bare background at the
 * head of every stamped render, and painting it onto one the user is watching
 * would be worse.
 *
 * Same dimensions as the real frame, because the sample rect is in frame pixels
 * — a scaled-down copy reads a different patch of the picture and can pick the
 * opposite colourway on a corner that is close to the threshold.
 */
export function variantForBackground(
  logos: LogoSet,
  source: CanvasImageSource,
  width: number,
  height: number,
  /** Where a cover-cropped still lands. Omit for a clip, which fills the frame. */
  fit?: { dx: number; dy: number; dw: number; dh: number } | null,
): LogoVariant {
  const cv = document.createElement("canvas");
  cv.width = width;
  cv.height = height;
  const ctx = cv.getContext("2d", { alpha: false });
  if (!ctx) return "onDark";

  if (fit) ctx.drawImage(source, fit.dx, fit.dy, fit.dw, fit.dh);
  else ctx.drawImage(source, 0, 0, width, height);

  const variant = pickLogoVariant(ctx, logos.onDark, width, height);
  // Let the backing store go now rather than at the next collection; these are
  // full-frame canvases and the editor makes a new one per background.
  cv.width = 0;
  cv.height = 0;
  return variant;
}
