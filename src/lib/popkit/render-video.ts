"use client";

import { CANVASES } from "./catalogue";
import { renderBeat } from "./preview";
import { silencedByClatter } from "./rules";
import { tryGlyphDataUri } from "./glyphs";
import { beatScale } from "./kit/motion.js";
import { wellLayout } from "./kit/media.js";
import { CUES } from "./kit/feedback.js";
import { makeTicker, pickRecorderMime, type RenderProgress } from "@/lib/video-encode";
import type { Beat, CanvasId } from "./deck";

/**
 * Burns the nuggets into a clip, in the browser.
 *
 * A separate pass from the logo stamp on purpose: the emblem belongs on the
 * original video whether or not anyone opens PopKit, so the two are not folded
 * together. It does follow the same route, and for the same reasons, which are
 * written up in video-encode.ts.
 *
 * Nothing here re-derives anything. The artwork is compose()'s own SVG, the
 * scale is motion.js's own spring, and the muted cues are feedback.js's own
 * rule, so the file this produces is the file scripts/render-deck.js would.
 */

/** Rasterised above final size, because the entrance overshoots past 100%. */
const RASTER = 1.35;

/**
 * Pulls every external reference in an SVG into the file itself.
 *
 * An SVG rasterised through `<img>` is loaded as an *image*, and an image may
 * not fetch anything: no stylesheets, no fonts, no `<image href="/…">`. The
 * reference is not an error, it simply draws nothing, which is how a Stampy
 * medallion came out empty in an export while looking right in the editor. The
 * editor inlines its SVG into the document, where the same href loads normally.
 *
 * Object and occasion glyphs never hit this because they are already data URIs.
 * Stampy is artwork on disk, so it arrives as a path and has to be brought in.
 *
 * Cached across beats: eight nuggets wearing the same face should fetch it once.
 */
const inlined = new Map<string, string>();

async function inlineExternalRefs(svg: string): Promise<string> {
  const refs = [...svg.matchAll(/href="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !u.startsWith("data:"));
  if (!refs.length) return svg;

  let out = svg;
  for (const url of new Set(refs)) {
    let uri = inlined.get(url);
    if (!uri) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const blob = await res.blob();
        uri = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(fr.error);
          fr.readAsDataURL(blob);
        });
        inlined.set(url, uri);
      } catch {
        continue; // a glyph that will not load is a blank medallion, not a dead render
      }
    }
    out = out.split(`href="${url}"`).join(`href="${uri}"`);
  }
  return out;
}

/** Decoded once per render: an <img> per beat per frame would thrash. */
async function rasterise(
  beats: Beat[],
  canvas: CanvasId,
): Promise<Map<string, { img: HTMLImageElement; w: number; h: number; medSize: number }>> {
  const out = new Map<string, { img: HTMLImageElement; w: number; h: number; medSize: number }>();
  for (const b of beats) {
    const preview = renderBeat(b, canvas, (n) => tryGlyphDataUri(n, 512));
    if (!preview) continue;
    const img = new Image();
    /*
     * The SVG's own width/height are scaled up before it is decoded.
     *
     * A browser rasterises an SVG loaded through <img> at its intrinsic size
     * and scales that bitmap, so leaving it at 100% would make the entrance
     * overshoot a blur at exactly the moment the eye is on it. The viewBox is
     * untouched, so this is more pixels of the same drawing.
     */
    const bigger = (await inlineExternalRefs(preview.svg))
      .replace(/width="([\d.]+)"/, (_, n) => `width="${(Number(n) * RASTER).toFixed(2)}"`)
      .replace(/height="([\d.]+)"/, (_, n) => `height="${(Number(n) * RASTER).toFixed(2)}"`);
    // An <img> rather than createImageBitmap: SVG support in the latter is
    // uneven across browsers, and this is the same route watermark.ts takes.
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(bigger)));
    await img.decode().catch(() => undefined);
    out.set(b.id, { img, w: preview.w, h: preview.h, medSize: preview.medSize });
  }
  return out;
}

/**
 * A clip playing inside a well.
 *
 * compose() leaves the shape empty for these (see `TRANSPARENT_PIXEL` in
 * preview.ts) and the clip is drawn through the hole here, underneath the
 * frame's own artwork so the keyline and borders still sit on top.
 *
 * The path comes from the kit's `frames.js`, so the mask is the same outline
 * the frame is drawn from rather than an approximation of it. It is inset by
 * half a keyline for the same reason `fillLayer` insets its image clip: a
 * stroke is centred on the edge, and half of it belongs inside.
 */
interface WellClip {
  video: HTMLVideoElement;
  /** The media rectangle inside the well, in the well's own coordinates. */
  L: { mediaX: number; mediaY: number; mediaW: number; mediaH: number; radius: number; outerW: number };
}

async function openWellClips(beats: Beat[], canvas: CanvasId): Promise<Map<string, WellClip>> {
  const out = new Map<string, WellClip>();
  for (const b of beats) {
    if (b.well?.kind !== "video" || !b.well.src) continue;
    const v = document.createElement("video");
    v.src = b.well.src;
    v.muted = true;      // a well is a picture that moves, not a second soundtrack
    v.loop = true;
    v.playsInline = true;
    await new Promise<void>((resolve) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => resolve();     // a clip that will not load leaves an empty shape
    });
    const L = wellLayout(b.well, CANVASES[canvas]) as {
      mediaX: number; mediaY: number; mediaW: number; mediaH: number;
      radius: number; outerW: number;
    };
    out.set(b.id, { video: v, L });
  }
  return out;
}

export interface NuggetRenderResult {
  blob: Blob;
  /** `mp4` when the browser would encode one, otherwise `webm`. */
  ext: string;
}

export async function renderNuggets({
  file,
  beats,
  canvas,
  onProgress,
  signal,
}: {
  file: File;
  beats: Beat[];
  canvas: CanvasId;
  onProgress?: (p: RenderProgress) => void;
  signal?: AbortSignal;
}): Promise<NuggetRenderResult> {
  const mime = pickRecorderMime();
  if (!mime) throw new Error("This browser cannot record video, so the clip can't be rendered here.");

  onProgress?.({ stage: "Preparing", pct: 0 });
  const art = await rasterise(beats, canvas);
  const wells = await openWellClips(beats, canvas);
  const silenced = silencedByClatter(beats);

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.preload = "auto";
  /*
   * NOT muted, unlike the preview element.
   *
   * The audio is taken through Web Audio so the cues can be mixed into it, and
   * `createMediaElementSource` on a muted element yields silence. Routing it
   * into the graph is also what keeps this inaudible: the source is connected
   * to the recording destination and never to `ctx.destination`, so nothing
   * reaches the speakers while it runs.
   */
  video.muted = false;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("That video could not be decoded."));
  });

  const preset = CANVASES[canvas];
  const w = video.videoWidth || preset.w;
  const h = video.videoHeight || preset.h;
  const duration = video.duration;

  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx2d = cv.getContext("2d", { alpha: false });
  if (!ctx2d) throw new Error("Canvas is unavailable in this browser.");
  ctx2d.imageSmoothingEnabled = true;
  ctx2d.imageSmoothingQuality = "high";

  /* ---- audio: the clip's own, plus the cues, on one track ---- */
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const actx = new AC();
  const dest = actx.createMediaStreamDestination();
  try {
    actx.createMediaElementSource(video).connect(dest);
  } catch {
    // Already tapped, or no audio track. The render is silent rather than dead.
  }

  const buffers = new Map<string, AudioBuffer>();
  for (const b of beats) {
    const cue = b.cue;
    if (!cue || cue === "silent" || silenced.has(b.id) || buffers.has(cue)) continue;
    const spec = (CUES as Record<string, { file: string | null }>)[cue];
    if (!spec?.file) continue;
    try {
      const res = await fetch("/sfx/" + spec.file);
      buffers.set(cue, await actx.decodeAudioData(await res.arrayBuffer()));
    } catch {
      // A missing cue file silences that beat, never the whole render.
    }
  }

  /* ---- the frame loop ---- */
  const stream = cv.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const out = new MediaStream([track]);
  dest.stream.getAudioTracks().forEach((t) => out.addTrack(t));

  const bitrate = Math.max(6_000_000, Math.min(20_000_000, w * h * 4));
  const recorder = new MediaRecorder(out, { mimeType: mime, videoBitsPerSecond: bitrate });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((r) => {
    recorder.onstop = () => r();
  });

  let lastT = -0.001;
  const paint = () => {
    const t = video.currentTime;
    ctx2d.drawImage(video, 0, 0, w, h);

    for (const b of beats) {
      if (t < b.t || t > b.out) continue;
      const a = art.get(b.id);
      if (!a) continue;
      const s = beatScale(t, b.t, b.out);
      if (s <= 0) continue;

      // Canvas px, not preset px: a 720p source carries the same normalised
      // anchor as a 1080p one and must land in the same place on the frame.
      const sx = w / preset.w;
      const sy = h / preset.h;
      const dw = a.w * sx * s;
      const dh = a.h * sy * s;
      const align = b.align ?? "center";
      const cx = b.anchor.x * w + (align === "left" ? a.w * sx / 2 : align === "right" ? -a.w * sx / 2 : 0);
      const cy = b.anchor.y * h;

      ctx2d.save();
      ctx2d.translate(cx, cy);
      if (b.rotate) ctx2d.rotate((b.rotate * Math.PI) / 180);

      const well = wells.get(b.id);
      if (well && well.video.readyState >= 2) {
        /*
         * The clip goes UNDER the frame, through the hole wellSvg leaves for it.
         * Coordinates come from wellLayout, the same numbers the SVG was drawn
         * from, so the video lands exactly in the aperture rather than near it.
         */
        const k = dw / well.L.outerW;
        ctx2d.save();
        ctx2d.translate(-dw / 2, -dh / 2);
        ctx2d.scale(k, k);
        ctx2d.beginPath();
        ctx2d.roundRect(well.L.mediaX, well.L.mediaY, well.L.mediaW, well.L.mediaH, well.L.radius);
        ctx2d.clip();
        // cover, not contain: letterboxing inside the aperture would show the
        // frame's own fill through the gaps
        const vw = well.video.videoWidth || 1;
        const vh = well.video.videoHeight || 1;
        const cover = Math.max(well.L.mediaW / vw, well.L.mediaH / vh);
        ctx2d.drawImage(
          well.video,
          well.L.mediaX + (well.L.mediaW - vw * cover) / 2,
          well.L.mediaY + (well.L.mediaH - vh * cover) / 2,
          vw * cover, vh * cover,
        );
        ctx2d.restore();
      }

      ctx2d.drawImage(a.img, -dw / 2, -dh / 2, dw, dh);
      ctx2d.restore();
    }

    // Entrance only, once per crossing, on the video's clock rather than the
    // audio clock so a long render cannot drift out of sync with itself.
    for (const b of beats) {
      if (b.t > lastT && b.t <= t && b.cue && b.cue !== "silent" && !silenced.has(b.id)) {
        const buf = buffers.get(b.cue);
        if (buf) {
          const src = actx.createBufferSource();
          const g = actx.createGain();
          g.gain.value = (CUES as Record<string, { gain: number }>)[b.cue]?.gain ?? 0.6;
          src.buffer = buf;
          src.connect(g);
          g.connect(dest);
          src.start();
        }
      }
    }
    lastT = t;
    track.requestFrame();
  };

  try {
    recorder.start();
    for (const { video: wv } of wells.values()) void wv.play().catch(() => {});
    await video.play();
  } catch {
    throw new Error("The browser blocked playback, so the clip couldn't be rendered.");
  }

  const ticker = makeTicker();
  try {
    await new Promise<void>((resolve) => {
      ticker.start(() => {
        if (signal?.aborted || video.ended || video.paused) {
          resolve();
          return;
        }
        paint();
        onProgress?.({
          stage: "Rendering",
          pct: duration ? Math.min(99, Math.round((video.currentTime / duration) * 100)) : undefined,
        });
      });
    });
  } finally {
    ticker.stop();
  }

  paint(); // make sure the last frame lands
  recorder.stop();
  await stopped;

  video.pause();
  for (const { video: wv } of wells.values()) wv.pause();
  URL.revokeObjectURL(url);
  void actx.close();

  onProgress?.({ stage: "Rendering", pct: 100 });
  return {
    blob: new Blob(chunks, { type: mime }),
    ext: mime.startsWith("video/mp4") ? "mp4" : "webm",
  };
}
