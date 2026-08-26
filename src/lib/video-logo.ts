"use client";

import { downloadUrl, uploadToFal } from "@/lib/client-api";
import {
  heartStampLogo,
  paintLogo,
  pickLogoVariant,
  type LogoSet,
  type LogoVariant,
} from "@/lib/watermark";
import {
  canRecordVideo,
  makeTicker,
  pickRecorderMime,
  seekTo,
  type RenderProgress,
} from "@/lib/video-encode";

/* The names this module has always exported, kept so its callers do not have to
   care that the machinery moved. */
export { pickRecorderMime };
export const canStampVideo = canRecordVideo;
export type StampProgress = RenderProgress;

/*
 * Burns the HeartStamp emblem into a finished clip, in the browser.
 *
 * The first attempt at this used fal's ffmpeg compose endpoint with a
 * full-frame transparent overlay; it returned a video with no logo on it and
 * the endpoint's handling of image tracks isn't documented anywhere reachable.
 * This route is fully testable instead: decode the clip, redraw every frame
 * through a canvas with the wordmark painted on, and record the canvas straight
 * back out to MP4. Same paintLogo() the stills use, so placement matches.
 */

/**
 * Chooses the wordmark colour from the clip's LAST frame, then rewinds.
 *
 * The end of the clip is where the mark has to work: it is the call to action,
 * the frame that sits on screen while someone decides whether to act, and the
 * one a paused or looping player lingers on. A clip that starts dark and ends
 * bright — which is common once a card opens toward a light inside spread —
 * would otherwise get white lettering chosen against the opening frame and then
 * vanish exactly when it matters.
 *
 * Falls back to whatever frame is currently decoded if the clip can't be sought,
 * which is the old first-frame behaviour rather than no logo at all.
 */
async function variantFromLastFrame(
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
  logos: LogoSet,
  w: number,
  h: number,
): Promise<LogoVariant> {
  const measureHere = () => {
    ctx.drawImage(video, 0, 0, w, h);
    return pickLogoVariant(ctx, logos.onDark, w, h);
  };

  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) return measureHere();

  // A hair before the end: seeking to exactly `duration` can land past the last
  // decodable frame and yield a blank or stale one.
  const sought = await seekTo(video, Math.max(0, duration - 0.08));
  if (!sought) return measureHere();

  const variant = measureHere();
  await seekTo(video, 0);
  return variant;
}

const sameOrigin = (url: string) => {
  if (url.startsWith("/")) return true;
  try {
    return new URL(url, location.href).origin === location.origin;
  } catch {
    return false;
  }
};

/**
 * Returns the stamped clip as a Blob. Split out from the upload so it can be
 * exercised on its own.
 */
export async function renderStampedVideo(
  videoUrl: string,
  onProgress?: (p: StampProgress) => void,
): Promise<Blob> {
  const mime = pickRecorderMime();
  if (!mime) throw new Error("This browser can't re-encode video — the clip is unchanged.");

  onProgress?.({ stage: "Downloading clip" });
  // Remote clips come through our proxy so the canvas stays untainted — a
  // tainted canvas can't be captured at all.
  const res = await fetch(sameOrigin(videoUrl) ? videoUrl : downloadUrl(videoUrl, "clip.mp4"));
  if (!res.ok) throw new Error(`Could not read the rendered clip (${res.status}).`);
  const objectUrl = URL.createObjectURL(await res.blob());

  const video = document.createElement("video");
  video.src = objectUrl;
  video.playsInline = true;
  video.preload = "auto";
  // Muted so autoplay policy lets play() through without a user gesture, and so
  // the pass is silent. captureStream still carries the audio — see below.
  video.muted = true;
  /*
   * Detached <video> elements are never composited, and a decoder that isn't
   * compositing doesn't fire requestVideoFrameCallback — the first attempt at
   * this recorded 21 KB of black because of it. Parked off-screen but rendered.
   */
  video.style.cssText =
    "position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1";
  document.body.appendChild(video);

  const cleanup = () => {
    video.remove();
    URL.revokeObjectURL(objectUrl);
  };

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not decode the rendered clip."));
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new Error("The rendered clip has no video track.");

    onProgress?.({ stage: "Preparing" });
    const logos = await heartStampLogo();

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");

    // 0 fps = manual mode: a frame is emitted only when we ask, which keeps the
    // output in lockstep with the decoded frames instead of a fixed timer.
    const canvasStream = canvas.captureStream(0);
    const videoTrack = canvasStream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const out = new MediaStream([videoTrack]);

    /*
     * Audio comes off the element's own captureStream, which — measured, not
     * assumed — still carries the signal while the element is muted. Muting is
     * what keeps autoplay policy happy and the pass silent for the user.
     *
     * A Web Audio tap looks like the tidier option but records silence from a
     * muted element, which is exactly how the first version shipped a stamped
     * clip with no sound.
     */
    try {
      const elementStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream })
        .captureStream?.();
      elementStream?.getAudioTracks().forEach((track) => out.addTrack(track));
    } catch {
      // Silent source, or capture unsupported — record video only.
    }

    const bitrate = Math.max(6_000_000, Math.min(20_000_000, w * h * 4));
    const recorder = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: bitrate });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });

    /*
     * One colour for the whole clip, decided by the last frame.
     *
     * Measuring every frame would be right per-frame and wrong overall — a hand
     * or a bright prop crossing the corner would flip the lettering mid-shot,
     * which reads as a glitch. So it is measured once and held.
     *
     * The measurement happens here, before recording starts, because frames are
     * encoded in order: by the time the last frame arrives, every earlier frame
     * has already been stamped. variantFromLastFrame seeks to the end, reads the
     * corner, and rewinds to zero.
     */
    const variant = await variantFromLastFrame(video, ctx, logos, w, h);

    let painted = 0;
    const paint = () => {
      ctx.drawImage(video, 0, 0, w, h);
      paintLogo(ctx, logos, w, h, variant);
      videoTrack.requestFrame();
      painted++;
    };

    const total = video.duration || 0;
    const ended = new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });

    recorder.start();

    try {
      await video.play();
    } catch {
      throw new Error("The browser blocked playback, so the clip couldn't be stamped.");
    }

    /*
     * Frames are driven by a worker timer, not requestAnimationFrame or
     * requestVideoFrameCallback. Both of those stop dead the moment the tab
     * isn't visible — switch tabs mid-encode with rAF and the recording simply
     * stalls. A worker keeps ticking, and drawImage only needs the decoder to be
     * running, not the compositor. Sampling above the source frame rate just
     * duplicates a frame, which is harmless.
     */
    const ticker = makeTicker();
    try {
      await new Promise<void>((resolve) => {
        ticker.start(() => {
          if (video.ended || video.paused) {
            resolve();
            return;
          }
          paint();
          onProgress?.({
            stage: "Stamping",
            pct: total ? Math.min(99, Math.round((video.currentTime / total) * 100)) : undefined,
          });
        });
      });
    } finally {
      ticker.stop();
    }

    await ended.catch(() => {});

    paint(); // make sure the last frame lands
    recorder.stop();
    await stopped;

    onProgress?.({ stage: "Stamping", pct: 100 });

    const blob = new Blob(chunks, { type: mime.split(";")[0] });
    if (!blob.size) throw new Error("Re-encoding produced an empty file.");
    if (painted < 2) throw new Error("No frames were captured while re-encoding.");
    return blob;
  } finally {
    cleanup();
  }
}

/** Stamps the clip and uploads the result, returning the new URL. */
export async function stampVideoLogo(
  videoUrl: string,
  onProgress?: (p: StampProgress) => void,
): Promise<string> {
  const blob = await renderStampedVideo(videoUrl, onProgress);
  onProgress?.({ stage: "Uploading" });
  const ext = blob.type.includes("webm") ? "webm" : "mp4";
  return uploadToFal(new File([blob], `stamped-${Date.now()}.${ext}`, { type: blob.type }));
}
