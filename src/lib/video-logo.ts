"use client";

import { awaitJob, submitJob, uploadToFal } from "@/lib/client-api";
import { MODELS } from "@/lib/models";
import { heartStampLogo, paintLogo } from "@/lib/watermark";

type Probe = { width: number; height: number; durationMs: number };

/**
 * Reads a clip's dimensions and length.
 *
 * Metadata only — no canvas read — so the fal URL can be used directly and CORS
 * never comes into it.
 */
function probeVideo(url: string): Promise<Probe> {
  return new Promise((resolve, reject) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    el.src = url;
    el.onloadedmetadata = () => {
      if (!el.videoWidth || !el.videoHeight) {
        reject(new Error("Could not read the clip's dimensions."));
        return;
      }
      resolve({
        width: el.videoWidth,
        height: el.videoHeight,
        durationMs: Math.max(1, Math.round((el.duration || 0) * 1000)),
      });
    };
    el.onerror = () => reject(new Error("Could not read the rendered clip."));
  });
}

/**
 * Builds a transparent PNG the size of the whole video frame with the emblem
 * already in the bottom-right corner.
 *
 * fal's compose endpoint has no position or scale controls for an image track,
 * which would normally rule it out for a corner watermark. Sizing the overlay to
 * the full frame removes the need for any: "put this image over that video" is
 * all the endpoint has to do, and placement comes from the same paintLogo() the
 * stills use, so it matches Flow 1 exactly.
 */
async function buildOverlay(width: number, height: number): Promise<string> {
  const logo = await heartStampLogo();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");

  paintLogo(ctx, logo, width, height);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  if (!blob) throw new Error("Could not encode the logo overlay.");

  return uploadToFal(new File([blob], `logo-overlay-${width}x${height}.png`, { type: "image/png" }));
}

/**
 * Burns the HeartStamp emblem into a finished clip and returns the new URL.
 *
 * Flow 1 gets its logo from the still it animates from; this is how Flow 2 —
 * which has no still — ends up with the same mark in the same place.
 */
export async function stampVideoLogo(
  videoUrl: string,
  onStage?: (stage: string) => void,
): Promise<string> {
  onStage?.("Measuring clip");
  const { width, height, durationMs } = await probeVideo(videoUrl);

  onStage?.("Building overlay");
  const overlayUrl = await buildOverlay(width, height);

  onStage?.("Stamping");
  const requestId = await submitJob(MODELS.videoCompose, {
    tracks: [
      {
        id: "clip",
        type: "video",
        keyframes: [{ timestamp: 0, duration: durationMs, url: videoUrl }],
      },
      {
        id: "logo",
        type: "image",
        keyframes: [{ timestamp: 0, duration: durationMs, url: overlayUrl }],
      },
    ],
  });

  const data = await awaitJob<{ video_url?: string }>(MODELS.videoCompose, requestId);
  if (!data?.video_url) throw new Error("Compose returned no video.");
  return data.video_url;
}
