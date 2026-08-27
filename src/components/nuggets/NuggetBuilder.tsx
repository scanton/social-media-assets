"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import {
  ARROWS, BORDERS, CANVASES, CAPTIONS, COLORWAY_NAMES,
  FRAMES, OBJECT_GLYPHS, OCCASION_GLYPHS, WELLS, WELL_SHAPE_NAMES, glyphLabel,
} from "@/lib/popkit/catalogue";
import {
  STAMPY_NAMES, STAMPY_PREFIX, STAMPY_USE, isStampy, tryGlyphDataUri,
} from "@/lib/popkit/glyphs";
import {
  CAPTION_MAX_CHARS, GLYPH_FRAC_DEFAULT, GLYPH_FRAC_KIT_DEFAULT, SOUND_CUES,
  MEDALLION_SCALE_DEFAULT, MEDALLION_SCALE_KIT_DEFAULT,
  beatKind, defaultDwellSeconds, floorForBeat,
  STILL_DEFAULT_S, STILL_MAX_S, STILL_MIN_S,
  type Background, type Beat, type CanvasId, type ProtectedRegion, type SoundCue,
} from "@/lib/popkit/deck";
import { fitBeat, renderBeat, safeWidth } from "@/lib/popkit/preview";
import { frame } from "@/lib/popkit/kit/frames.js";
import { frameSvg } from "@/lib/popkit/kit/finish.js";
import { arrowSvg } from "@/lib/popkit/kit/arrows2.js";
import { COLORWAYS, BRAND } from "@/lib/popkit/kit/tokens.js";
import { compose } from "@/lib/popkit/kit/compose.js";
import { CataloguePicker, type CatalogueOption } from "./CataloguePicker";
import { wellSvg } from "@/lib/popkit/kit/media.js";
import { Timeline } from "./Timeline";
import { collectIssues, checkDwell, type Issue, type PlacedArrow, type PlacedBox } from "@/lib/popkit/rules";
import { makeZip } from "@/lib/popkit/zip";
import { playCue } from "@/lib/popkit/cue-player";
import { renderNuggets } from "@/lib/popkit/render-video";
import { isSvg, normaliseImage, toDataUri } from "@/lib/popkit/assets";
import { canRecordVideo, type RenderProgress } from "@/lib/video-encode";
import { CUE_MS, DEFAULT_ARROW_CUE, DEFAULT_CUE } from "@/lib/popkit/cues";
import { buildDeck, exportBasename, validateDeckAgainstSchema } from "@/lib/popkit/export";
import { Accordion, Disclosure } from "./Disclosure";
import { Transport } from "./Transport";
import { VideoStage } from "./VideoStage";
import { Field, Select, Switch, cx } from "../ui";
import { HelpTip } from "../HelpTip";
import { detectScreenQuad } from "@/lib/screen-detect";
import { usePlayhead } from "@/lib/popkit/use-playhead";
const uid = () => Math.random().toString(36).slice(2, 9);

/** compose()'s own lap-over-the-caption-end default. */
const OVERLAP_KIT_DEFAULT = 0.3;

/**
 * Caption padding a new beat opens at.
 *
 * The shell's own default works out around 62px at a 28px font, which seats the
 * text a constant ~73px from the medallion whatever size the medallion is —
 * proportionate against a 231px medallion, and adrift against a 106px one.
 * Applied to the medallion's end only — tightening both ends is what pushed the
 * copy against the far edge of the pill.
 */
const DEFAULT_CAPTION_PAD = 34;

const OPENING_COPY = "Every card prints inside as well as out.";

function newBeat(canvas: CanvasId): Beat {
  const beat: Beat = {
    id: uid(),
    t: 0,
    // Long enough for its own copy. Opening every beat at a fixed 3s put the
    // default text, whose floor is 3.55s, under the floor before anyone had
    // touched it.
    out: defaultDwellSeconds(OPENING_COPY),
    text: OPENING_COPY,
    caption: "insetPill",
    colorway: "house",
    align: "center",
    anchor: { x: 0.5, y: 0.55 },
    medallion: { side: "left", frame: "circle", glyphFrac: GLYPH_FRAC_DEFAULT },
    arrows: [{ name: "dart", from: "left", anchor: 225, scale: 0.6, over: false, layer: "mid" }],
    cue: DEFAULT_CUE,
    haptic: "none",
    medallionScale: MEDALLION_SCALE_DEFAULT,
    // the medallion opens on the left, so that is the end to tighten
    captionPadL: DEFAULT_CAPTION_PAD,
  };

  // Opened at the kit's own numbers this composes to 149% of the reels safe
  // width, which is what "the nugget is way too big" looked like. Ask for the
  // fitted pair rather than hardcoding one that is only right for one canvas.
  const fit = fitBeat(beat, canvas, undefined, 0.82);
  return fit ? { ...beat, ...fit } : beat;
}

/**
 * A well: a shape with a picture or a clip in it, and nothing else.
 *
 * `media-wells.md` is explicit that this is a medallion with a hole rather than
 * a new component, so it is a beat with a medallion and no copy. The media
 * arrives by upload; the shape defaults to a capsule because that is what the
 * doc recommends for screen recordings and card fronts.
 */
/**
 * A screen: a bare well, holding the whole timeline, that does not pop.
 *
 * Its defaults are the opposite of every other beat's on purpose. The others
 * are annotations that arrive, hold and leave; this one is pretending to be
 * part of the photograph behind it, and a thing already in the scene neither
 * springs into view nor goes away halfway through.
 */

/**
 * Where a rectangle in the background image lands on the canvas.
 *
 * The still is drawn to *cover* the canvas — cropped, not letterboxed, in the
 * editor and in the export alike — so a screen found in the source image is
 * somewhere else by the time it is on the frame. Getting this wrong puts the
 * pin a crop's width away from the thing it is meant to sit on.
 */
function sourceToCanvas(
  pt: { x: number; y: number },
  src: { w: number; h: number },
  canvasW: number,
  canvasH: number,
) {
  const k = Math.max(canvasW / src.w, canvasH / src.h);
  const dx = (canvasW - src.w * k) / 2;
  const dy = (canvasH - src.h * k) / 2;
  return { x: (pt.x * k + dx) / canvasW, y: (pt.y * k + dy) / canvasH };
}

/** A centred rectangle of the canvas, as the quad to start dragging from. */
function defaultQuad(aspect: number): NonNullable<NonNullable<Beat["well"]>["quad"]> {
  const w = 0.34;
  const h = w / (aspect || 1) / (1920 / 1080);
  const x0 = 0.5 - w / 2;
  const x1 = 0.5 + w / 2;
  const y0 = 0.5 - h / 2;
  const y1 = 0.5 + h / 2;
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/**
 * A starting quad for a screen: the one detected in the background if there is
 * one, and a centred rectangle otherwise.
 *
 * Detection is the same pass the card pipeline uses to find a blank device
 * screen, so it wants a bright flat quadrilateral. It will miss a busy or dark
 * one, which is not a failure — the corners are draggable either way, and a
 * rough rectangle to drag is better than nothing to drag.
 */
async function proposeQuad(
  bg: Background | null,
  canvas: CanvasId,
  aspect: number,
): Promise<NonNullable<NonNullable<Beat["well"]>["quad"]>> {
  const fallback = defaultQuad(aspect);
  if (bg?.kind !== "image") return fallback;
  try {
    const bitmap = await createImageBitmap(await (await fetch(bg.url)).blob());
    const found = detectScreenQuad(bitmap);
    bitmap.close();
    if (!found) return fallback;
    const C = CANVASES[canvas];
    const src = { w: bg.width, h: bg.height };
    return found.quad.map((p) => sourceToCanvas(p, src, C.w, C.h)) as NonNullable<
      NonNullable<Beat["well"]>["quad"]
    >;
  } catch {
    return fallback;
  }
}

/** Screens worth matching. Value is width over height. */
const SCREEN_ASPECTS = [
  { label: "Phone 9:19.5", value: 9 / 19.5 },
  { label: "Phone 9:16", value: 9 / 16 },
  { label: "Tablet 3:4", value: 3 / 4 },
  { label: "Monitor 16:9", value: 16 / 9 },
  { label: "Monitor 16:10", value: 16 / 10 },
  { label: "Laptop 3:2", value: 3 / 2 },
  { label: "Billboard 4:1", value: 4 },
  { label: "Square 1:1", value: 1 },
] as const;

function newScreenBeat(duration: number): Beat {
  return {
    id: uid(),
    t: 0,
    out: Math.max(0.1, duration),
    align: "center",
    anchor: { x: 0.5, y: 0.5 },
    noPop: true,
    // 9:19.5 — a modern phone screen, which is the case this exists for.
    well: { bare: true, shape: "rounded", kind: "image", aspect: 9 / 19.5, size: 0.9, radius: 28, gloss: 0.35 },
    cue: "silent",
    haptic: "none",
  };
}

function newWellBeat(): Beat {
  // W01 Reaction Well: media.js calls it the workhorse, and it is the shape a
  // phone-shot reaction clip arrives in.
  const t = WELLS.find((x) => x.id === "W01") ?? WELLS[0];
  return {
    id: uid(),
    t: 0,
    out: 2.5,
    align: "center",
    anchor: { x: 0.5, y: 0.5 },
    well: { template: t.id, ...(t.spec as object), caption: undefined } as Beat["well"],
    cue: DEFAULT_CUE,
    haptic: "none",
  };
}

/**
 * An arrow on its own.
 *
 * Answers to pointer lead rather than the dwell floor, so it opens brief: this
 * is a mark that points at something for a moment, not a thing to be read.
 */
function newArrowBeat(): Beat {
  return {
    id: uid(),
    t: 0,
    out: 0.6,
    align: "center",
    anchor: { x: 0.5, y: 0.5 },
    arrows: [{ name: "dart", anchor: 225, size: 220, layer: "mid" }],
    cue: DEFAULT_ARROW_CUE,
    haptic: "none",
  };
}

/**
 * Foundation pass: catalogue pickers (A2) driving a live compose() preview over
 * the video (A3), on the schema from A1. The timeline, protected regions, sound
 * rules and zip export land on top of this.
 */
export function NuggetBuilder() {
  const [canvas, setCanvas] = useState<CanvasId>("reels");

  const [showSafeZone, setShowSafeZone] = useState(true);
  const [beats, setBeats] = useState<Beat[]>(() => [newBeat("reels")]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [regions, setRegions] = useState<ProtectedRegion[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [drawingRegion, setDrawingRegion] = useState(false);

  /**
   * What the beats sit over. A clip, or a still.
   *
   * One piece of state rather than four loose ones, because "which kind" has
   * to travel with the url and the size — a still with a video's duration, or
   * a clip whose kind said image, is a bug that can only exist if they are
   * allowed to disagree.
   */
  const [bg, setBg] = useState<Background | null>(null);
  /** A still has no length of its own, so the deck says how long it runs. */
  const [stillSeconds, setStillSeconds] = useState(STILL_DEFAULT_S);
  const [overrideFor, setOverrideFor] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string[] | null>(null);
  const [pinning, setPinning] = useState(false);
  const [rendering, setRendering] = useState<RenderProgress | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  // "Nothing fits" is recorded against the beat it was true of, not as a plain
  // flag, so editing the copy or dropping the arrow clears it without an effect.
  const [noFitFor, setNoFitFor] = useState<string | null>(null);

  const selected = beats.find((b) => b.id === selectedId) ?? beats[0] ?? null;

  // What compose() actually produced, measured against the frame it is going
  // into. compose() will happily return a cluster wider than the canvas and say
  // nothing, so this is the only place the overflow becomes visible.
  const fitKey = selected
    ? JSON.stringify([selected.text, selected.medallion, selected.arrows, selected.caption, canvas])
    : null;
  const noFit = noFitFor !== null && noFitFor === fitKey;

  const patch = (next: Partial<Beat>) =>
    selected && setBeats((bs) => bs.map((b) => (b.id === selected.id ? { ...b, ...next } : b)));

  /**
   * Moving the medallion moves the arrow with it. An arrow hung off a medallion
   * names its host by side (`from`), so flipping only the medallion would leave
   * the arrow pointing at an end that no longer has one — compose() then finds
   * no host and falls through to hanging it off a caption edge instead.
   */
  const setSide = (side: "left" | "right") => {
    if (!selected?.medallion) return;
    patch({
      medallion: { ...selected.medallion, side },
      arrows: selected.arrows?.map((a) => (a.from ? { ...a, from: side } : a)),
      captionPadL: side === "left" ? gapPad : undefined,
      captionPadR: side === "right" ? gapPad : undefined,
    });
  };

  /**
   * The gap dial writes to whichever end the medallion is on, and clears the
   * other. Padding the far end too is what put the copy hard against the left
   * edge of the pill when the medallion moved right.
   */
  /*
   * Only the controls a beat actually has.
   *
   * An arrow beat has no copy, no medallion and no glyph; a well has no copy
   * unless its format carries one. Leaving them all on screen greyed out is a
   * longer column and a worse question ("does this do nothing, or am I holding
   * it wrong?") than simply not asking it.
   */
  const kind = selected ? beatKind(selected) : "nugget";
  const showsCopy = kind === "nugget";
  const showsMedallion = kind === "nugget";
  const showsGlyphs = kind === "nugget";
  const showsArrow = kind !== "well";

  const medSide = selected?.medallion?.side ?? "left";
  const gapPad = (medSide === "left" ? selected?.captionPadL : selected?.captionPadR) ?? DEFAULT_CAPTION_PAD;
  const setGapPad = (v: number) =>
    patch(medSide === "left"
      ? { captionPadL: v, captionPadR: undefined }
      : { captionPadR: v, captionPadL: undefined });

  const duration = bg ? (bg.kind === "video" ? bg.duration : stillSeconds) : 0;

  /*
   * Time belongs to the deck, not to the video element. See use-playhead.ts:
   * a still background has no clock of its own, and the transport buttons need
   * something to drive that is not the element's own controls.
   */
  const clock = usePlayhead({ duration, beats });

  /**
   * Retime the deck when the timeline length changes.
   *
   * Two things follow from it. A beat cannot end after the deck does, so
   * anything hanging past the new end is pulled back to it — the issue list
   * still catches whatever that leaves below its dwell floor, which is the
   * existing contract and better than silently holding an invalid deck.
   *
   * And a screen that spanned the whole deck goes on spanning it. It is
   * scenery rather than a moment, so "the whole thing" is the length it means,
   * not the number of seconds that happened to be true when it was added.
   */
  const setLength = useCallback(
    (next: number) => {
      const was = stillSeconds;
      setStillSeconds(next);
      setBeats((bs) =>
        bs.map((b) => {
          const spannedAll = b.well?.bare && b.t <= 0.001 && b.out >= was - 0.001;
          if (spannedAll) return { ...b, t: 0, out: next };
          return b.out > next ? { ...b, out: next } : b;
        }),
      );
    },
    [stillSeconds],
  );
  const playhead = clock.playhead;

  /**
   * Arrow tips in canvas pixels, per beat.
   *
   * compose() reports where it actually put each arrow, in its cropped
   * viewBox's coordinates. Mapping that onto the frame is the same sum the
   * stage does to place the cluster — anchor, then align — and never a second
   * guess at the kit's layout.
   */
  const placed = useMemo(() => {
    const tips = new Map<string, PlacedArrow[]>();
    const boxes = new Map<string, PlacedBox>();
    const c = CANVASES[canvas];
    for (const b of beats) {
      const p = renderBeat(b, canvas, (n) => tryGlyphDataUri(n, 512));
      if (!p) continue;
      /*
       * A pinned screen is placed by its corners, not by its anchor, so its
       * box is the quad's bounding box. Measuring it the ordinary way put the
       * rectangle at the canvas centre where the anchor still nominally sits —
       * which meant the safe-zone and protected-region checks were being run
       * against somewhere the screen is not.
       */
      if (b.well?.quad) {
        const xs = b.well.quad.map((q) => q.x * c.w);
        const ys = b.well.quad.map((q) => q.y * c.h);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        boxes.set(b.id, { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y });
        continue;
      }

      const align = b.align ?? "center";
      const originX = b.anchor.x * c.w + (align === "left" ? 0 : align === "right" ? -p.w : -p.w / 2);
      const originY = b.anchor.y * c.h - p.h / 2;
      boxes.set(b.id, { x: originX, y: originY, w: p.w, h: p.h });
      if (p.arrows.length) {
        tips.set(b.id, p.arrows.map((a) => ({ x: originX + a.x, y: originY + a.y })));
      }
    }
    return { tips, boxes };
  }, [beats, canvas]);

  const issues = useMemo(
    () => collectIssues(beats, regions, canvas, placed.tips, bg ? duration : undefined, placed.boxes),
    [beats, regions, canvas, placed, bg, duration],
  );
  const blocking = issues.filter((i) => i.level === "error");

  const size = useMemo(() => {
    if (!selected) return null;
    const p = renderBeat(selected, canvas, (n) => tryGlyphDataUri(n, 512));
    if (!p) return null;
    const limit = safeWidth(canvas);
    return {
      w: p.w, h: p.h, limit,
      medSize: Math.round(p.medSize),
      pct: Math.round((100 * p.w) / limit),
      fits: p.w <= limit,
    };
  }, [selected, canvas]);

  const stampyOptions: CatalogueOption[] = useMemo(
    () =>
      STAMPY_NAMES.map((name) => ({
        id: STAMPY_PREFIX + name,
        label: name.replace(/-/g, " "),
        hint: STAMPY_USE[name],
        thumb: `/stampy/${name}-512.png`,
        thumbIsUri: true,
      })),
    [],
  );

  /**
   * The two well families, each drawn as itself.
   *
   * A named list said "polaroid" and "crt" without showing that one has a
   * caption lip and the other is 4:3, and the eighteen shape wells are the kind
   * of choice nobody makes from a word. So both are pickers of the real thing,
   * shrunk: the template thumbs are wellSvg, the shape thumbs are frameSvg with
   * media, which is exactly what each will draw at full size.
   */
  const WELL_THUMB_MEDIA =
    "data:image/svg+xml;base64," +
    btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80">' +
        '<defs><linearGradient id="w" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#ff8fbe"/><stop offset="1" stop-color="#ffcf6b"/>' +
        "</linearGradient></defs><rect width='80' height='80' fill='url(#w)'/></svg>",
    );

  const wellFormatOptions: CatalogueOption[] = useMemo(
    () =>
      WELLS.map((w) => ({
        id: w.id,
        label: w.name,
        hint: w.use,
        thumb: wellSvg({ ...(w.spec as object), kind: "image", src: WELL_THUMB_MEDIA }, CANVASES[canvas]) as string,
      })),
    [canvas, WELL_THUMB_MEDIA],
  );

  const wellShapeOptions: CatalogueOption[] = useMemo(
    () =>
      FRAMES.map((name) => ({
        id: name,
        label: name,
        thumb: frameSvg(frame(name), 72, { media: WELL_THUMB_MEDIA }) as string,
      })),
    [WELL_THUMB_MEDIA],
  );

  /* ---- thumbnails, all drawn by the kit ---- */
  const frameOptions: CatalogueOption[] = useMemo(
    () => FRAMES.map((n) => ({
      id: n, label: n,
      thumb: safe(() => frameSvg(frame(n), 56, { fill: BRAND.red })),
    })),
    [],
  );
  const arrowOptions: CatalogueOption[] = useMemo(
    () => ARROWS.map((n) => ({
      id: n, label: n,
      thumb: safe(() => arrowSvg(n, { size: 56, fill: BRAND.red, fill2: BRAND.gold })),
    })),
    [],
  );
  const captionOptions: CatalogueOption[] = useMemo(
    () => CAPTIONS.map((n) => ({
      id: n, label: n,
      thumb: safe(() => compose({ canvas: "youtube", text: "Aa", caption: n, colorway: selected?.colorway }).svg),
    })),
    [selected?.colorway],
  );
  const borderOptions: CatalogueOption[] = useMemo(
    () => BORDERS.map((n) => ({
      id: n, label: n,
      thumb: safe(() => frameSvg(frame("circle"), 56, { fill: BRAND.red, borders: [n] })),
    })),
    [],
  );
  const glyphOptions = (names: string[]): CatalogueOption[] =>
    names.map((n) => ({ id: n, label: glyphLabel(n), thumb: tryGlyphDataUri(n, 128), thumbIsUri: true }));

  const objectOptions = useMemo(() => glyphOptions(OBJECT_GLYPHS), []);
  const occasionOptions = useMemo(() => glyphOptions(OCCASION_GLYPHS), []);

  /* ---- the two rules this pass already enforces ---- */
  const chars = selected?.text?.length ?? 0;
  const overCap = chars > CAPTION_MAX_CHARS;
  const floor = selected ? floorForBeat(selected) : 0;
  const dwell = selected ? selected.out - selected.t : 0;
  const underFloor = selected ? dwell < floor - 1e-6 : false;

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-8 sm:px-6">
      <header className="mb-6">
        <Link
          href="/"
          className="focus-stamp mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-ink-faint transition-colors hover:text-stamp-600"
        >
          <span aria-hidden>←</span> Asset Studio
        </Link>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stamp-600">POP KIT</p>
        <h1 className="mt-2 flex items-center gap-2.5 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Nugget Builder
          <HelpTip id="pop.builder" className="h-5 w-5 text-xs" />
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Pick from the POP KIT catalogue and position each nugget over your video. The preview is
          the kit&apos;s own <code className="font-mono text-xs">compose()</code> output, so what you
          place here is what the render route draws.
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* ------------------------------ stage ------------------------------ */}
        {/* The stage scrolls with the page, deliberately. A frame inside its own
            overflow box means two scrollbars competing for the same wheel, and
            the wrong one takes it about half the time. */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="Canvas" help="pop.canvas" hint={CANVASES[canvas].label}>
              <Select
                value={canvas}
                onChange={(v) => setCanvas(v as CanvasId)}
                options={Object.keys(CANVASES).map((id) => ({ id, label: id }))}
              />
            </Field>
            <label className="focus-stamp cursor-pointer rounded-2xl border border-hairline bg-white px-4 py-3 text-sm font-semibold text-ink hover:border-stamp-300">
              {bg?.name ?? "Load a video or image"}
              <input
                type="file"
                accept="video/*,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const url = URL.createObjectURL(f);
                  const isStill = f.type.startsWith("image/");
                  /*
                   * Size and, for a clip, length are the deck's business, and
                   * the timeline cannot exist without a length — so they are
                   * read off the file rather than typed in. A still has no
                   * length to read, which is what `stillSeconds` is for.
                   */
                  if (isStill) {
                    const probe = new Image();
                    probe.onload = () =>
                      setBg({
                        kind: "image", file: f, url, name: f.name,
                        width: probe.naturalWidth, height: probe.naturalHeight,
                        duration: 0,
                      });
                    probe.src = url;
                    return;
                  }
                  const probe = document.createElement("video");
                  probe.preload = "metadata";
                  probe.onloadedmetadata = () =>
                    setBg({
                      kind: "video", file: f, url, name: f.name,
                      width: probe.videoWidth, height: probe.videoHeight,
                      duration: probe.duration,
                    });
                  probe.src = url;
                }}
              />
            </label>
          </div>

          <VideoStage
            src={bg?.url ?? null}
            kind={bg?.kind ?? "video"}
            canvas={canvas}
            beats={beats}
            selectedId={selected?.id ?? null}
            onSelect={setSelectedId}
            onMove={(id, anchor) => setBeats((bs) => bs.map((b) => (b.id === id ? { ...b, anchor } : b)))}
            onMoveCorner={(id, corner, at) =>
              setBeats((bs) =>
                bs.map((b) => {
                  if (b.id !== id || !b.well?.quad) return b;
                  const quad = b.well.quad.map((p, i) => (i === corner ? at : p)) as NonNullable<
                    NonNullable<Beat["well"]>["quad"]
                  >;
                  return { ...b, well: { ...b.well, quad } };
                }),
              )
            }
            showSafeZone={showSafeZone}
            regions={regions}
            drawingRegion={drawingRegion}
            selectedRegionId={selectedRegionId}
            onSelectRegion={setSelectedRegionId}
            onDrawRegion={(r) => {
              const id = uid();
              setRegions((rs) => [...rs, { id, ...r, label: `region ${rs.length + 1}` }]);
              setSelectedRegionId(id);
              setDrawingRegion(false);
            }}
            clock={clock}
            videoWidth={bg?.width}
          />

            {bg && (
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                  <Transport clock={clock} duration={duration} />
                  {/* A still has no length of its own, so this is where the deck
                      gets one. Capped because the export records in real time. */}
                  {bg?.kind === "image" && (
                    <label className="flex items-center gap-2.5">
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                        Length
                        <HelpTip id="pop.stillLength" />
                      </span>
                      <input
                        type="range"
                        min={STILL_MIN_S}
                        max={STILL_MAX_S}
                        step={0.5}
                        value={stillSeconds}
                        onChange={(e) => setLength(Number(e.target.value))}
                        className="focus-stamp w-40 accent-stamp-600"
                        aria-label="Timeline length in seconds"
                      />
                      <span className="w-16 shrink-0 tabular-nums text-xs text-ink-faint">
                        {stillSeconds}s / {STILL_MAX_S}s
                      </span>
                    </label>
                  )}
                </div>
                <Timeline
                  beats={beats}
                  duration={duration}
                  selectedId={selected?.id ?? null}
                  playhead={playhead}
                  onSelect={setSelectedId}
                  onChange={(id, next) => setBeats((bs) => bs.map((b) => (b.id === id ? { ...b, ...next } : b)))}
                  onScrub={clock.seek}
                  onRequestOverride={setOverrideFor}
                />
              </div>
            )}

          {bg ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const b = newBeat(canvas);
                    const need = defaultDwellSeconds(b.text);
                    // Butt it against the last beat, but pull it back if that
                    // would run past the end of the video. `motion-and-feedback.md`
                    // is explicit that nuggets may sit back to back on a short cut.
                    const last = beats.reduce((m, x) => Math.max(m, x.out), 0);
                    const t = Math.max(0, Math.min(last, duration - need));
                    setBeats((bs) => [...bs, { ...b, t, out: Math.min(duration, t + need) }]);
                    setSelectedId(b.id);
                  }}
                  className="focus-stamp rounded-full border border-hairline bg-white px-3.5 py-2 text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-stamp-300"
                >
                  Add beat
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const last = beats.reduce((m, x) => Math.max(m, x.out), 0);
                    const b = newWellBeat();
                    const span = b.out - b.t;
                    const t = Math.max(0, Math.min(last, duration - span));
                    setBeats((bs) => [...bs, { ...b, t, out: Math.min(duration, t + span) }]);
                    setSelectedId(b.id);
                  }}
                  className="focus-stamp rounded-full border border-hairline bg-white px-3.5 py-2 text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-stamp-300"
                >
                  Add well
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const last = beats.reduce((m, x) => Math.max(m, x.out), 0);
                    const b = newArrowBeat();
                    const span = b.out - b.t;
                    const t = Math.max(0, Math.min(last, duration - span));
                    setBeats((bs) => [...bs, { ...b, t, out: Math.min(duration, t + span) }]);
                    setSelectedId(b.id);
                  }}
                  className="focus-stamp rounded-full border border-hairline bg-white px-3.5 py-2 text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-stamp-300"
                >
                  Add arrow
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Spans the deck rather than being tucked after the last
                    // beat: it is scenery, not a moment.
                    const b = newScreenBeat(duration);
                    setBeats((bs) => [...bs, b]);
                    setSelectedId(b.id);
                  }}
                  className="focus-stamp rounded-full border border-hairline bg-white px-3.5 py-2 text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-stamp-300"
                >
                  Add screen
                </button>
                {beats.length > 1 && selected && (
                  <button
                    type="button"
                    onClick={() => {
                      setBeats((bs) => bs.filter((b) => b.id !== selected.id));
                      setSelectedId(null);
                    }}
                    className="focus-stamp rounded-full border border-hairline bg-white px-3.5 py-2 text-xs font-bold text-ink/70 transition-all hover:-translate-y-0.5 hover:border-red-300"
                  >
                    Delete beat
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawingRegion((v) => !v)}
                  className={cx(
                    "focus-stamp rounded-full border px-3.5 py-2 text-xs font-bold transition-all hover:-translate-y-0.5",
                    drawingRegion ? "border-amber-400 bg-amber-100 text-amber-900" : "border-hairline bg-white text-ink",
                  )}
                >
                  {drawingRegion ? "Drawing — drag on the frame" : "Mark protected region"}
                </button>
                {selectedRegionId && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegions((rs) => rs.filter((r) => r.id !== selectedRegionId));
                      setSelectedRegionId(null);
                    }}
                    className="focus-stamp rounded-full border border-hairline bg-white px-3.5 py-2 text-xs font-bold text-ink/70 transition-all hover:-translate-y-0.5 hover:border-red-300"
                  >
                    Delete region
                  </button>
                )}
              </div>

              {selectedRegionId && (() => {
                const r = regions.find((x) => x.id === selectedRegionId);
                if (!r) return null;
                const set = (next: Partial<ProtectedRegion>) =>
                  setRegions((rs) => rs.map((x) => (x.id === r.id ? { ...x, ...next } : x)));
                return (
                  <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:grid-cols-3">
                    <Field label="Region label" help="pop.region">
                      <input
                        value={r.label ?? ""}
                        onChange={(e) => set({ label: e.target.value })}
                        placeholder="logo, watermark…"
                        className="focus-stamp w-full rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs"
                      />
                    </Field>
                    <Field label="From (s)" help="pop.regionWindow" hint="Blank means the whole video.">
                      <input
                        type="number" min={0} max={duration} step={0.1}
                        value={r.from ?? ""}
                        onChange={(e) => set({ from: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className="focus-stamp w-full rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </Field>
                    <Field label="To (s)">
                      <input
                        type="number" min={0} max={duration} step={0.1}
                        value={r.to ?? ""}
                        onChange={(e) => set({ to: e.target.value === "" ? undefined : Number(e.target.value) })}
                        className="focus-stamp w-full rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </Field>
                  </div>
                );
              })()}

              <IssueList issues={issues} beats={beats} onSelect={setSelectedId} />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!bg || blocking.length > 0 || !!rendering || !canRecordVideo()}
                  onClick={async () => {
                    if (!bg) return;
                    setRenderError(null);
                    setRendering({ stage: "Preparing" });
                    try {
                      const { blob, ext } = await renderNuggets({
                        file: bg.file,
                        kind: bg.kind,
                        duration,
                        beats,
                        canvas,
                        onProgress: setRendering,
                      });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `${exportBasename(bg?.name ?? null)}-nuggets.${ext}`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                    } catch (err) {
                      setRenderError(err instanceof Error ? err.message : String(err));
                    } finally {
                      setRendering(null);
                    }
                  }}
                  className="focus-stamp rounded-full bg-stamp-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-ink/20 disabled:hover:translate-y-0"
                >
                  {rendering
                    ? `${rendering.stage}${rendering.pct !== undefined ? ` ${rendering.pct}%` : ""}…`
                    : "Render video"}
                </button>

                <button
                  type="button"
                  disabled={!bg || bg.kind === "image" || blocking.length > 0}
                  onClick={async () => {
                    if (!bg || bg.kind !== "video") return;
                    const base = exportBasename(bg?.name ?? null);
                    const deck = buildDeck({
                      id: uid(), canvas, fps: 30, beats, regions, videoName: bg.name,
                      duration: bg.duration, width: bg.width, height: bg.height,
                    });
                    // The render route validates the same deck with the same
                    // schema and validator. Catching it here means the failure
                    // lands next to the controls that caused it.
                    const schemaErrors = validateDeckAgainstSchema(deck);
                    if (schemaErrors.length) {
                      setExportError(schemaErrors);
                      return;
                    }
                    setExportError(null);
                    const bytes = new Uint8Array(await bg.file.arrayBuffer());
                    const json = new TextEncoder().encode(JSON.stringify(deck, null, 2));
                    const zip = makeZip([
                      { name: deck.video.filename, bytes },
                      { name: `${base}.deck.json`, bytes: Uint8Array.from(json) },
                    ]);
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(zip);
                    a.download = `${base}.zip`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                  className="focus-stamp rounded-full border border-hairline bg-white px-4 py-2.5 text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-stamp-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                >
                  Export zip
                </button>
                <span className="text-xs text-ink-faint">
                  {blocking.length
                    ? `${blocking.length} issue${blocking.length > 1 ? "s" : ""} to resolve first.`
                    : rendering
                      ? "Runs in real time, so about as long as the deck."
                      : bg?.kind === "image"
                        ? "Render video only — the zip is for the Claude skill, which has no idea what a still background is."
                        : `${exportBasename(bg?.name ?? null)}.zip — the video and ${exportBasename(bg?.name ?? null)}.deck.json`}
                </span>
              </div>

              {renderError && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                  {renderError}
                </p>
              )}

              {exportError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                  <p className="font-bold">The deck does not match the schema, so it was not written.</p>
                  <ul className="mt-1 space-y-0.5">
                    {exportError.map((e, i) => <li key={i} className="font-mono">{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          ) : bg ? (
            <p className="mt-4 text-xs text-ink-faint">Reading the video&rsquo;s duration…</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Switch checked={showSafeZone} onChange={setShowSafeZone} label="Show safe zone" help="pop.safeZone" />
            {selected && (
              <p className="font-mono text-[11px] text-ink-faint">
                anchor {selected.anchor.x.toFixed(3)}, {selected.anchor.y.toFixed(3)}
              </p>
            )}
          </div>
        </div>

        {/* ----------------------------- pickers ----------------------------- */}
        {/* This is the column that outgrows the window, so this is the one that
            gets its own scrollbar. Pinned and self-scrolling, it keeps the page
            about as tall as the stage, which is what keeps the frame in view
            while a picker at the bottom of this list is being used.
            `self-start` stops the grid cell stretching to the row, which is what
            gives sticky something to do. Two-column layout only; stacked, there
            is nothing to pin against. */}
        <div className="space-y-5 xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
          {selected && (
            <>
              <div className="card-surface space-y-4 p-5">
                {showsCopy && (
                <Field
                  label="Copy"
                  help="pop.copy"
                  hint={`${chars}/${CAPTION_MAX_CHARS} characters · dwell floor ${floor.toFixed(2)}s`}
                >
                  <textarea
                    value={selected.text ?? ""}
                    onChange={(e) => patch({ text: e.target.value })}
                    rows={3}
                    className={cx(
                      "focus-stamp w-full resize-none rounded-2xl border bg-white px-4 py-3 text-sm leading-relaxed transition-colors",
                      overCap ? "border-danger" : "border-hairline focus:border-stamp-600",
                    )}
                  />
                </Field>
                )}

                {overCap && (
                  <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
                    Over the 120-character cap by {chars - CAPTION_MAX_CHARS}. Export is blocked
                    until it fits — <span className="font-mono">annotation-system.md</span> treats
                    this as a gate, not a guideline.
                  </p>
                )}

                <div className="rounded-xl border border-hairline bg-paper px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs font-bold text-ink">Composed size</span>
                    {size && (
                      <span className={cx("font-mono text-xs", size.fits ? "text-ink/60" : "text-amber-700")}>
                        {Math.round(size.w)} × {Math.round(size.h)}px
                      </span>
                    )}
                  </div>
                  {size && (
                    <p className={cx("mt-1 text-xs leading-relaxed", size.fits ? "text-ink/60" : "text-amber-800")}>
                      {size.fits
                        ? `${size.pct}% of the ${size.limit}px safe width · medallion ${size.medSize}px`
                        : `${size.pct}% of the ${size.limit}px safe width — this overflows the frame.`}
                    </p>
                  )}
                  {size && !size.fits && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const fit = fitBeat(selected, canvas, (n) => tryGlyphDataUri(n, 512));
                          if (fit) {
                            setNoFitFor(null);
                            patch(fit);
                          } else {
                            // Real on the small canvases: on ios, 393px wide, a
                            // caption with a medallion and an arrow is 113% of
                            // the safe width even at the narrowest wrap and the
                            // smallest font. Say so rather than no-op.
                            setNoFitFor(fitKey);
                          }
                        }}
                        className="focus-stamp mt-2 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 transition-all hover:-translate-y-0.5"
                      >
                        Fit to safe area
                      </button>
                      {noFit && (
                        <p role="alert" className="mt-2 text-xs leading-relaxed text-amber-800">
                          No text size fits this cluster on {CANVASES[canvas].label}. Shorten the
                          copy, or drop the {selected.arrows?.length ? "arrow" : "medallion"}.
                        </p>
                      )}
                    </>
                  )}
                </div>

                {showsCopy && (
                <Field
                  label="Text size"
                  help="pop.textSize"
                  hint={`${selected.fontSize ?? CANVASES[canvas].base}px · the canvas base is ${CANVASES[canvas].base}px`}
                >
                  <input
                    type="range"
                    min={20}
                    max={Math.round(CANVASES[canvas].base * 1.6)}
                    step={1}
                    value={selected.fontSize ?? CANVASES[canvas].base}
                    onChange={(e) => patch({ fontSize: Number(e.target.value) })}
                    className="focus-stamp w-full accent-stamp-600"
                  />
                </Field>
                )}

                {showsCopy && (
                <Field
                  label="Cluster width"
                  help="pop.clusterWidth"
                  hint={`${selected.maxTextW ?? Math.round(CANVASES[canvas].w * 0.62)}px wrap · canvas is ${CANVASES[canvas].w}px wide`}
                >
                  <input
                    type="range"
                    min={200}
                    max={CANVASES[canvas].w}
                    step={10}
                    value={selected.maxTextW ?? Math.round(CANVASES[canvas].w * 0.62)}
                    onChange={(e) => patch({ maxTextW: Number(e.target.value) })}
                    className="focus-stamp w-full accent-stamp-600"
                  />
                </Field>
                )}

                {/* The medallion's own controls, kept together and led by the
                    side switch. It was a dropdown three sliders down the list
                    before, which is a place nobody looks for "put it on the
                    other side". */}
                {/* A bare well has none of a framed well's furniture, so it gets
                    its own controls rather than a panel of disabled ones. */}
                {kind === "well" && selected.well?.bare && (
                  <fieldset className="space-y-4 rounded-xl border border-hairline bg-paper/60 p-3.5">
                    <legend className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                      Screen
                      <HelpTip id="pop.screen" />
                    </legend>

                    <Field
                      label="Media"
                      help="pop.wellMedia"
                      hint={selected.well.src ? "Loaded." : "The picture or clip that plays on the screen."}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <UploadButton
                          label={selected.well.src ? "Replace…" : "Upload…"}
                          accept="image/*,video/*"
                          onFile={(uri, file) =>
                            patch({
                              well: {
                                ...selected.well!,
                                src: uri,
                                kind: file.type.startsWith("video/") ? "video" : "image",
                              },
                            })
                          }
                        />
                        {selected.well.src && (
                          <button
                            type="button"
                            onClick={() => patch({ well: { ...selected.well!, src: undefined } })}
                            className="focus-stamp rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-bold text-ink/70 transition-all hover:-translate-y-0.5 hover:border-red-300"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </Field>

                    <Field label="Aspect" help="pop.screenAspect" hint="Shape of the screen you are matching.">
                      <Select
                        value={String(selected.well.aspect ?? 9 / 19.5)}
                        onChange={(v) => patch({ well: { ...selected.well!, aspect: Number(v) } })}
                        options={SCREEN_ASPECTS.map((a) => ({ id: String(a.value), label: a.label }))}
                      />
                    </Field>

                    <Field
                      label="Width"
                      help="pop.screenWidth"
                      hint={`${Math.round(CANVASES[canvas].w * 0.34 * (selected.well.size ?? 1))}px on a ${CANVASES[canvas].w}px canvas`}
                    >
                      <input
                        type="range" min={0.2} max={3} step={0.05}
                        value={selected.well.size ?? 1}
                        onChange={(e) => patch({ well: { ...selected.well!, size: Number(e.target.value) } })}
                        className="focus-stamp w-full accent-stamp-600"
                      />
                    </Field>

                    <Field
                      label="Corner radius"
                      help="pop.screenRadius"
                      hint={(selected.well.radius ?? 0) === 0 ? "Square corners" : `${selected.well.radius}px`}
                    >
                      <input
                        type="range" min={0} max={120} step={1}
                        value={selected.well.radius ?? 0}
                        onChange={(e) => patch({ well: { ...selected.well!, radius: Number(e.target.value) } })}
                        className="focus-stamp w-full accent-stamp-600"
                      />
                    </Field>

                    <Field
                      label="Glass"
                      help="pop.screenGloss"
                      hint={
                        (selected.well.gloss ?? 0) === 0
                          ? "Off — a flat paste."
                          : `${Math.round((selected.well.gloss ?? 0) * 100)}% · sheen and a darkened edge`
                      }
                    >
                      <input
                        type="range" min={0} max={1} step={0.05}
                        value={selected.well.gloss ?? 0}
                        onChange={(e) => patch({ well: { ...selected.well!, gloss: Number(e.target.value) } })}
                        className="focus-stamp w-full accent-stamp-600"
                      />
                    </Field>

                    <Field
                      label="Perspective"
                      help="pop.screenPin"
                      hint={
                        selected.well.quad
                          ? "Drag the four corners onto the screen in the photo."
                          : "Pin the corners to lay it into the scene."
                      }
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={pinning}
                          onClick={async () => {
                            const well = selected.well!;
                            setPinning(true);
                            try {
                              patch({ well: { ...well, quad: await proposeQuad(bg, canvas, well.aspect ?? 1) } });
                            } finally {
                              setPinning(false);
                            }
                          }}
                          className="focus-stamp rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-stamp-300 disabled:opacity-50"
                        >
                          {pinning ? "Looking…" : selected.well.quad ? "Find the screen again" : "Pin to the scene"}
                        </button>
                        {selected.well.quad && (
                          <button
                            type="button"
                            onClick={() => patch({ well: { ...selected.well!, quad: undefined } })}
                            className="focus-stamp rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-bold text-ink/70 transition-all hover:-translate-y-0.5 hover:border-red-300"
                          >
                            Unpin
                          </button>
                        )}
                      </div>
                    </Field>
                  </fieldset>
                )}

                {kind === "well" && selected.well && !selected.well.bare && (
                  <fieldset className="space-y-4 rounded-xl border border-hairline bg-paper/60 p-3.5">
                    <legend className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                      Media well
                      <HelpTip id="pop.well" />
                    </legend>

                    <CataloguePicker
                      label="Format"
                      help="pop.wellFormat"
                      options={wellFormatOptions}
                      columns={5}
                      value={selected.well.frame ? undefined : selected.well.template}
                      hint="The ten named formats. Each carries its own proportion and furniture."
                      onChange={(id) => {
                        const t = WELLS.find((x) => x.id === id);
                        if (!t) return;
                        // the format decides the furniture, never the picture:
                        // whatever media is loaded survives the switch
                        patch({
                          well: {
                            ...(t.spec as object),
                            template: t.id,
                            frame: undefined,
                            src: selected.well?.src,
                            poster: selected.well?.poster,
                            kind: selected.well?.src ? selected.well.kind : (t.spec as { kind: "image" | "video" }).kind,
                          } as Beat["well"],
                        });
                      }}
                    />

                    <CataloguePicker
                      label="Or a shape well"
                      help="pop.wellShape"
                      options={wellShapeOptions}
                      columns={9}
                      value={selected.well.frame}
                      hint="Any of the eighteen frames with a hole in it. No caption lip; the shape is the whole thing."
                      onChange={(frameName) =>
                        patch({
                          well: {
                            ...selected.well!,
                            frame: frameName,
                            template: frameName ? undefined : selected.well!.template,
                          },
                        })
                      }
                      allowNone
                    />

                    <Field label="Media" help="pop.wellMedia" hint={selected.well.src ? `A ${selected.well.kind === "video" ? "clip" : "still"} is loaded.` : "A picture or a clip to sit in the shape."}>
                      <div className="flex flex-wrap items-center gap-2">
                        <UploadButton
                          label={selected.well.src ? "Replace…" : "Upload…"}
                          accept="image/*,video/*"
                          onFile={(uri, file) =>
                            patch({
                              well: {
                                ...selected.well!,
                                src: uri,
                                kind: file.type.startsWith("video/") ? "video" : "image",
                              },
                            })
                          }
                        />
                        {selected.well.src && (
                          <button
                            type="button"
                            onClick={() => patch({ well: { ...selected.well!, src: undefined } })}
                            className="focus-stamp rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-bold text-ink/70 transition-all hover:-translate-y-0.5 hover:border-red-300"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Shape" help="pop.wellShapeField" hint={selected.well.frame ? "Set by the shape well above." : "Sets the aspect the media is cropped to."}>
                        <Select
                          value={selected.well.shape ?? "rounded"}
                          onChange={(shape) => patch({ well: { ...selected.well!, shape } })}
                          options={WELL_SHAPE_NAMES.map((id) => ({ id, label: id }))}
                          placeholder={selected.well.frame ? "—" : undefined}
                        />
                      </Field>
                      <Field
                        label="Size"
                        help="pop.wellSize"
                        hint={`${(selected.well.size ?? 1).toFixed(2)}× · ${size ? `${Math.round(size.w)}px wide` : "the canvas default"}`}
                      >
                        <input
                          type="range"
                          min={0.35}
                          max={2}
                          step={0.05}
                          value={selected.well.size ?? 1}
                          onChange={(e) => patch({ well: { ...selected.well!, size: Number(e.target.value) } })}
                          className="focus-stamp w-full accent-stamp-600"
                        />
                      </Field>
                    </div>

                    {!selected.well.frame && (
                    <Field label="Caption" help="pop.wellCaption" hint="Sits under the media, inside the frame. Leave empty for none.">
                      <input
                        value={selected.well.caption ?? ""}
                        onChange={(e) => patch({ well: { ...selected.well!, caption: e.target.value || undefined } })}
                        className="focus-stamp w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm"
                      />
                    </Field>
                    )}

                    {!selected.well.frame && (
                    <Field label="Kicker" help="pop.wellKicker" hint="The small line above the caption.">
                      <input
                        value={selected.well.kicker ?? ""}
                        onChange={(e) => patch({ well: { ...selected.well!, kicker: e.target.value || undefined } })}
                        className="focus-stamp w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm"
                      />
                    </Field>
                    )}
                  </fieldset>
                )}

                {showsMedallion && (
                <fieldset className="space-y-4 rounded-xl border border-hairline bg-paper/60 p-3.5">
                  <legend className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                    Medallion
                    <HelpTip id="pop.medallion" />
                  </legend>

                  <Field label="Side" help="pop.side" hint="The glyph and its arrow move with it.">
                    <SideToggle
                      value={selected.medallion?.side ?? "left"}
                      disabled={!selected.medallion}
                      onChange={setSide}
                    />
                  </Field>

                  <Field
                    label="Size"
                    help="pop.medallionSize"
                    hint={`${(selected.medallionScale ?? MEDALLION_SCALE_KIT_DEFAULT).toFixed(2)}× the caption height${size ? ` · ${size.medSize}px` : ""} · kit default is ${MEDALLION_SCALE_KIT_DEFAULT}`}
                  >
                    <input
                      type="range"
                      min={0.7}
                      max={1.8}
                      step={0.05}
                      value={selected.medallionScale ?? MEDALLION_SCALE_KIT_DEFAULT}
                      onChange={(e) => patch({ medallionScale: Number(e.target.value) })}
                      className="focus-stamp w-full accent-stamp-600"
                      disabled={!selected.medallion}
                    />
                  </Field>

                  <Field
                    label="Lap over the caption"
                    help="pop.lap"
                    hint={`${(selected.overlap ?? OVERLAP_KIT_DEFAULT).toFixed(2)} · how far it sits over the caption end`}
                  >
                    <input
                      type="range"
                      min={0.05}
                      max={0.75}
                      step={0.01}
                      value={selected.overlap ?? OVERLAP_KIT_DEFAULT}
                      onChange={(e) => patch({ overlap: Number(e.target.value) })}
                      className="focus-stamp w-full accent-stamp-600"
                      disabled={!selected.medallion}
                    />
                  </Field>

                  <Field
                    label="Well media"
                    help="pop.wellMedia"
                    hint={
                      selected.medallion?.media
                        ? `${selected.medallion.mediaIsVideo ? "A clip" : "A still"} fills the shape. Clips are drawn by this renderer, not by the skill route.`
                        : "Put a picture or a clip in the shape instead of a flat fill."
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <UploadButton
                        label={selected.medallion?.media ? "Replace…" : "Upload…"}
                        accept="image/*,video/*"
                        onFile={(uri, file) =>
                          selected.medallion &&
                          patch({
                            medallion: {
                              ...selected.medallion,
                              media: uri,
                              mediaIsVideo: file.type.startsWith("video/"),
                            },
                          })
                        }
                      />
                      {selected.medallion?.media && (
                        <button
                          type="button"
                          onClick={() =>
                            selected.medallion &&
                            patch({
                              medallion: { ...selected.medallion, media: undefined, mediaIsVideo: undefined },
                            })
                          }
                          className="focus-stamp rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-bold text-ink/70 transition-all hover:-translate-y-0.5 hover:border-red-300"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </Field>

                  <Field
                    label="Gap to the text"
                    help="pop.gap"
                    hint={`${gapPad}px padding on the ${medSide} end · this distance does not change with medallion size, so this is the dial that closes it`}
                  >
                    <input
                      type="range"
                      min={8}
                      max={90}
                      step={1}
                      value={gapPad}
                      onChange={(e) => setGapPad(Number(e.target.value))}
                      className="focus-stamp w-full accent-stamp-600"
                      disabled={!selected.medallion}
                    />
                  </Field>
                </fieldset>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Sound cue"
                    help="pop.sound"
                    hint="Plays on entrance only. Cues under 250ms apart collide and the second is silenced."
                  >
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <Select
                          value={selected.cue ?? "silent"}
                          onChange={(v) => {
                            patch({ cue: v as SoundCue });
                            // Audition on pick. Choosing a sound you cannot hear
                            // is choosing a name off a list, and the names are
                            // not the point: `stamp` and `seal` read alike and
                            // sound nothing alike.
                            playCue(v);
                          }}
                          options={SOUND_CUES.map((id) => ({
                            id,
                            label: id === "silent" ? "No sound" : `${id}${CUE_MS[id] ? ` · ${CUE_MS[id]}ms` : ""}`,
                          }))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => playCue(selected.cue)}
                        disabled={!selected.cue || selected.cue === "silent"}
                        aria-label="Play this cue"
                        title="Play this cue"
                        className="focus-stamp shrink-0 rounded-xl border border-hairline bg-white px-2.5 py-2 text-ink transition-all hover:-translate-y-0.5 hover:border-stamp-300 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
                      >
                        <svg viewBox="0 0 14 14" aria-hidden="true" className="h-3.5 w-3.5">
                          <path d="M4 2.5l7 4.5-7 4.5z" fill="currentColor" />
                        </svg>
                      </button>
                    </div>
                  </Field>
                  <Field
                    label="Dwell"
                    help="pop.dwell"
                    hint={`${(selected.out - selected.t).toFixed(2)}s on screen · floor is ${floor.toFixed(2)}s`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cx(
                          "rounded-lg px-2.5 py-1.5 text-xs font-bold tabular-nums",
                          underFloor ? "bg-red-100 text-red-900" : "bg-paper text-ink/70",
                        )}
                      >
                        {selected.t.toFixed(2)}s → {selected.out.toFixed(2)}s
                      </span>
                      {underFloor && !selected.override?.dwellFloor && (
                        <button
                          type="button"
                          onClick={() => setOverrideFor(selected.id)}
                          className="focus-stamp rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-900"
                        >
                          Override…
                        </button>
                      )}
                      {selected.override?.dwellFloor && (
                        <button
                          type="button"
                          onClick={() => patch({ override: undefined })}
                          className="focus-stamp rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900"
                          title={selected.override.dwellFloor.reason || "No reason recorded"}
                        >
                          Override recorded — clear
                        </button>
                      )}
                    </div>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Colourway" help="pop.colourway">
                    <Select
                      value={selected.colorway ?? "house"}
                      onChange={(colorway) => patch({ colorway })}
                      options={COLORWAY_NAMES.map((id) => ({ id, label: id }))}
                    />
                  </Field>
                  <Field label="Anchor point" help="pop.anchor" hint="Which part of the cluster sits on the anchor.">
                    <Select
                      value={selected.align ?? "center"}
                      onChange={(v) => patch({ align: v as Beat["align"] })}
                      options={[
                        { id: "left", label: "Left edge" },
                        { id: "center", label: "Centre" },
                        { id: "right", label: "Right edge" },
                      ]}
                    />
                  </Field>
                </div>

                <ColorwayStrip
                  value={selected.colorway ?? "house"}
                  onChange={(colorway) => patch({ colorway })}
                />
              </div>

              <div className="card-surface px-5 py-1">
                <Accordion>
{showsCopy && (
                <Disclosure id="caption" label="Caption shell" help="pop.captionShell" value={selected.caption} count={captionOptions.length}>
                  <CataloguePicker
                    label="" options={captionOptions} columns={6}
                    value={selected.caption} onChange={(caption) => patch({ caption })}
                  />
                </Disclosure>
)}

{showsMedallion && (
                <Disclosure id="frame" label="Medallion frame" help="pop.frame" value={selected.medallion?.frame ?? "none"} count={frameOptions.length}>
                  <CataloguePicker
                    label="" options={frameOptions} columns={9}
                    value={selected.medallion?.frame}
                    onChange={(f) =>
                      patch({
                        medallion: f
                          ? { side: selected.medallion?.side ?? "left", ...selected.medallion, frame: f }
                          : undefined,
                      })
                    }
                    allowNone
                  />
                </Disclosure>
)}

{showsMedallion && (
                <Disclosure id="border" label="Border treatment" help="pop.border" value={selected.medallion?.borders?.[0] ?? "register default"} count={borderOptions.length}>
                  <CataloguePicker
                    label="" options={borderOptions} columns={7} allowNone
                    value={selected.medallion?.borders?.[0]}
                    onChange={(b) =>
                      selected.medallion &&
                      patch({ medallion: { ...selected.medallion, borders: b ? [b] : undefined } })
                    }
                  />
                </Disclosure>
)}

{showsArrow && (
                <Disclosure id="arrow" label="Arrow" help="pop.arrow" value={selected.arrows?.[0]?.name ?? "none"} count={arrowOptions.length}>
                  <CataloguePicker
                    label="" options={arrowOptions} columns={9} allowNone
                    value={selected.arrows?.[0]?.name}
                    onChange={(name) =>
                      patch({
                        arrows: name
                          ? [{ ...(selected.arrows?.[0] ?? { from: medSide, anchor: 225, scale: 0.6 }), name, over: false, layer: selected.arrows?.[0]?.layer ?? "mid" }]
                          : [],
                      })
                    }
                  />
                  {selected.arrows?.length ? (
                    <div className="mt-4 space-y-4">
                      <Field
                        label="Arrow angle"
                        help="pop.arrowAngle"
                        hint={`${selected.arrows[0].anchor ?? 225}° round the medallion · 0 is up, 90 is right`}
                      >
                        <input
                          type="range"
                          min={0}
                          max={355}
                          step={5}
                          value={selected.arrows[0].anchor ?? 225}
                          onChange={(e) => {
                            const a = selected.arrows?.[0];
                            if (a) patch({ arrows: [{ ...a, anchor: Number(e.target.value) }] });
                          }}
                          className="focus-stamp w-full accent-stamp-600"
                        />
                      </Field>
                      <Field label="Arrow layer" help="pop.arrowLayer" hint="Where the arrow draws in the stack.">
                        <Select
                          value={selected.arrows[0].layer ?? "mid"}
                          onChange={(v) => {
                            const a = selected.arrows?.[0];
                            if (a) patch({ arrows: [{ ...a, layer: v as NonNullable<Beat["arrows"]>[number]["layer"] }] });
                          }}
                          options={[
                            { id: "mid", label: "Over the caption, under the medallion" },
                            { id: "under", label: "Behind the caption (tail tucks under)" },
                            { id: "over", label: "Over everything" },
                          ]}
                        />
                      </Field>
                    </div>
                  ) : null}
                </Disclosure>
)}

{showsGlyphs && (
                <Disclosure
                  id="object" label="Object glyph" help="pop.objectGlyph" count={objectOptions.length}
                  value={selected.medallion?.glyph?.startsWith("obj-") ? glyphLabel(selected.medallion.glyph) : "none"}
                >
                  <CataloguePicker
                    label="" options={objectOptions} columns={8} allowNone searchable
                    value={selected.medallion?.glyph && selected.medallion.glyph.startsWith("obj-") ? selected.medallion.glyph : undefined}
                    onChange={(glyph) =>
                      selected.medallion && patch({ medallion: { ...selected.medallion, glyph } })
                    }
                  />
                </Disclosure>
)}

{showsGlyphs && (
                <Disclosure
                  id="occasion" label="Occasion glyph" help="pop.occasionGlyph" count={occasionOptions.length}
                  value={selected.medallion?.glyph && !selected.medallion.glyph.startsWith("obj-") ? glyphLabel(selected.medallion.glyph) : "none"}
                >
                  <CataloguePicker
                    label="" options={occasionOptions} columns={8} allowNone searchable
                    value={selected.medallion?.glyph && !selected.medallion.glyph.startsWith("obj-") ? selected.medallion.glyph : undefined}
                    onChange={(glyph) =>
                      selected.medallion && patch({ medallion: { ...selected.medallion, glyph } })
                    }
                  />
                </Disclosure>
)}

{showsGlyphs && (
                <Disclosure id="custom" label="Your own glyph" help="pop.customGlyph" value={selected.medallion?.glyph?.startsWith("data:") ? "uploaded" : "none"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <UploadButton
                      label="Upload a glyph…"
                      accept="image/png,image/svg+xml,image/jpeg,image/webp"
                      onFile={(uri) =>
                        selected.medallion && patch({ medallion: { ...selected.medallion, glyph: uri } })
                      }
                    />
                    {selected.medallion?.glyph?.startsWith("data:") && (
                      <button
                        type="button"
                        onClick={() =>
                          selected.medallion && patch({ medallion: { ...selected.medallion, glyph: undefined } })
                        }
                        className="focus-stamp rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-bold text-ink/70 transition-all hover:-translate-y-0.5 hover:border-red-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                    PNG, SVG, JPEG or WebP. Stills are resized to 512px; SVGs are kept as they are.
                    It rides inside the deck, so nothing needs uploading anywhere.
                  </p>
                </Disclosure>
)}

{showsGlyphs && (
                <Disclosure
                  id="stampy" label="Stampy" help="pop.stampy" count={stampyOptions.length}
                  value={isStampy(selected.medallion?.glyph) ? selected.medallion!.glyph!.slice(STAMPY_PREFIX.length).replace(/-/g, " ") : "none"}
                >
                  <CataloguePicker
                    label="" options={stampyOptions} columns={7} allowNone searchable
                    value={isStampy(selected.medallion?.glyph) ? selected.medallion?.glyph : undefined}
                    onChange={(glyph) =>
                      selected.medallion && patch({ medallion: { ...selected.medallion, glyph } })
                    }
                    hint="Artwork, not code. The head is matched across expressions, so props spill rather than shrink the face."
                  />
                </Disclosure>
)}
                </Accordion>

                {selected.medallion?.glyph && (
                  <div className="border-t border-hairline pt-4 pb-4">
                    <Field
                      label="Glyph size"
                      help="pop.glyphSize"
                      hint={`${(selected.medallion.glyphFrac ?? GLYPH_FRAC_KIT_DEFAULT).toFixed(2)}× the frame's safe box · kit default is ${GLYPH_FRAC_KIT_DEFAULT}`}
                    >
                      <input
                        type="range"
                        min={0.6}
                        max={1.6}
                        step={0.05}
                        value={selected.medallion.glyphFrac ?? GLYPH_FRAC_KIT_DEFAULT}
                        onChange={(e) =>
                          selected.medallion &&
                          patch({ medallion: { ...selected.medallion, glyphFrac: Number(e.target.value) } })
                        }
                        className="focus-stamp w-full accent-stamp-600"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {overrideFor && (() => {
        const b = beats.find((x) => x.id === overrideFor);
        if (!b) return null;
        const d = checkDwell(b);
        return (
          <DwellOverrideDialog
            computed={d.computed}
            actual={d.actual}
            chars={(b.text ?? "").length}
            onCancel={() => setOverrideFor(null)}
            onConfirm={(reason) => {
              setBeats((bs) =>
                bs.map((x) =>
                  x.id === b.id
                    ? { ...x, override: { dwellFloor: { computed: d.computed, actual: d.actual, reason } } }
                    : x,
                ),
              );
              setOverrideFor(null);
            }}
          />
        );
      })()}
    </div>
  );
}

/**
 * The dwell floor is not a suggestion, and getting under it is a decision.
 *
 * `motion-and-feedback.md` calls a sub-floor trim "a flagged compromise, not
 * routine practice". So the numbers it is granted against are written into the
 * deck, and the render route re-reports it rather than trusting that the editor
 * asked. Trimming further afterwards invalidates the record and blocks again.
 */
function DwellOverrideDialog({
  computed,
  actual,
  chars,
  onCancel,
  onConfirm,
}: {
  computed: number;
  actual: number;
  chars: number;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl border border-hairline bg-white p-5 shadow-xl">
        <h2 className="text-base font-extrabold text-ink">Below the dwell floor</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink/70">
          This copy needs <b className="tabular-nums">{computed.toFixed(2)}s</b> to be readable and the beat
          gives it <b className="tabular-nums">{actual.toFixed(2)}s</b>.
        </p>

        {/* motion-and-feedback.md puts dwell last precisely because it is the
            one number about comprehension rather than rhythm. Offering the
            override without the cheaper fixes above it would make the last
            resort the first thing anyone reaches for. */}
        <ol className="mt-3 space-y-1.5 rounded-xl border border-hairline bg-paper px-3 py-2.5 text-xs leading-relaxed text-ink/70">
          <li><b className="text-ink">Shorten the copy.</b> {chars} characters sets this floor; every 10 fewer buys back 0.35s.</li>
          <li><b className="text-ink">Move the beat</b> off the cut, if the footage is what is squeezing it.</li>
          <li><b className="text-ink">Extend the shot,</b> or let the nugget run into the next one. Nuggets can sit back to back.</li>
          <li className="text-ink/50">Trim the dwell last, and reluctantly.</li>
        </ol>

        <p className="mt-3 text-sm leading-relaxed text-ink/70">
          Going ahead records the compromise in the deck. It is not applied silently, and the render
          route reports it again.
        </p>
        <label className="mt-4 block text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
          Why
        </label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="the footage cuts here"
          className="focus-stamp mt-1.5 w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-stamp rounded-full px-3.5 py-2 text-sm font-semibold text-ink/70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason.trim())}
            className="focus-stamp rounded-full bg-stamp-600 px-4 py-2 text-sm font-bold text-white"
          >
            Record the override
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Upload a still, a clip, or an SVG, and hand back a data URI.
 *
 * There is no asset server behind PopKit and the format never asked for one:
 * `media-wells.md` writes a well as `media: 'data:…'` and the built-in glyphs
 * are already data URIs. So an upload becomes one too, and travels inside the
 * deck like everything else.
 *
 * Stills are redrawn to 512px first. A 4000px phone photo is several megabytes
 * of base64 for something that renders at 180 pixels, and the deck has to carry
 * every byte of it. SVGs are passed through untouched, because rasterising the
 * one format that does not need it would throw away the reason to use it.
 */
function UploadButton({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (uri: string, file: File) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <label
      className={cx(
        "focus-stamp inline-flex cursor-pointer items-center gap-2 rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-stamp-300",
        busy && "pointer-events-none opacity-60",
      )}
    >
      {busy ? "Reading…" : label}
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            const blob = f.type.startsWith("video/") || isSvg(f) ? f : await normaliseImage(f);
            onFile(await toDataUri(blob), f);
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

/**
 * Left or right, drawn as the two sides of a nugget rather than named in a list.
 *
 * A dropdown reads as configuration; this reads as the choice it is, and the
 * little marks show which end the medallion lands on without anyone parsing
 * "left of the text" against a preview they are already looking at.
 */
function SideToggle({
  value,
  disabled,
  onChange,
}: {
  value: "left" | "right";
  disabled?: boolean;
  onChange: (side: "left" | "right") => void;
}) {
  const opts = [
    { id: "left" as const, label: "Left of the text" },
    { id: "right" as const, label: "Right of the text" },
  ];
  return (
    <div role="radiogroup" aria-label="Medallion side" className="grid grid-cols-2 gap-2">
      {opts.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={cx(
              "focus-stamp flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all",
              on ? "border-stamp-600 bg-stamp-100 text-ink" : "border-hairline bg-white text-ink/60 hover:border-stamp-300",
              disabled && "cursor-not-allowed opacity-40",
            )}
          >
            <svg viewBox="0 0 34 14" aria-hidden="true" className="h-3.5 w-8 shrink-0">
              {o.id === "left" ? (
                <>
                  <circle cx="6" cy="7" r="5.2" fill="currentColor" />
                  <rect x="12" y="3.4" width="20" height="7.2" rx="3.6" fill="currentColor" opacity="0.32" />
                </>
              ) : (
                <>
                  <rect x="2" y="3.4" width="20" height="7.2" rx="3.6" fill="currentColor" opacity="0.32" />
                  <circle cx="28" cy="7" r="5.2" fill="currentColor" />
                </>
              )}
            </svg>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Everything the deck currently fails or is flagged for, in one place.
 *
 * Errors block export; warnings do not. That split is the spec's, not a choice
 * of tone: a caption over the cap and an arrow on a logo are gates, while
 * cue spacing and sound density are advice a person is allowed to overrule.
 */
function IssueList({
  issues,
  beats,
  onSelect,
}: {
  issues: Issue[];
  beats: Beat[];
  onSelect: (id: string) => void;
}) {
  if (!issues.length) {
    return (
      <p className="rounded-xl border border-hairline bg-paper px-3 py-2 text-xs text-ink/60">
        Nothing outstanding. Every beat clears its dwell floor, the caption cap and the protected regions.
      </p>
    );
  }
  const index = new Map(beats.map((b, i) => [b.id, i + 1]));
  return (
    <ul className="space-y-1.5">
      {issues.map((it, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => it.beatId && onSelect(it.beatId)}
            className={cx(
              "focus-stamp flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs leading-relaxed",
              it.level === "error"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            <span className="mt-px shrink-0 font-bold tabular-nums">
              {it.beatId ? `Beat ${index.get(it.beatId) ?? "?"}` : "Deck"}
            </span>
            <span>{it.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Swatches for the eight colourways, read from the kit's own token table. */
function ColorwayStrip({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORWAY_NAMES.map((name) => {
        // Real key names, read off the kit's own COLORWAYS table rather than
        // guessed: captionAccent/captionCream do not exist there.
        const table = COLORWAYS as unknown as Record<string, Record<string, string>>;
        const cw = table[name] ?? {};
        const swatches = [cw.captionFill, cw.medallionFill, cw.arrowFill, cw.accent]
          .filter(Boolean)
          .slice(0, 4);
        return (
          <button
            key={name}
            type="button"
            onClick={() => onChange(name)}
            title={name}
            className={cx(
              "focus-stamp flex items-center gap-2 rounded-xl border px-2 py-1.5 text-[11px] font-semibold transition-colors",
              value === name ? "border-stamp-600 bg-stamp-50 text-stamp-700" : "border-hairline bg-white text-ink-soft hover:border-stamp-300",
            )}
          >
            <span className="flex overflow-hidden rounded-full ring-1 ring-hairline">
              {swatches.map((c, i) => (
                <span key={i} className="h-4 w-2.5" style={{ background: c }} />
              ))}
            </span>
            {name}
          </button>
        );
      })}
    </div>
  );
}

/** A thumbnail that fails to draw should leave a gap, never break the picker. */
function safe(fn: () => string): string | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
