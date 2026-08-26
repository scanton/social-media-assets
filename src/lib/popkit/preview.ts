"use client";

import { compose } from "./kit/compose.js";
import { wellLayout, wellSvg } from "./kit/media.js";
import { CANVASES } from "./catalogue";
import { isStampy, stampyHeadScale, stampyUrl } from "./glyphs";
import { GLYPH_FRAC_KIT_DEFAULT, type Beat, type CanvasId } from "./deck";

/**
 * Turns a beat into the same SVG the render route will produce for it.
 *
 * This is the whole point of vendoring the kit: the builder does not draw an
 * approximation of a nugget, it calls the real compose() and shows the result.
 * What a person drags into place is pixel-identical to what comes out the far
 * end, so positioning cannot be "close enough" and then wrong.
 */
export interface BeatPreview {
  svg: string;
  /** Composed cluster size, in canvas pixels. */
  w: number;
  h: number;
  /** Medallion diameter and caption height, both in canvas px. */
  medSize: number;
  capH: number;
  /**
   * Where compose() actually placed each arrow, in this preview's own
   * coordinates. Reported by the kit rather than re-derived, so the editor's
   * protected-region check and the render route's agree by construction.
   */
  arrows: Array<{ x: number; y: number; r: number }>;
}

/** 1x1 transparent PNG: the media that leaves a shape empty. */
export const TRANSPARENT_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export function beatToComposeOptions(beat: Beat, canvas: CanvasId): Record<string, unknown> {
  const opts: Record<string, unknown> = { canvas };

  if (beat.text) opts.text = beat.text;
  // compose-api.md calls maxTextW "the main size dial", and it matters most on
  // a vertical canvas: at the 62% default a caption plus medallion plus arrow
  // composes wider than the 1080px reels frame it is meant to sit inside.
  if (beat.maxTextW) opts.maxTextW = beat.maxTextW;
  if (beat.fontSize) opts.fontSize = beat.fontSize;
  if (beat.medallionScale) opts.medallionScale = beat.medallionScale;
  if (beat.overlap !== undefined) opts.overlap = beat.overlap;
  if (beat.captionPadL !== undefined) opts.captionPadL = beat.captionPadL;
  if (beat.captionPadR !== undefined) opts.captionPadR = beat.captionPadR;
  if (beat.caption) opts.caption = beat.caption;
  if (beat.colorway) opts.colorway = beat.colorway;

  if (beat.medallion) {
    const { side, frame, glyph, borders, fill, glyphFrac, media, mediaFit } = beat.medallion;
    const med: Record<string, unknown> = { frame };
    if (fill) med.fill = fill;
    /*
     * A well is this same medallion with media instead of a flat fill, which
     * `media-wells.md` calls the whole API.
     *
     * A clip cannot go in an SVG <image>, so a video well asks compose() for
     * the frame with a HOLE in it instead: a transparent pixel as the media and
     * `fill: none` behind it, since fillLayer paints a solid backing under any
     * media and that backing would hide whatever was drawn below. The renderer
     * then draws the clip through the hole, and the borders still sit on top
     * because compose() draws them after the fill either way.
     */
    if (media) {
      med.media = beat.medallion.mediaIsVideo ? TRANSPARENT_PIXEL : media;
      if (beat.medallion.mediaIsVideo) med.fill = "none";
    }
    if (mediaFit) med.mediaFit = mediaFit;
    if (glyphFrac !== undefined) med.glyphFrac = glyphFrac;
    if (borders?.length) med.borders = borders;
    // The glyph is resolved to a data URI by the caller, since resolution needs
    // the object/occasion registries and belongs outside the pure mapping.
    if (glyph) med.glyph = glyph;
    opts[side] = med;
  }

  if (beat.arrows?.length) {
    opts.arrows = beat.arrows.map((a) => {
      const arrow: Record<string, unknown> = { name: a.name };
      if (a.from) arrow.from = a.from;
      if (a.edge) arrow.edge = a.edge;
      if (a.at01 !== undefined) arrow.at01 = a.at01;
      if (a.anchor !== undefined) arrow.anchor = a.anchor;
      if (a.scale !== undefined) arrow.scale = a.scale;
      if (a.size !== undefined) arrow.size = a.size;
      if (a.gap !== undefined) arrow.gap = a.gap;
      // arrows.md: a popup arrow tucks its tail under the caption. Default it
      // that way rather than inheriting compose()'s standalone-arrow default.
      arrow.over = a.over ?? false;
      // `mid` by default: `under` (the arrows.md popup default) hides an arrow
      // that lies mostly over the caption behind the shell's own keyline.
      arrow.layer = a.layer ?? "mid";
      return arrow;
    });
  }

  return opts;
}

/** Never throws: a half-built beat is normal while someone is still picking. */
export function renderBeat(
  beat: Beat,
  canvas: CanvasId,
  resolveGlyph: (name: string) => string | undefined,
): BeatPreview | null {
  try {
    /*
     * A well is drawn by media.js, not compose().
     *
     * They are different components: compose() lays a caption out with square
     * medallions beside it, and a well is a framed hole with its own aspect and
     * its own caption lip underneath. The geometry comes from wellLayout so the
     * editor, this renderer and the render route all place it identically.
     *
     * A clip is drawn through the frame rather than into it, so the SVG carries
     * the poster if there is one and nothing otherwise; the renderer fills it.
     */
    if (beat.well) {
      const C = CANVASES[canvas];

      /*
       * A shape well is one of the eighteen frames with a hole in it, so it is
       * compose()'s medallion rather than media.js's framed rectangle.
       *
       * Sized to match a template well at the same `size`: media.js makes those
       * 34% of the canvas, and a medallion's diameter is its caption height
       * times a multiplier, so the multiplier is worked back from the width we
       * actually want. Without that the two families would answer to the same
       * slider and come out different sizes.
       */
      if (beat.well.frame) {
        const want = C.w * 0.34 * (beat.well.size ?? 1);
        const capH = Math.round(C.base * 2.6);
        const out = compose({
          canvas,
          colorway: beat.colorway,
          left: {
            frame: beat.well.frame,
            media: beat.well.kind === "video" ? TRANSPARENT_PIXEL : beat.well.src,
            ...(beat.well.kind === "video" ? { fill: "none" } : {}),
          },
          medallionScale: want / capH,
        });
        return {
          svg: out.svg, w: out.W, h: out.H,
          medSize: out.medSize, capH: out.capH, arrows: out.arrows ?? [],
        };
      }

      const L = wellLayout(beat.well, C) as { outerW: number; outerH: number };
      const svg = wellSvg(beat.well, C) as string;
      return { svg, w: L.outerW, h: L.outerH, medSize: 0, capH: 0, arrows: [] };
    }

    const opts = beatToComposeOptions(beat, canvas);
    const med = beat.medallion?.side ? (opts[beat.medallion.side] as Record<string, unknown>) : null;
    if (med && typeof med.glyph === "string") {
      const name = med.glyph;
      // An uploaded glyph is already what compose() wants: a data URI. It has no
      // catalogue entry to resolve, and looking one up would drop it.
      if (name.startsWith("data:")) {
        // nothing to do
      } else if (isStampy(name)) {
        const url = stampyUrl(name);
        if (url) {
          med.glyph = url;
          // The head fit, not the box fit. compose() centres the artwork in the
          // frame's safe box, which sizes each expression by its whole canvas —
          // so a wizard, whose hat pushes that canvas out, would arrive with a
          // head two thirds the size of grief's. Scale by the measured head
          // fraction instead. The render route applies the same factor to the
          // same deck value, so the two agree.
          const frac = (med.glyphFrac as number | undefined) ?? GLYPH_FRAC_KIT_DEFAULT;
          med.glyphFrac = frac * stampyHeadScale(name);
        } else {
          delete med.glyph;
        }
      } else {
        const uri = resolveGlyph(name);
        if (uri) med.glyph = uri;
        else delete med.glyph;
      }
    }
    const out = compose(opts);
    return {
      svg: out.svg, w: out.W, h: out.H,
      medSize: out.medSize, capH: out.capH,
      arrows: out.arrows ?? [],
    };
  } catch {
    return null;
  }
}

/**
 * Safe width for a canvas, in canvas px.
 *
 * Worth stating plainly because the kit will happily compose a cluster wider
 * than the frame it is going into — a caption, a medallion and an arrow at the
 * stock 62% wrap comes out at 149% of the reels safe width — and nothing in
 * compose() complains. The builder has to be the thing that notices.
 */
export function safeWidth(canvas: CanvasId): number {
  const c = CANVASES[canvas];
  return c.w - c.safe.l - c.safe.r;
}

/**
 * The largest {fontSize, maxTextW} pair that still composes inside the safe
 * area, or null if nothing does.
 *
 * Both dials, because wrap width alone cannot save a vertical canvas: at the
 * reels base of 46px, a caption with a medallion and an arrow is wider than the
 * 984px safe area at *every* wrap from 670 down to 160. compose-api.md says as
 * much — maxTextW is the main size dial "with fontSize" — and the two have to
 * be searched together.
 *
 * Scans down rather than bisecting: W is not monotonic in maxTextW, since wrap
 * width only changes the result when it moves a word onto another line.
 * Starts at the canvas base font so fitting never makes a nugget *larger*.
 *
 * `fraction` shrinks the target below the safe width. The Fit button uses the
 * whole thing, since a person pressing it wants the biggest nugget that is
 * legal; a new beat uses less, because opening at 99% of the safe width is
 * technically fitting and still reads as far too big.
 */
export function fitBeat(
  beat: Beat,
  canvas: CanvasId,
  resolveGlyph: (name: string) => string | undefined = () => undefined,
  fraction = 1,
): { fontSize: number; maxTextW: number } | null {
  const limit = safeWidth(canvas) * fraction;
  const base = CANVASES[canvas].base;
  const widest = Math.round(CANVASES[canvas].w * 0.62);

  // The floor tracks the canvas. ios and desktop are UI canvases with base
  // fonts of 15 and 16, so a fixed floor of 20 sits *above* their starting
  // point and the search silently never runs.
  const floor = Math.max(10, Math.min(20, base));

  for (let fontSize = base; fontSize >= floor; fontSize -= 2) {
    for (let maxTextW = widest; maxTextW >= 160; maxTextW -= 20) {
      const p = renderBeat({ ...beat, fontSize, maxTextW }, canvas, resolveGlyph);
      if (p && p.w <= limit) return { fontSize, maxTextW };
    }
  }
  return null;
}

/** Safe zone for a canvas, as normalized fractions, from tokens.js. */
export function safeZone(canvas: CanvasId) {
  const c = CANVASES[canvas];
  return {
    top: c.safe.t / c.h,
    bottom: c.safe.b / c.h,
    left: c.safe.l / c.w,
    right: c.safe.r / c.w,
  };
}
