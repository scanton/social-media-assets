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

/** Where the wordmark lands, in canvas pixels. */
function logoRect(logo: ImageBitmap, width: number, height: number) {
  const shortEdge = Math.min(width, height);
  const w = Math.round(shortEdge * LOGO_SCALE);
  const h = Math.round(w * (logo.height / logo.width));
  const margin = Math.round(shortEdge * LOGO_MARGIN);
  return { x: width - w - margin, y: height - h - margin, w, h };
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
