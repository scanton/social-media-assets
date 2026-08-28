"use client";

import { CANVASES } from "./catalogue";
import { renderBeat } from "./preview";
import { silencedByClatter } from "./rules";
import { tryGlyphDataUri } from "./glyphs";
import { wellLayout } from "./kit/media.js";
import { CUE_TABLE } from "./cues";
import { makeTicker, pickRecorderMime, type RenderProgress } from "@/lib/video-encode";
import { beatScaleFor, type Beat, type CanvasId } from "./deck";
import {
  coverCrop, drawImageInQuad, quadSize, roundedQuadPath, sourceHeight, sourceWidth, type Quad,
} from "@/lib/perspective";
import { glossStops } from "./screen-gloss";

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
const WARP_STEPS_PER_FRAME = 10;

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
  /** A clip, or — for a bare well — a still. Both are drawable and sizable. */
  media: HTMLVideoElement | HTMLImageElement;
  /**
   * A pinned still, warped once.
   *
   * The mesh warp costs a thousand-odd clipped draws, which is affordable once
   * and ruinous thirty times a second — and it was: the wall clock ran to the
   * end of the deck while only a handful of frames had been painted, and a
   * five second render came out half a second long. A still's warp never
   * changes, so it is done at open time and blitted afterwards. A clip has no
   * such luck and pays per frame, at a coarser mesh.
   */
  warped?: HTMLCanvasElement;
  /** The media rectangle inside the well, in the well's own coordinates. */
  L: { mediaX: number; mediaY: number; mediaW: number; mediaH: number; radius: number; outerW: number };
}

async function openWellClips(beats: Beat[], canvas: CanvasId): Promise<Map<string, WellClip>> {
  const out = new Map<string, WellClip>();
  for (const b of beats) {
    const well = b.well;
    if (!well?.src) continue;
    /*
     * Framed wells only need this for a clip, because a still goes straight
     * into their SVG. A bare well has no SVG to go into — the media IS the
     * beat — so both kinds are opened here.
     */
    const bare = Boolean(well.bare);
    if (!bare && well.kind !== "video") continue;

    let media: HTMLVideoElement | HTMLImageElement;
    if (well.kind === "video") {
      const v = document.createElement("video");
      v.src = well.src;
      v.muted = true;    // a well is a picture that moves, not a second soundtrack
      v.loop = true;
      v.playsInline = true;
      await new Promise<void>((resolve) => {
        v.onloadeddata = () => resolve();
        v.onerror = () => resolve();   // a clip that will not load leaves an empty shape
      });
      media = v;
    } else {
      const i = new Image();
      i.src = well.src;
      await new Promise<void>((resolve) => {
        i.onload = () => resolve();
        i.onerror = () => resolve();
      });
      media = i;
    }

    /*
     * A bare well has no wellLayout: its box IS the beat, so the aperture is
     * the whole thing and renderBeat already worked the size out. Asking
     * media.js for a layout it does not have would land the media in the wrong
     * place by exactly the frame's padding.
     */
    const L = bare
      ? (() => {
          const preview = renderBeat(b, canvas, () => undefined);
          const a = preview?.aperture;
          return {
            mediaX: a?.x ?? 0, mediaY: a?.y ?? 0,
            mediaW: a?.w ?? 0, mediaH: a?.h ?? 0,
            radius: a?.radius ?? 0, outerW: preview?.w ?? 1,
          };
        })()
      : (wellLayout(well, CANVASES[canvas]) as {
          mediaX: number; mediaY: number; mediaW: number; mediaH: number;
          radius: number; outerW: number;
        });
    /*
     * Pre-warp a pinned still into a full-canvas layer, once. The paint loop
     * then blits it, which is one drawImage instead of a mesh.
     */
    let warped: HTMLCanvasElement | undefined;
    const quad = well.quad;
    if (quad && well.kind === "image") {
      const C = CANVASES[canvas];
      const layer = document.createElement("canvas");
      layer.width = C.w;
      layer.height = C.h;
      const lc = layer.getContext("2d");
      if (lc) {
        const q = quad.map((pt) => ({ x: pt.x * C.w, y: pt.y * C.h })) as Quad;
        if (well.radius) {
          const path = roundedQuadPath(q, well.radius);
          lc.beginPath();
          path.forEach((pt, i) => (i ? lc.lineTo(pt.x, pt.y) : lc.moveTo(pt.x, pt.y)));
          lc.closePath();
          lc.clip();
        }
        const sw = sourceWidth(media);
        const sh = sourceHeight(media);
        drawImageInQuad(lc, media, q, { srcRect: coverCrop({ width: sw, height: sh }, q) });
        if (well.gloss) paintGloss(lc, q, well.gloss, 32);
        warped = layer;
      }
    }
    out.set(b.id, { media, L, warped });
  }
  return out;
}


/**
 * The glass, painted in the surface's own space and then warped with it.
 *
 * Drawn onto a small offscreen canvas the size of the *untransformed* panel
 * and pushed through the same homography as the media, so the sheen lies on
 * the screen rather than across the frame. Doing it the other way round — a
 * gradient over the finished quad — is what makes a composite look varnished.
 */
function paintGloss(
  ctx: CanvasRenderingContext2D,
  quad: Quad,
  gloss: number,
  steps: number,
) {
  const { w: qw, h: qh } = quadSize(quad);
  const w = Math.max(2, Math.round(qw));
  const h = Math.max(2, Math.round(qh));
  const layer = document.createElement("canvas");
  layer.width = w;
  layer.height = h;
  const lc = layer.getContext("2d");
  if (!lc) return;

  const { sheen, edgeAlpha } = glossStops(gloss);
  // 118deg, matching glossCss: across the panel and slightly down.
  const a = (118 * Math.PI) / 180;
  const dx = Math.cos(a) * w;
  const dy = Math.sin(a) * h;
  const grad = lc.createLinearGradient((w - dx) / 2, (h - dy) / 2, (w + dx) / 2, (h + dy) / 2);
  for (const s of sheen) grad.addColorStop(s.at, `rgba(255,255,255,${s.alpha})`);
  lc.fillStyle = grad;
  lc.fillRect(0, 0, w, h);

  if (edgeAlpha > 0) {
    const spread = Math.max(2, Math.round(Math.min(w, h) * 0.06));
    const edge = lc.createLinearGradient(0, 0, 0, h);
    edge.addColorStop(0, `rgba(0,0,0,${edgeAlpha})`);
    edge.addColorStop(spread / h, "rgba(0,0,0,0)");
    edge.addColorStop(1 - spread / h, "rgba(0,0,0,0)");
    edge.addColorStop(1, `rgba(0,0,0,${edgeAlpha})`);
    lc.fillStyle = edge;
    lc.fillRect(0, 0, w, h);
    const side = lc.createLinearGradient(0, 0, w, 0);
    side.addColorStop(0, `rgba(0,0,0,${edgeAlpha})`);
    side.addColorStop(spread / w, "rgba(0,0,0,0)");
    side.addColorStop(1 - spread / w, "rgba(0,0,0,0)");
    side.addColorStop(1, `rgba(0,0,0,${edgeAlpha})`);
    lc.fillStyle = side;
    lc.fillRect(0, 0, w, h);
  }

  drawImageInQuad(ctx, layer, quad, { srcRect: { x: 0, y: 0, w, h }, steps });
}

export interface NuggetRenderResult {
  blob: Blob;
  /** `mp4` when the browser would encode one, otherwise `webm`. */
  ext: string;
}

export async function renderNuggets({
  file,
  kind = "video",
  duration: deckSeconds,
  beats,
  canvas,
  onProgress,
  signal,
}: {
  file: File;
  /** A still has no clock and no audio of its own; both are supplied here. */
  kind?: "video" | "image";
  /** How long the deck runs. Ignored for a clip, which knows its own length. */
  duration?: number;
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
  const still = kind === "image";
  const preset = CANVASES[canvas];

  /*
   * A still is its own kind of source, not a one-frame video.
   *
   * It has no clock, so the ticker below counts instead; it has no audio, so
   * the cues are the whole soundtrack; and it is whatever shape it is, so it is
   * cropped to cover the canvas rather than fitted to it. A rendered clip
   * cannot have letterbox bars baked into it, which is the one place the export
   * deliberately disagrees with the editor preview.
   */
  const image = still ? new Image() : null;
  const video = still ? null : document.createElement("video");

  if (video) {
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
  } else if (image) {
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("That image could not be decoded."));
    });
  }

  const w = video ? video.videoWidth || preset.w : preset.w;
  const h = video ? video.videoHeight || preset.h : preset.h;
  const duration = video ? video.duration : Math.max(0.1, deckSeconds ?? 0);
  if (!duration) throw new Error("The deck has no length, so there is nothing to render.");

  /** Cover, so the frame is filled and the overflow is cropped. */
  const stillFit = image
    ? (() => {
        const k = Math.max(w / (image.naturalWidth || 1), h / (image.naturalHeight || 1));
        const dw = (image.naturalWidth || 1) * k;
        const dh = (image.naturalHeight || 1) * k;
        return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
      })()
    : null;

  /** The clock. The element's when there is one, counted from the start when not. */
  let startedAt = 0;
  const now = () =>
    video ? video.currentTime : Math.min(duration, (performance.now() - startedAt) / 1000);

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
  if (video) {
    try {
      actx.createMediaElementSource(video).connect(dest);
    } catch {
      // Already tapped, or no audio track. The render is silent rather than dead.
    }
  }

  const buffers = new Map<string, AudioBuffer>();
  for (const b of beats) {
    const cue = b.cue;
    if (!cue || cue === "silent" || silenced.has(b.id) || buffers.has(cue)) continue;
    const spec = CUE_TABLE[cue];
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
    const t = now();
    if (video) ctx2d.drawImage(video, 0, 0, w, h);
    else if (image && stillFit) ctx2d.drawImage(image, stillFit.dx, stillFit.dy, stillFit.dw, stillFit.dh);

    for (const b of beats) {
      if (t < b.t || t > b.out) continue;
      const a = art.get(b.id);
      if (!a) continue;
      const s = beatScaleFor(b, t);
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
      const ready =
        well &&
        (well.media instanceof HTMLVideoElement ? well.media.readyState >= 2 : well.media.complete);

      /*
       * A pinned screen is warped onto its quad instead of being drawn into a
       * rectangle, by the same homography the editor puts in a CSS matrix3d.
       * It also sits outside the beat's own transform: the quad is in canvas
       * coordinates already, so the translate/rotate/scale set up above would
       * apply it twice.
       */
      if (well && ready && b.well?.quad) {
        ctx2d.restore();
        if (well.warped) {
          // A still, warped once when the deck was opened.
          ctx2d.drawImage(well.warped, 0, 0, w, h);
          continue;
        }
        const q = b.well.quad.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad;
        const m = well.media;
        ctx2d.save();
        if (b.well.radius) {
          // Rounded corners in the surface's own space, foreshortened with it.
          const r = (b.well.radius * w) / preset.w;
          const path = roundedQuadPath(q, r);
          ctx2d.beginPath();
          path.forEach((p, i) => (i ? ctx2d.lineTo(p.x, p.y) : ctx2d.moveTo(p.x, p.y)));
          ctx2d.closePath();
          ctx2d.clip();
        }
        drawImageInQuad(ctx2d, m, q, {
          /*
           * Omitting srcRect maps the whole frame onto the quad, which is
           * exactly what stretching means here — nothing is left outside to be
           * cropped, and the aspect gives instead.
           */
          srcRect: b.well.stretch
            ? undefined
            : coverCrop({ width: sourceWidth(m), height: sourceHeight(m) }, q),
          /*
           * Coarser than the 32 the card compositor uses. That density exists
           * to land print artwork pixel-accurately in a one-off composite; this
           * runs every frame of the render, and a moving picture hides the
           * fraction of a pixel it costs.
           */
          steps: WARP_STEPS_PER_FRAME,
        });
        if (b.well.gloss) paintGloss(ctx2d, q, b.well.gloss, WARP_STEPS_PER_FRAME);
        ctx2d.restore();
        continue;
      }

      if (well && ready) {
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
        /*
         * Cover unless the well asks to stretch, and never contain:
         * letterboxing inside the aperture would show the frame's own fill
         * through the gaps.
         *
         * Stretching is the degenerate case of the same drawImage — the media
         * is laid straight into the aperture and the aspect gives — so both
         * paths end at the same call rather than diverging.
         */
        const m = well.media;
        const vw = (m instanceof HTMLVideoElement ? m.videoWidth : m.naturalWidth) || 1;
        const vh = (m instanceof HTMLVideoElement ? m.videoHeight : m.naturalHeight) || 1;
        const cover = b.well?.stretch ? 0 : Math.max(well.L.mediaW / vw, well.L.mediaH / vh);
        const dw2 = cover ? vw * cover : well.L.mediaW;
        const dh2 = cover ? vh * cover : well.L.mediaH;
        ctx2d.drawImage(
          m,
          well.L.mediaX + (well.L.mediaW - dw2) / 2,
          well.L.mediaY + (well.L.mediaH - dh2) / 2,
          dw2, dh2,
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
          g.gain.value = CUE_TABLE[b.cue]?.gain ?? 0.6;
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
    for (const { media: m } of wells.values()) if (m instanceof HTMLVideoElement) void m.play().catch(() => {});
    startedAt = performance.now();
    if (video) await video.play();
  } catch {
    throw new Error("The browser blocked playback, so the clip couldn't be rendered.");
  }

  const ticker = makeTicker();
  try {
    await new Promise<void>((resolve) => {
      ticker.start(() => {
        const done = video ? video.ended || video.paused : now() >= duration;
        if (signal?.aborted || done) {
          resolve();
          return;
        }
        paint();
        onProgress?.({
          stage: "Rendering",
          pct: Math.min(99, Math.round((now() / duration) * 100)),
        });
      });
    });
  } finally {
    ticker.stop();
  }

  paint(); // make sure the last frame lands
  recorder.stop();
  await stopped;

  video?.pause();
  for (const { media: m } of wells.values()) if (m instanceof HTMLVideoElement) m.pause();
  URL.revokeObjectURL(url);
  void actx.close();

  onProgress?.({ stage: "Rendering", pct: 100 });
  return {
    blob: new Blob(chunks, { type: mime }),
    ext: mime.startsWith("video/mp4") ? "mp4" : "webm",
  };
}
