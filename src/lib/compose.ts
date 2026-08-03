"use client";

import { downloadUrl, uploadToFal } from "@/lib/client-api";
import { drawImageInQuad, type Quad } from "@/lib/perspective";
import { detectScreenQuad } from "@/lib/screen-detect";
import { heartStampLogo, paintLogo } from "@/lib/watermark";

export type ComposeResult = {
  /** Uploaded URL of the finished frame. */
  url: string;
  /** Screen corners used, in render-image pixels — kept so it can be re-aligned. */
  quad: Quad | null;
  /** False when card artwork was supplied but the screen couldn't be located. */
  placed: boolean;
};

/** Same-origin fetch through our proxy, so the canvas is never tainted. */
async function loadImage(url: string, label: string): Promise<ImageBitmap> {
  const res = await fetch(downloadUrl(url, `${label}.png`));
  if (!res.ok) throw new Error(`Could not read the ${label} (${res.status}).`);
  return createImageBitmap(await res.blob());
}

/**
 * Finishes a generated scene in the browser: the card artwork is perspective-
 * warped onto the device screen and the HeartStamp emblem is stamped in the
 * corner, then the result is uploaded.
 *
 * Both are done on a canvas rather than by prompting. GPT-Image-2 treats a
 * reference image as inspiration — it re-typeset a card and dropped its dark
 * background — and an approximate first frame is exactly what makes Seedance
 * stop believing the clip belongs on the screen. This route is pixel-exact.
 */
export async function composeScene(opts: {
  renderUrl: string;
  cardUrl?: string | null;
  /** Supply to override detection (used by the manual aligner). */
  quad?: Quad | null;
  withLogo: boolean;
}): Promise<ComposeResult> {
  const [render, card, logo] = await Promise.all([
    loadImage(opts.renderUrl, "scene"),
    opts.cardUrl ? loadImage(opts.cardUrl, "card") : Promise.resolve(null),
    opts.withLogo ? heartStampLogo() : Promise.resolve(null),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = render.width;
  canvas.height = render.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  ctx.drawImage(render, 0, 0);

  let quad: Quad | null = null;
  let placed = false;

  if (card) {
    quad = opts.quad ?? detectScreenQuad(render)?.quad ?? null;
    if (quad) {
      drawImageInQuad(ctx, card, quad);
      placed = true;
    }
  }

  if (logo) paintLogo(ctx, logo, canvas.width, canvas.height);

  render.close();
  card?.close();

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Could not encode the composed scene.");

  const url = await uploadToFal(new File([blob], `scene-${Date.now()}.png`, { type: "image/png" }));
  return { url, quad, placed };
}
