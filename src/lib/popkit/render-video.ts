"use client";

import { CANVASES } from "./catalogue";
import { renderBeat } from "./preview";
import { silencedByClatter } from "./rules";
import { tryGlyphDataUri } from "./glyphs";
import { wellLayout } from "./kit/media.js";
import { CUE_TABLE } from "./cues";
import { makeTicker, pickRecorderMime, seekTo, type RenderProgress } from "@/lib/video-encode";
import { coverFit, heartStampLogo, paintLogo, variantForBackground, type LogoSet, type LogoVariant } from "@/lib/watermark";
import { beatScaleFor, type Beat, type CanvasId } from "./deck";
import {
  coverCrop, drawImageInQuad, quadSize, roundedQuadPath, sourceHeight, sourceWidth, type Quad,
} from "@/lib/perspective";
import { glossStops } from "./screen-gloss";
import {
  OFFLINE_FPS,
  canEncodeOffline,
  encodeDeterministic,
  openFrameSource,
  scheduleSourceAudio,
  type FrameSource,
} from "@/lib/video-encode-offline";

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
 *
 * There are two ways out. The first choice is video-encode-offline.ts, which
 * encodes frame by frame with explicit timestamps and so takes the machine's
 * speed out of the result entirely. A browser without a WebCodecs encoder
 * falls back to captureStream into MediaRecorder, which is the older route and
 * the one that turns a slow machine into a short film. Both drive the same
 * `paint`, so what lands on the canvas is identical either way.
 */

/** Rasterised above final size, because the entrance overshoots past 100%. */
const WARP_STEPS_PER_FRAME = 10;

/**
 * How coarse the per-frame warp may get, on the path where that still matters.
 *
 * The MediaRecorder fallback records in real time, so its file is as long as
 * the frames it was given: paint at half the rate and the deck comes out half
 * the length. That is written up on WellClip below, where a 32-step warp once
 * turned five seconds into half a second.
 *
 * Pre-warping fixed it for stills. A clip in a pinned screen cannot be
 * pre-warped — every frame is a different picture — so it pays a hundred-odd
 * clipped draws thirty times a second, and on a machine that cannot afford
 * them the whole render shortens. A customer's 13-second deck came back as 6.5
 * seconds of choppy video, which is exactly the arithmetic of painting at half
 * speed.
 *
 * Coarsening the mesh under load was the first answer, and it was the wrong
 * shape of answer: it moves the threshold rather than removing it, so a slow
 * enough machine still loses the end of the deck and now does so at lower
 * quality too. The same customer came back with the same truncated export.
 *
 * The real fix is video-encode-offline.ts, which stamps every frame with its
 * own timestamp and lets a slow machine simply take longer. This constant now
 * only governs browsers that have no WebCodecs encoder to hand, where a
 * slightly softer warp is still better than half a deck.
 */
const WARP_STEPS_FLOOR = 4;
/** 30fps is the target; a frame that takes longer than this is late. */
const FRAME_BUDGET_MS = 1000 / 30;

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
  /**
   * The exact frame this clip should be showing, parked by the deterministic
   * path before each paint. Absent on the real-time path, where `media` is a
   * playing element and already showing the right thing.
   */
  current?: CanvasImageSource;
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
  logo = false,
  music,
  musicGain = 0.35,
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
  /** Stamp the HeartStamp wordmark into the bottom-right corner. */
  logo?: boolean;
  /** A bed to play under the whole deck. Any length; trimmed to fit. */
  music?: File | null;
  /** 0..1. Well under the cues, which are the thing being listened for. */
  musicGain?: number;
  onProgress?: (p: RenderProgress) => void;
  signal?: AbortSignal;
}): Promise<NuggetRenderResult> {
  /*
   * The fallback's container, worked out up front so a browser that can do
   * neither is turned away before any decoding happens. A missing one is only
   * fatal when WebCodecs is also absent — the deterministic path below brings
   * its own muxer and never touches MediaRecorder.
   */
  const mime = pickRecorderMime();
  if (!mime && !canEncodeOffline()) {
    throw new Error("This browser cannot record video, so the clip can't be rendered here.");
  }

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

  /*
   * Rounded down to even numbers.
   *
   * H.264 stores chroma at half resolution in each direction, so an odd width
   * or height is not representable and the encoder simply refuses the config.
   * A source that is 1079 tall is not common but it exists, and losing a row
   * of pixels is invisible where losing the whole render is not.
   */
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  const w = even(video ? video.videoWidth || preset.w : preset.w);
  const h = even(video ? video.videoHeight || preset.h : preset.h);
  const duration = video ? video.duration : Math.max(0.1, deckSeconds ?? 0);
  if (!duration) throw new Error("The deck has no length, so there is nothing to render.");

  /** Cover, so the frame is filled and the overflow is cropped. */
  const stillFit = image ? coverFit(image.naturalWidth, image.naturalHeight, w, h) : null;

  /*
   * The still background, fitted once.
   *
   * It never changes, and it was being re-scaled from the source on every
   * frame: a phone photograph is often 3000px on its long edge, so each frame
   * paid a full resample down to the canvas before anything else was drawn. Done
   * once into a canvas of exactly the output size, the per-frame cost becomes a
   * 1:1 blit.
   *
   * The same reasoning as pre-warping a pinned still, and the same reason it
   * matters: this export records in real time, so per-frame cost is not a
   * question of patience — it is how long the finished file turns out to be.
   */
  const stillPlate = (() => {
    if (!image || !stillFit) return null;
    const cv = document.createElement("canvas");
    cv.width = w;
    cv.height = h;
    const c = cv.getContext("2d", { alpha: false });
    if (!c) return null;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(image, stillFit.dx, stillFit.dy, stillFit.dw, stillFit.dh);
    return cv;
  })();

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
  /* ---- the soundtrack, in whichever context is doing the mixing ---- */

  /**
   * The cue samples, decoded into the context that will play them.
   *
   * Takes a context rather than closing over one because the two render paths
   * mix in different places: the real-time path sums a live graph into a
   * MediaStreamDestination as the frames go by, and the deterministic path
   * renders the whole soundtrack offline before a frame is encoded. An
   * AudioBuffer belongs to whichever context decoded it, so this runs twice
   * rather than being shared.
   */
  const decodeCues = async (ac: BaseAudioContext) => {
    const decoded = new Map<string, AudioBuffer>();
    for (const b of beats) {
      const cue = b.cue;
      if (!cue || cue === "silent" || silenced.has(b.id) || decoded.has(cue)) continue;
      const spec = CUE_TABLE[cue];
      if (!spec?.file) continue;
      try {
        const res = await fetch("/sfx/" + spec.file);
        decoded.set(cue, await ac.decodeAudioData(await res.arrayBuffer()));
      } catch {
        // A missing cue file silences that beat, never the whole render.
      }
    }
    return decoded;
  };

  /* ---- the logo, chosen once ---- */

  /*
   * The wordmark, and which of its two colourways the corner needs.
   *
   * Measured on the LAST frame rather than the first, for the reason the card
   * pipeline measures it there: the end is what a paused or looping player
   * lingers on, and a deck that opens dark and ends bright would otherwise
   * choose white lettering against the opening and lose it exactly when
   * somebody is looking. Chosen once and held — sampling every frame lets the
   * mark flip colour mid-clip the moment something bright crosses the corner.
   *
   * Seeking is free here: this <video> belongs to the render, not to the
   * editor, so the playhead the user is watching never moves.
   *
   * The background is what gets measured, not the finished composite. A nugget
   * that happens to be over the corner at the end is transient; the footage
   * under it is what the mark actually has to survive.
   */
  let logos: LogoSet | null = null;
  let logoVariant: LogoVariant | undefined;
  if (logo) {
    logos = await heartStampLogo();
    if (video && Number.isFinite(video.duration) && video.duration > 0) {
      // A hair before the end: seeking to exactly `duration` can land past the
      // last decodable frame and yield a blank or stale one.
      await seekTo(video, Math.max(0, video.duration - 0.08));
    }

    /*
     * Measured on a scratch canvas, NOT on the one being recorded.
     *
     * The render canvas is already wired to a capture track by this point, and
     * anything drawn on it before the paint loop starts can be flushed out as a
     * frame — which put one frame of un-composed background at the head of
     * every stamped render.
     */
    const source = video ?? image;
    if (source) logoVariant = variantForBackground(logos, source, w, h, stillFit);

    if (video) await seekTo(video, 0);
  }

  /* ---- what gets drawn, on either clock ---- */

  /**
   * The background frame, when it does not come from a playing element.
   *
   * The real-time path leaves this null and draws the `<video>` itself, which
   * is showing whatever it is showing. The deterministic path pulls an exact
   * frame out of a decoder and parks it here first, because "the frame at
   * 7.4333s" is a thing you can ask a decoder for and not a thing you can ask
   * a playing element for.
   */
  let bgFrame: CanvasImageSource | null = null;

  /**
   * How fine the per-frame mesh warp is.
   *
   * Only the real-time path moves this. There, a frame that takes too long
   * costs deck length, so the mesh coarsens under load and the render stays
   * the right length at slightly softer quality. The deterministic path has no
   * such trade to make — a slow machine there costs patience and nothing else
   * — so it holds full quality throughout.
   */
  let warpSteps = WARP_STEPS_PER_FRAME;

  const paint = (t: number) => {
    const background = bgFrame ?? video;
    if (background) ctx2d.drawImage(background, 0, 0, w, h);
    else if (stillPlate) ctx2d.drawImage(stillPlate, 0, 0);
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
      /*
       * `current` is a decoded frame parked by the deterministic path, and it
       * takes precedence over the element it was decoded from. When it is
       * absent the element is drawn, which is the real-time path and also the
       * graceful end of a clip the decoder could not open: a still first frame
       * rather than a hole.
       */
      const frame = well?.current ?? well?.media;
      const ready =
        Boolean(frame) &&
        (well?.current
          ? true
          : well!.media instanceof HTMLVideoElement
            ? well!.media.readyState >= 2
            : well!.media.complete);

      /*
       * A pinned screen is warped onto its quad instead of being drawn into a
       * rectangle, by the same homography the editor puts in a CSS matrix3d.
       * It also sits outside the beat's own transform: the quad is in canvas
       * coordinates already, so the translate/rotate/scale set up above would
       * apply it twice.
       */
      if (well && frame && ready && b.well?.quad) {
        ctx2d.restore();
        if (well.warped) {
          // A still, warped once when the deck was opened.
          ctx2d.drawImage(well.warped, 0, 0, w, h);
          continue;
        }
        const q = b.well.quad.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad;
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
        drawImageInQuad(ctx2d, frame, q, {
          /*
           * Omitting srcRect maps the whole frame onto the quad, which is
           * exactly what stretching means here — nothing is left outside to be
           * cropped, and the aspect gives instead.
           */
          srcRect: b.well.stretch
            ? undefined
            : coverCrop({ width: sourceWidth(frame), height: sourceHeight(frame) }, q),
          /*
           * Coarser than the 32 the card compositor uses. That density exists
           * to land print artwork pixel-accurately in a one-off composite; this
           * runs every frame of the render, and a moving picture hides the
           * fraction of a pixel it costs.
           */
          steps: warpSteps,
        });
        if (b.well.gloss) paintGloss(ctx2d, q, b.well.gloss, warpSteps);
        ctx2d.restore();
        continue;
      }

      if (well && frame && ready) {
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
        const vw = sourceWidth(frame);
        const vh = sourceHeight(frame);
        const cover = b.well?.stretch ? 0 : Math.max(well.L.mediaW / vw, well.L.mediaH / vh);
        const dw2 = cover ? vw * cover : well.L.mediaW;
        const dh2 = cover ? vh * cover : well.L.mediaH;
        ctx2d.drawImage(
          frame,
          well.L.mediaX + (well.L.mediaW - dw2) / 2,
          well.L.mediaY + (well.L.mediaH - dh2) / 2,
          dw2, dh2,
        );
        ctx2d.restore();
      }

      ctx2d.drawImage(a.img, -dw / 2, -dh / 2, dw, dh);
      ctx2d.restore();
    }

    /*
     * Last, so it sits over the nuggets rather than under them.
     *
     * The mark is the one thing on the frame that is not part of the
     * composition — a nugget landing on top of it would read as a mistake in
     * a way a nugget landing on the footage does not.
     */
    if (logos) paintLogo(ctx2d, logos, w, h, logoVariant);
  };

  /* ---- off the clock: every frame stamped, however long it takes ---- */

  /**
   * This is the path that fixes the short render.
   *
   * The real-time path below hands frames to a MediaRecorder as they happen,
   * so the file is as long as the frames the machine managed to paint — a PC
   * running at half speed produces half a deck, and no amount of thinning the
   * work per frame changes that, it only moves the threshold. Here each frame
   * carries its own timestamp into the encoder, so frame 389 is stamped at
   * 12.966s whether the paint before it took four milliseconds or four hundred.
   * A slow machine waits longer and gets the same file.
   */
  if (canEncodeOffline()) {
    const fps = OFFLINE_FPS;
    const frames = Math.max(1, Math.round(duration * fps));

    /*
     * Clips are read, not played. A playing element is a clock, which is the
     * thing this path exists to get rid of; a decoder answers "the frame at
     * this timestamp" and takes as long as it takes.
     */
    onProgress?.({ stage: "Preparing", pct: 0, realtime: false });
    const bgSource = video ? await openFrameSource(file, { loop: false }) : null;
    const wellSources = new Map<string, FrameSource>();
    for (const b of beats) {
      if (b.well?.kind !== "video" || !b.well.src || !wells.has(b.id)) continue;
      try {
        const blob = await fetch(b.well.src).then((r) => r.blob());
        const source = await openFrameSource(blob, { loop: true });
        if (source) wellSources.set(b.id, source);
      } catch {
        // Falls through to the element, which shows its first frame. A frozen
        // screen is a poor result; a missing one is a broken render.
      }
    }

    /*
     * The whole soundtrack, mixed before a frame is encoded.
     *
     * Same graph as the live one and for the same reasons — a Web Audio
     * context sums whatever is connected, so the bed, the cues and the clip's
     * own audio mix by construction — but rendered offline, where "when" is a
     * number rather than a moment. The silent-keepalive node the live path
     * needs has no counterpart here: an offline render is exactly as long as
     * it was asked to be, so there is no shortest track to be cut to.
     */
    const rate = 48_000;
    const octx = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * rate)), rate);
    let anySound = false;

    if (video) {
      anySound = (await scheduleSourceAudio(file, octx, octx.destination, duration)) || anySound;
    }

    if (music) {
      try {
        const decoded = await octx.decodeAudioData(await music.arrayBuffer());
        const src = octx.createBufferSource();
        src.buffer = decoded;
        src.loop = decoded.duration < duration;
        const gain = octx.createGain();
        gain.gain.value = Math.max(0, Math.min(1, musicGain));
        const fadeFrom = Math.max(0, duration - 1);
        gain.gain.setValueAtTime(gain.gain.value, fadeFrom);
        gain.gain.linearRampToValueAtTime(0.0001, duration);
        src.connect(gain);
        gain.connect(octx.destination);
        src.start(0, 0, duration);
        anySound = true;
      } catch {
        // An undecodable file loses the bed, not the render.
      }
    }

    const offlineCues = await decodeCues(octx);
    for (const b of beats) {
      const cue = b.cue;
      if (!cue || cue === "silent" || silenced.has(b.id)) continue;
      const buf = offlineCues.get(cue);
      if (!buf || b.t < 0 || b.t >= duration) continue;
      const src = octx.createBufferSource();
      const g = octx.createGain();
      g.gain.value = CUE_TABLE[cue]?.gain ?? 0.6;
      src.buffer = buf;
      src.connect(g);
      g.connect(octx.destination);
      src.start(b.t);
      anySound = true;
    }

    const soundtrack = anySound ? await octx.startRendering() : null;

    if (logos && video) await seekTo(video, 0);

    try {
      const result = await encodeDeterministic({
        canvas: cv,
        fps,
        frames,
        paint: async (_i, t) => {
          if (bgSource) bgFrame = await bgSource.at(t);
          for (const [id, source] of wellSources) {
            const clip = wells.get(id);
            if (clip) clip.current = (await source.at(t)) ?? undefined;
          }
          paint(t);
        },
        audio: soundtrack,
        onProgress: (done, total) =>
          onProgress?.({
            stage: "Rendering",
            pct: Math.min(99, Math.round((done / total) * 100)),
            realtime: false,
          }),
        signal,
      });
      onProgress?.({ stage: "Rendering", pct: 100, realtime: false });
      return result;
    } finally {
      await bgSource?.close();
      for (const source of wellSources.values()) await source.close();
      URL.revokeObjectURL(url);
    }
  }

  /* ---- on the clock: the fallback, for a browser without WebCodecs ---- */

  /* ---- audio: the clip's own, plus the cues, on one track ---- */
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const actx = new AC();
  const dest = actx.createMediaStreamDestination();

  /*
   * A silent source, connected for the whole render, and load-bearing.
   *
   * MediaRecorder muxes to the SHORTEST track it is handed. A
   * MediaStreamAudioDestinationNode with nothing ever routed into it delivers
   * almost no samples, so the audio track is a fraction of a second long and
   * the finished file is cut to it — however many frames were painted.
   *
   * Nothing routes into it when the background is a still and no beat carries a
   * cue. A clip-backed deck is safe because createMediaElementSource feeds the
   * destination continuously, and any deck with a cue is safe because the first
   * one kicks the graph into producing. A still with a screen well and no sound
   * is the case that has neither, and it is a perfectly ordinary deck to build.
   *
   * Measured end to end in the builder: thirteen seconds of timeline, still
   * background, cue set to "No sound" produced a 0.08 second, 19 KB file — the
   * "only one frame long" this fixes. The same deck with one cue on it came
   * back full length, which is why it went unnoticed: every default beat has a
   * cue already.
   *
   * Attached unconditionally rather than only for stills. A clip whose audio
   * track is missing or silent reaches the same dead end by a different route,
   * and a node that adds zero to the mix costs nothing on the paths that were
   * already fine.
   */
  const silence = actx.createConstantSource();
  const mute = actx.createGain();
  mute.gain.value = 0;
  silence.connect(mute);
  mute.connect(dest);
  silence.start();

  /*
   * A context left suspended by autoplay policy produces no samples either, and
   * would take the cues down with it. The render is always started by a click,
   * so this normally resolves immediately.
   */
  if (actx.state === "suspended") await actx.resume().catch(() => {});

  if (video) {
    try {
      actx.createMediaElementSource(video).connect(dest);
    } catch {
      // Already tapped, or no audio track. The render is silent rather than dead.
    }
  }

  /*
   * The music bed.
   *
   * Nothing special is needed to keep it out of the cues' way — a Web Audio
   * graph sums whatever is connected to the destination, so the bed and the
   * pops mix by construction and neither is aware of the other. What does need
   * saying is the level: a track at full gain buries a 140ms pop completely,
   * so the default sits well under and is adjustable.
   *
   * Trimmed by stopping it, not by editing it: `stop(when)` at the deck's own
   * length costs nothing and works for a track of any length. A short one
   * loops rather than leaving silence, since a bed that stops halfway sounds
   * like a fault.
   *
   * The last second is faded out. A bed cut dead on the final frame reads as a
   * truncated file — which, on this export, is a thing that actually happens,
   * so it is worth not imitating.
   */
  let musicSource: AudioBufferSourceNode | null = null;
  if (music) {
    try {
      const decoded = await actx.decodeAudioData(await music.arrayBuffer());
      const src = actx.createBufferSource();
      src.buffer = decoded;
      src.loop = decoded.duration < duration;
      const gain = actx.createGain();
      gain.gain.value = Math.max(0, Math.min(1, musicGain));
      const fadeFrom = Math.max(0, duration - 1);
      gain.gain.setValueAtTime(gain.gain.value, actx.currentTime + fadeFrom);
      gain.gain.linearRampToValueAtTime(0.0001, actx.currentTime + duration);
      src.connect(gain);
      gain.connect(dest);
      musicSource = src;
    } catch {
      // An undecodable file loses the bed, not the render.
      musicSource = null;
    }
  }

  const buffers = await decodeCues(actx);

  /* ---- the frame loop ---- */
  const stream = cv.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
  const out = new MediaStream([track]);
  dest.stream.getAudioTracks().forEach((t) => out.addTrack(t));

  const bitrate = Math.max(6_000_000, Math.min(20_000_000, w * h * 4));
  const recorder = new MediaRecorder(out, { mimeType: mime!, videoBitsPerSecond: bitrate });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((r) => {
    recorder.onstop = () => r();
  });

  /*
   * What the last few frames cost, and what that buys.
   *
   * Measured rather than assumed: the same deck is comfortable on one machine
   * and hopeless on another, and this path has no way to know which it is on
   * until it tries. A rolling mean over a handful of frames rides out one slow
   * paint without chasing noise.
   *
   * Only the fallback needs any of this. It is the clock that makes frame cost
   * turn into deck length, and the path above does not have one.
   */
  let meanPaintMs = 0;

  let lastT = -0.001;
  const paintAndCue = () => {
    const startedPaint = performance.now();
    const t = now();
    paint(t);

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

    /*
     * Coarsen while frames are late, and recover when they are not. Stepping
     * one level at a time keeps it from oscillating between extremes on a
     * machine that is merely borderline.
     */
    const cost = performance.now() - startedPaint;
    meanPaintMs = meanPaintMs === 0 ? cost : meanPaintMs * 0.8 + cost * 0.2;
    if (meanPaintMs > FRAME_BUDGET_MS && warpSteps > WARP_STEPS_FLOOR) warpSteps--;
    else if (meanPaintMs < FRAME_BUDGET_MS * 0.5 && warpSteps < WARP_STEPS_PER_FRAME) warpSteps++;
  };

  try {
    recorder.start();
    // Started with the recorder so the bed and the frames share an origin.
    musicSource?.start(0, 0, duration);
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
        paintAndCue();
        onProgress?.({
          stage: "Rendering",
          pct: Math.min(99, Math.round((now() / duration) * 100)),
          fps: meanPaintMs > 0 ? Math.round(1000 / meanPaintMs) : undefined,
          realtime: true,
        });
      });
    });
  } finally {
    ticker.stop();
  }

  paintAndCue(); // make sure the last frame lands
  recorder.stop();
  await stopped;

  video?.pause();
  for (const { media: m } of wells.values()) if (m instanceof HTMLVideoElement) m.pause();
  URL.revokeObjectURL(url);
  silence.stop();
  try {
    musicSource?.stop();
  } catch {
    // Already stopped by its own duration argument.
  }
  void actx.close();

  onProgress?.({ stage: "Rendering", pct: 100, realtime: true });
  return {
    blob: new Blob(chunks, { type: mime! }),
    ext: mime!.startsWith("video/mp4") ? "mp4" : "webm",
  };
}
