"use client";

import { downloadUrl, uploadToFal } from "@/lib/client-api";

/** The emblem Keith dropped in public/. Spaces are fine once encoded. */
export const LOGO_SRC = "/HS_Logo_Emblem_White%20on%20Red%202_small.png";

/** Logo width as a fraction of the image's shorter edge. */
const LOGO_SCALE = 0.11;
/** Margin from the right/bottom edges, as a fraction of the shorter edge. */
const LOGO_MARGIN = 0.045;

let logoPromise: Promise<ImageBitmap> | null = null;

/** Loads (once per page) the emblem bitmap from our own origin. */
function loadLogo(): Promise<ImageBitmap> {
  logoPromise ??= fetch(LOGO_SRC)
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load the HeartStamp logo (${res.status}).`);
      return res.blob();
    })
    .then((blob) => createImageBitmap(blob))
    .catch((err) => {
      logoPromise = null; // let a later attempt retry
      throw err;
    });
  return logoPromise;
}

/**
 * Burns the HeartStamp emblem into the bottom-right corner of a generated still
 * and uploads the result, returning the new fal URL.
 *
 * Done on a canvas rather than by prompting the image model: a brand mark drawn
 * by a diffusion model comes back approximated and differently placed every
 * time. This is pixel-exact and always lands in the same spot.
 *
 * The source image is pulled through our own /api/download proxy so the canvas
 * is never tainted by a cross-origin read.
 */
export async function stampLogo(imageUrl: string): Promise<string> {
  const [logo, source] = await Promise.all([
    loadLogo(),
    fetch(downloadUrl(imageUrl, "source.png"))
      .then((res) => {
        if (!res.ok) throw new Error(`Could not read the generated image (${res.status}).`);
        return res.blob();
      })
      .then((blob) => createImageBitmap(blob)),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  ctx.drawImage(source, 0, 0);

  const shortEdge = Math.min(source.width, source.height);
  const logoWidth = Math.round(shortEdge * LOGO_SCALE);
  const logoHeight = Math.round(logoWidth * (logo.height / logo.width));
  const margin = Math.round(shortEdge * LOGO_MARGIN);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    logo,
    source.width - logoWidth - margin,
    source.height - logoHeight - margin,
    logoWidth,
    logoHeight,
  );

  source.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not encode the stamped image.");

  return uploadToFal(new File([blob], `stamped-${Date.now()}.png`, { type: "image/png" }));
}
