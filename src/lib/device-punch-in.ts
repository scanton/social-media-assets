"use client";

import { downloadUrl } from "@/lib/client-api";
import { detectScreenQuad } from "@/lib/screen-detect";

/**
 * Moves the camera in after the fact, for Device Shots.
 *
 * However the framing is worded, image models hold the phone further away than
 * asked — the "extreme closeup" prompt came back with the device at about 75%
 * of the frame height, and "fills the frame" would not crop the phone at all.
 * The screen, though, is the one thing these plates guarantee: a flat white
 * rectangle that the card compositor already knows how to find. So instead of
 * negotiating with the model, find it and crop in until it is the size the
 * framing promised. Same move as the compositor: pixel-exact on a canvas
 * rather than hoped for in a prompt.
 *
 * The crop keeps the render's own shape and is scaled back to the size asked
 * for, which is why the render is made larger than that (see RENDER_TIER in
 * DeviceShots): the first third of any zoom costs no sharpness at all.
 */

/**
 * How much of the frame the SCREEN spans after the crop, along whichever
 * dimension it is tightest in. The device's bezel and frame add ~4% to that,
 * so "extreme" leaves the whole phone just inside the border, and "fills" lets
 * its body run out of shot while the screen's corners stay in.
 */
export const PUNCH_TARGET: Record<string, number> = {
  fills: 0.96,
  extreme: 0.86,
  tight: 0.7,
};

/**
 * The most it will magnify. Past this the upscale starts to show as softness,
 * and a render that far off is better re-rolled than rescued.
 */
const MAX_ZOOM = 1.9;
/** Not worth a resample for less than this. */
const MIN_ZOOM = 1.03;

export type PunchResult = {
  url: string;
  /** How far it moved in: 1 means untouched. */
  zoom: number;
  /** False when no screen could be found, so the render is returned as it came. */
  found: boolean;
};

export async function punchInOnScreen(opts: {
  url: string;
  framingId: string;
  /** Final pixel size. The render may be larger; the crop is scaled to this. */
  width: number;
  height: number;
}): Promise<PunchResult> {
  const res = await fetch(downloadUrl(opts.url, "plate.png"));
  if (!res.ok) throw new Error(`Could not read the plate (${res.status}).`);
  const bitmap = await createImageBitmap(await res.blob());
  const W = bitmap.width;
  const H = bitmap.height;

  const target = PUNCH_TARGET[opts.framingId] ?? PUNCH_TARGET.extreme;
  const quad = detectScreenQuad(bitmap)?.quad ?? null;

  let zoom = 1;
  let crop = { x: 0, y: 0, w: W, h: H };
  if (quad) {
    const xs = quad.map((p) => p.x);
    const ys = quad.map((p) => p.y);
    const left = Math.max(0, Math.min(...xs));
    const right = Math.min(W, Math.max(...xs));
    const top = Math.max(0, Math.min(...ys));
    const bottom = Math.min(H, Math.max(...ys));

    // Whichever dimension the screen is closer to filling decides the zoom.
    const span = Math.max((right - left) / W, (bottom - top) / H);
    zoom = Math.min(MAX_ZOOM, target / span);

    if (zoom >= MIN_ZOOM) {
      const w = W / zoom;
      const h = H / zoom;
      /*
       * Centred on the screen, then slid back inside the picture. Sliding can
       * never push the screen out: the crop is wider than the screen and was
       * centred on it, so whichever side it moves toward still covers it.
       */
      const cx = (left + right) / 2;
      const cy = (top + bottom) / 2;
      crop = {
        x: Math.min(W - w, Math.max(0, cx - w / 2)),
        y: Math.min(H - h, Math.max(0, cy - h / 2)),
        w,
        h,
      };
    } else {
      zoom = 1;
    }
  }

  // Nothing to do and nothing to resize: hand back the original bytes.
  if (zoom === 1 && W === opts.width && H === opts.height) {
    bitmap.close();
    return { url: opts.url, zoom, found: Boolean(quad) };
  }

  const canvas = document.createElement("canvas");
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, crop.x, crop.y, crop.w, crop.h, 0, 0, opts.width, opts.height);
  bitmap.close();

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the plate."))), "image/png"),
  );
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  return { url, zoom, found: Boolean(quad) };
}
