"use client";


/** The emblem in public/. Spaces are fine once encoded. */
export const LOGO_SRC = "/HS_Logo_Emblem_White%20on%20Red.png";

/** Width of the *visible* mark as a fraction of the image's shorter edge. */
const LOGO_SCALE = 0.11;
/** Margin from the right/bottom edges, as a fraction of the shorter edge. */
const LOGO_MARGIN = 0.045;

let logoPromise: Promise<ImageBitmap> | null = null;

/**
 * Finds the opaque bounds of the artwork, so transparent padding around the
 * emblem doesn't shrink it.
 *
 * The supplied PNGs disagree on this — the 3959px master carries ~30% padding
 * while the old 85px export had none — so trimming is what keeps LOGO_SCALE
 * meaning "how wide the heart is" no matter which file is dropped in.
 *
 * The scan runs on a 256px copy and the box is mapped back up; at full res
 * that's accurate to a fraction of a percent and avoids reading 60 MB of pixels.
 */
function opaqueBounds(bitmap: ImageBitmap): { x: number; y: number; w: number; h: number } | null {
  const probe = 256;
  const scale = Math.min(1, probe / Math.max(bitmap.width, bitmap.height));
  const pw = Math.max(1, Math.round(bitmap.width * scale));
  const ph = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(bitmap, 0, 0, pw, ph);
  const { data } = ctx.getImageData(0, 0, pw, ph);

  let minX = pw;
  let minY = ph;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (data[(y * pw + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // fully transparent — leave it alone

  const inv = 1 / scale;
  const x = Math.max(0, Math.floor(minX * inv));
  const y = Math.max(0, Math.floor(minY * inv));
  return {
    x,
    y,
    w: Math.min(bitmap.width - x, Math.ceil((maxX - minX + 1) * inv)),
    h: Math.min(bitmap.height - y, Math.ceil((maxY - minY + 1) * inv)),
  };
}

/** Loads (once per page) the emblem, cropped to its visible bounds. */
function loadLogo(): Promise<ImageBitmap> {
  logoPromise ??= fetch(LOGO_SRC)
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load the HeartStamp logo (${res.status}).`);
      return res.blob();
    })
    .then(async (blob) => {
      const full = await createImageBitmap(blob);
      const box = opaqueBounds(full);
      if (!box || (box.w === full.width && box.h === full.height)) return full;
      const trimmed = await createImageBitmap(full, box.x, box.y, box.w, box.h);
      full.close();
      return trimmed;
    })
    .catch((err) => {
      logoPromise = null; // let a later attempt retry
      throw err;
    });
  return logoPromise;
}

/** Loads the emblem, cropped to its visible bounds. Shared with the compositor. */
export const heartStampLogo = loadLogo;

/** Draws the emblem into the bottom-right corner of an already-drawn canvas. */
export function paintLogo(
  ctx: CanvasRenderingContext2D,
  logo: ImageBitmap,
  width: number,
  height: number,
) {
  const shortEdge = Math.min(width, height);
  const logoWidth = Math.round(shortEdge * LOGO_SCALE);
  const logoHeight = Math.round(logoWidth * (logo.height / logo.width));
  const margin = Math.round(shortEdge * LOGO_MARGIN);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(logo, width - logoWidth - margin, height - logoHeight - margin, logoWidth, logoHeight);
}
