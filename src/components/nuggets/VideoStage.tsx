"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CANVASES } from "@/lib/popkit/catalogue";
import { renderBeat, safeZone } from "@/lib/popkit/preview";
import { tryGlyphDataUri } from "@/lib/popkit/glyphs";
import { beatScaleFor, type Anchor, type Beat, type CanvasId, type ProtectedRegion } from "@/lib/popkit/deck";
import { quadSize, quadToCssMatrix, type Quad } from "@/lib/perspective";
import { glossCss, glossEdgeCss } from "@/lib/popkit/screen-gloss";
import type { Transport as Clock } from "@/lib/popkit/use-playhead";
import { regionCoversTime } from "@/lib/popkit/rules";
import { cx } from "../ui";

/**
 * The video with the composed nugget floating over it, draggable.
 *
 * The overlay is real compose() output scaled from canvas pixels to the video's
 * displayed size, so what someone drags is what the render route will draw. The
 * position is stored as a normalized fraction rather than pixels, which is what
 * keeps the deck resolution-independent — the same deck renders correctly
 * against a 1080p master or a 4K one.
 *
 * `align` decides which point on the cluster the anchor refers to. compose()
 * ignores the field entirely (it is not one of its options), so this is the only
 * place it means anything, and the render route has to read it the same way.
 */
/**
 * Pointer capture is a nicety — it keeps the drag alive when the pointer
 * leaves the element — and it throws if the id is not an active pointer. It
 * runs first in these handlers, so letting it throw means the drag never
 * starts. Best-effort is the correct contract for it.
 */
function capture(el: Element | null, pointerId: number) {
  try {
    el?.setPointerCapture?.(pointerId);
  } catch {
    /* the drag still works, it just stops if the pointer leaves the element */
  }
}

/**
 * The tallest the stage may be, as a share of the window.
 *
 * Enough that the timeline and the controls under it stay on screen with the
 * frame, which is the whole point; not so little that positioning a nugget
 * becomes fiddly.
 */
const STAGE_MAX_VH = 68;

export function VideoStage({
  src,
  kind,
  canvas,
  beats,
  selectedId,
  onSelect,
  onMove,
  onMoveCorner,
  showSafeZone,
  regions,
  drawingRegion,
  onDrawRegion,
  onSelectRegion,
  selectedRegionId,
  clock,
  videoWidth,
}: {
  src: string | null;
  /** A clip plays; a still just sits there and the clock free-runs. */
  kind: "video" | "image";
  canvas: CanvasId;
  beats: Beat[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, anchor: { x: number; y: number }) => void;
  /** Drag one corner of a pinned screen. Fractions of the canvas. */
  onMoveCorner: (id: string, corner: number, at: { x: number; y: number }) => void;
  showSafeZone: boolean;
  regions: ProtectedRegion[];
  /** When true, dragging on the frame draws a region instead of moving a nugget. */
  drawingRegion: boolean;
  onDrawRegion: (r: { x: number; y: number; w: number; h: number }) => void;
  onSelectRegion: (id: string | null) => void;
  selectedRegionId: string | null;
  /** The deck's clock. The stage reads it and no longer keeps its own. */
  clock: Clock;
  /** The source's own pixel width, so the stage never upscales past it. */
  videoWidth?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const dragging = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  /** Pointer position as a fraction of the frame. */
  const atFraction = (e: React.PointerEvent) => {
    const r = boxRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  // The overlay has to track the video's rendered box, which changes with the
  // window, not the video's intrinsic size.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setBox({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [src]);

  const { playhead, playing, attach } = clock;

  const preset = CANVASES[canvas];
  const scale = box.w ? box.w / preset.w : 0;

  /**
   * Whether to draw the entrance and exit springs, or hold every beat at full
   * size.
   *
   * Scrubbing counts, not just playing: watching the pop by dragging the
   * playhead is the obvious way to check it, and it did not work when this was
   * gated on playback alone.
   *
   * The `playhead > 0` half is about the very first paint. The spring starts at
   * exactly zero and the opening beat starts at exactly zero, so a freshly
   * loaded video would show an empty frame and read as broken. t=0 is the only
   * instant this is not the literal truth, and an untouched playhead is not
   * really a moment in the timeline yet.
   */
  const animating = playing || playhead > 0;

  /**
   * How wide the stage is allowed to get. Two ceilings, whichever bites first.
   *
   * The first is the source's own width: filling half a desktop with a 720p
   * clip only makes it soft, and there is nothing to see in the extra pixels.
   *
   * The second is the reason this exists. On a 9:16 canvas the width ceiling
   * alone changes nothing much: a 1080x1920 source in a 746px column is still
   * 1326px tall, and 720p portrait is still 1280, both taller than the window,
   * so the video and the timeline under it cannot be looked at together. Height
   * is the dimension that was actually in the way, so it is the one capped, in
   * vh so it tracks the window rather than a guess about it.
   */
  const capWidth = videoWidth && videoWidth > 0 ? videoWidth : preset.w;
  const stageMaxWidth = `min(${capWidth}px, calc(${STAGE_MAX_VH}vh * ${preset.w} / ${preset.h}))`;
  const safe = safeZone(canvas);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, beat: Beat) => {
      e.preventDefault();
      onSelect(beat.id);
      const r = boxRef.current?.getBoundingClientRect();
      if (!r) return;
      dragging.current = {
        id: beat.id,
        dx: e.clientX - (r.left + beat.anchor.x * r.width),
        dy: e.clientY - (r.top + beat.anchor.y * r.height),
      };
      capture(e.target as Element, e.pointerId);
    },
    [onSelect],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragging.current;
      const r = boxRef.current?.getBoundingClientRect();
      if (!d || !r) return;
      const x = Math.min(1, Math.max(0, (e.clientX - d.dx - r.left) / r.width));
      const y = Math.min(1, Math.max(0, (e.clientY - d.dy - r.top) / r.height));
      onMove(d.id, { x, y });
    },
    [onMove],
  );

  const endDrag = useCallback(() => {
    dragging.current = null;
  }, []);

  return (
    <div
      className="relative mx-auto w-full overflow-hidden rounded-2xl border border-hairline bg-ink/90"
      style={{ maxWidth: stageMaxWidth }}
    >
      <div ref={boxRef} className="relative w-full" style={{ aspectRatio: `${preset.w} / ${preset.h}` }}>
        {src && kind === "image" ? (
          /*
           * `object-cover`, and it has to be.
           *
           * Phase 2 letterboxed this to match how the video element behaves,
           * with the export cropping to cover instead — a rendered clip cannot
           * have bars baked into it. That divergence was survivable while
           * beats only floated on top. It stops being survivable the moment a
           * screen is aligned to something *in* the photograph: corners lined
           * up against a letterboxed preview would land somewhere else once
           * the render cropped. The editor now shows the crop the export will
           * make, so what is aligned is what is drawn.
           */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : src ? (
          <video
            ref={attach}
            src={src}
            className="absolute inset-0 h-full w-full object-contain"
            controls
            muted
            playsInline
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center">
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              Load a video or an image to position nuggets over it. The canvas preset
              sets the frame.
            </p>
          </div>
        )}

        {/* Safe zone from tokens.js — guidance, so it is drawn, not enforced. */}
        {showSafeZone && (
          <div
            className="pointer-events-none absolute border border-dashed border-white/35"
            style={{
              left: `${safe.left * 100}%`,
              right: `${safe.right * 100}%`,
              top: `${safe.top * 100}%`,
              bottom: `${safe.bottom * 100}%`,
            }}
          />
        )}

        {/* Protected regions. Drawn under the nuggets: they mark what is already
            in the footage, so a nugget sitting over one should look wrong. */}
        {regions.map((r) => {
          const live = regionCoversTime(r, playhead);
          return (
            <div
              key={r.id}
              onPointerDown={(e) => {
                if (drawingRegion) return;
                e.stopPropagation();
                onSelectRegion(r.id);
              }}
              className={cx(
                "absolute border-2 border-dashed",
                live ? "border-amber-400 bg-amber-400/10" : "border-white/20 bg-transparent",
                selectedRegionId === r.id && "border-solid border-amber-300 bg-amber-300/20",
                drawingRegion ? "pointer-events-none" : "cursor-pointer",
              )}
              style={{
                left: `${r.x * 100}%`, top: `${r.y * 100}%`,
                width: `${r.w * 100}%`, height: `${r.h * 100}%`,
              }}
            >
              <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-ink">
                {r.label || "protected"}{!live && " · not at this time"}
              </span>
            </div>
          );
        })}

        {draft && (
          <div
            className="pointer-events-none absolute border-2 border-amber-300 bg-amber-300/20"
            style={{
              left: `${Math.min(draft.x0, draft.x1) * 100}%`,
              top: `${Math.min(draft.y0, draft.y1) * 100}%`,
              width: `${Math.abs(draft.x1 - draft.x0) * 100}%`,
              height: `${Math.abs(draft.y1 - draft.y0) * 100}%`,
            }}
          />
        )}

        {/* Catches the drag while a region is being drawn. Only mounted then, so
            it never steals a pointer from the video controls or a nugget. */}
        {drawingRegion && (
          <div
            className="absolute inset-0 cursor-crosshair touch-none"
            onPointerDown={(e) => {
              capture(e.target as Element, e.pointerId);
              const p = atFraction(e);
              setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
            }}
            onPointerMove={(e) => {
              if (!draft) return;
              const p = atFraction(e);
              setDraft({ ...draft, x1: p.x, y1: p.y });
            }}
            onPointerUp={() => {
              if (!draft) return;
              const x = Math.min(draft.x0, draft.x1);
              const y = Math.min(draft.y0, draft.y1);
              const w = Math.abs(draft.x1 - draft.x0);
              const h = Math.abs(draft.y1 - draft.y0);
              setDraft(null);
              // A stray click is not a region.
              if (w > 0.01 && h > 0.01) onDrawRegion({ x, y, w, h });
            }}
          />
        )}

        {/* The nuggets themselves.

            `pointer-events-none` on the layer, `auto` on each nugget: this box
            covers the whole frame including the video's own control bar along
            the bottom, so as a hit target it swallowed every press on play and
            the scrubber. Dragging still works because pointer capture routes
            moves to the nugget itself, and those events bubble back up to these
            handlers regardless of the layer not being hittable. */}
        <div
          className="pointer-events-none absolute inset-0"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {beats.map((beat) => {
            const preview = renderBeat(beat, canvas, (n) => tryGlyphDataUri(n, 512));
            if (!preview || !scale) return null;
            // Off-window beats stay mounted but dim, so a nugget can still be
            // selected and positioned from any point on the timeline.
            const live = playhead >= beat.t && playhead <= beat.out;
            // The same curve the render route runs, off the same module, so the
            // pop previewed here is the pop that gets exported.
            const pop = animating ? beatScaleFor(beat, playhead) : 1;

            const w = preview.w * scale;
            const h = preview.h * scale;
            const align = beat.align ?? "center";
            const offsetX = align === "left" ? 0 : align === "right" ? -w : -w / 2;

            /*
             * A pinned screen is placed by its four corners and nothing else.
             *
             * anchor/size/rotate/pop all describe a thing floating over the
             * frame; this one is pretending to be a surface inside it, and the
             * quad already says where that surface is. Running it through the
             * ordinary path would fight the transform.
             */
            if (beat.well?.bare && beat.well.quad && beat.well.src) {
              return (
                <PinnedScreen
                  key={beat.id}
                  beat={beat}
                  quad={beat.well.quad}
                  box={box}
                  canvasW={preset.w}
                  live={live}
                  selected={selectedId === beat.id}
                  playing={playing}
                  at={playhead - beat.t}
                  interactive={!drawingRegion}
                  onSelect={() => onSelect(beat.id)}
                  onCorner={(i, p) => onMoveCorner(beat.id, i, p)}
                />
              );
            }

            return (
              <div
                key={beat.id}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onPointerDown(e, beat)}
                className={cx(
                  // compose() writes explicit width/height onto the SVG, so
                  // without this it renders at its intrinsic canvas size and
                  // spills far outside the wrapper we just measured for it.
                  "pointer-events-auto absolute cursor-grab touch-none select-none active:cursor-grabbing [&_svg]:h-full [&_svg]:w-full",
                  selectedId === beat.id && "outline-2 outline-offset-4 outline-dashed outline-stamp-400",
                  !live && "opacity-25",
                  drawingRegion && "pointer-events-none",
                )}
                style={{
                  left: `${beat.anchor.x * 100}%`,
                  top: `${beat.anchor.y * 100}%`,
                  width: w,
                  height: h,
                  transform:
                    `translate(${offsetX}px, ${-h / 2}px) rotate(${beat.rotate ?? 0}deg)` +
                    (pop === 1 ? "" : ` scale(${pop.toFixed(4)})`),
                }}
              >
                {/* Under the SVG, showing through the aperture the frame masks
                    out. Same arrangement the render route composites in. */}
                {preview.aperture && beat.well?.src && (
                  <>
                    <WellMedia
                      src={beat.well.src}
                      kind={beat.well.kind}
                      rect={preview.aperture}
                      scale={w / preview.w}
                      playing={playing && live}
                      at={playhead - beat.t}
                    />
                    {!!beat.well.gloss && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute"
                        style={{
                          left: preview.aperture.x * (w / preview.w),
                          top: preview.aperture.y * (w / preview.w),
                          width: preview.aperture.w * (w / preview.w),
                          height: preview.aperture.h * (w / preview.w),
                          borderRadius: preview.aperture.radius * (w / preview.w),
                          backgroundImage: glossCss(beat.well.gloss),
                          boxShadow: glossEdgeCss(
                            beat.well.gloss,
                            preview.aperture.w * (w / preview.w),
                            preview.aperture.h * (w / preview.w),
                          ),
                        }}
                      />
                    )}
                  </>
                )}
                {/* A screen with nothing in it draws nothing at all, which
                    reads as broken rather than as empty. */}
                {beat.well?.bare && !beat.well.src && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 grid place-items-center rounded border-2 border-dashed border-white/50 bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/70"
                  >
                    Screen
                  </span>
                )}
                <span
                  className="absolute inset-0"
                  dangerouslySetInnerHTML={{ __html: preview.svg }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * The clip inside a media well, behind the frame that masks a hole for it.
 *
 * Its own component so the element can be driven by a ref without the stage
 * re-rendering on every frame of playback, and so React keeps one <video> per
 * beat across renders rather than tearing it down whenever the deck changes.
 *
 * WHY IT IS NOT SIMPLY LEFT PLAYING
 * The render route loops these for the length of the export and takes whatever
 * frame is up, which is fine when nobody is watching. Here somebody is: a clip
 * looping under a paused deck reads as a bug, and scrubbing the timeline should
 * move the clip too or the preview stops being a preview. So it follows the
 * playhead when parked and runs on its own only while the deck actually plays.
 */
function WellMedia({
  src,
  kind,
  rect,
  scale,
  playing,
  at,
}: {
  src: string;
  kind: "image" | "video";
  /** The aperture, in canvas px. */
  rect: { x: number; y: number; w: number; h: number; radius: number };
  /** Canvas px to screen px. */
  scale: number;
  playing: boolean;
  /** Seconds since the beat opened. */
  at: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v || kind !== "video") return;
    if (playing) {
      void v.play().catch(() => {
        /* autoplay refused: the poster frame stays, which is not nothing */
      });
      return;
    }
    v.pause();
    // Only once there is a duration to wrap against, or seeking is a no-op and
    // the clip sits on frame 0 for the whole beat.
    if (v.duration && Number.isFinite(v.duration)) {
      const want = Math.max(0, at) % v.duration;
      if (Math.abs(v.currentTime - want) > 0.04) v.currentTime = want;
    }
  }, [playing, at, kind]);

  const box = {
    left: rect.x * scale,
    top: rect.y * scale,
    width: rect.w * scale,
    height: rect.h * scale,
    borderRadius: rect.radius * scale,
  };

  // `object-cover` on both: the well decides its own shape, and media that
  // does not match is cropped rather than squashed to fit.
  if (kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="pointer-events-none absolute object-cover" style={box} />;
  }

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="auto"
      className="pointer-events-none absolute object-cover"
      style={box}
    />
  );
}


/* ========================= the pinned screen ========================= */

const CORNER_LABELS = ["Top left", "Top right", "Bottom right", "Bottom left"];

/**
 * A bare well corner-pinned into the scene.
 *
 * The media is laid out as an ordinary `width x height` box and then mapped
 * onto the quad by a CSS matrix3d built from the same homography the render
 * route warps with — so the editor is not approximating the export, it is
 * running the identical map through a different renderer.
 *
 * `border-radius` is applied before the transform, which is exactly right: the
 * corners curve in the surface's own space and come out foreshortened with it,
 * the way a real screen's would.
 */
function PinnedScreen({
  beat,
  quad,
  box,
  canvasW,
  live,
  selected,
  playing,
  at,
  interactive,
  onSelect,
  onCorner,
}: {
  beat: Beat;
  quad: [Anchor, Anchor, Anchor, Anchor];
  /** The stage's pixel size, which the fractions are resolved against. */
  box: { w: number; h: number };
  /** Canvas width, so a radius given in canvas px lands at the right size. */
  canvasW: number;
  live: boolean;
  selected: boolean;
  playing: boolean;
  at: number;
  interactive: boolean;
  onSelect: () => void;
  onCorner: (corner: number, at: { x: number; y: number }) => void;
}) {
  const well = beat.well!;
  const px: Quad = [0, 1, 2, 3].map((i) => ({
    x: quad[i].x * box.w,
    y: quad[i].y * box.h,
  })) as Quad;

  /*
   * The untransformed box is sized from the quad rather than fixed, so the
   * media is rasterised at roughly the resolution it will be seen at instead
   * of being scaled up from something small and going soft.
   */
  const { w: qw, h: qh } = quadSize(px);
  const w = Math.max(2, Math.round(qw));
  const h = Math.max(2, Math.round(qh));
  const matrix = quadToCssMatrix(px, w, h);
  const radiusPx = ((well.radius ?? 0) * box.w) / Math.max(1, canvasW);

  const drag = useRef<number | null>(null);
  /** The whole-pin drag: where it started, and the quad it started from. */
  const body = useRef<{ x: number; y: number; from: Anchor[] } | null>(null);

  return (
    <>
      <div
        onPointerDown={(e) => {
          if (!interactive) return;
          onSelect();
          // Dragging the surface moves the whole pin. Dragging four corners to
          // relocate something without reshaping it is not a way to work.
          const host = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
          const r = host?.getBoundingClientRect();
          if (!r) return;
          capture(e.currentTarget as Element, e.pointerId);
          body.current = {
            x: (e.clientX - r.left) / r.width,
            y: (e.clientY - r.top) / r.height,
            from: quad.map((q) => ({ ...q })),
          };
        }}
        onPointerMove={(e) => {
          const b = body.current;
          if (!b) return;
          const host = (e.currentTarget as HTMLElement).offsetParent as HTMLElement | null;
          const r = host?.getBoundingClientRect();
          if (!r) return;
          const dx = (e.clientX - r.left) / r.width - b.x;
          const dy = (e.clientY - r.top) / r.height - b.y;
          b.from.forEach((p, i) => onCorner(i, { x: p.x + dx, y: p.y + dy }));
        }}
        onPointerUp={() => (body.current = null)}
        onPointerCancel={() => (body.current = null)}
        className={cx(
          "absolute left-0 top-0 origin-top-left touch-none",
          interactive && "cursor-grab active:cursor-grabbing",
          !live && "opacity-25",
        )}
        style={{ width: w, height: h, transform: matrix, transformOrigin: "0 0" }}
      >
        <WellMedia
          src={well.src!}
          kind={well.kind}
          rect={{ x: 0, y: 0, w, h, radius: radiusPx }}
          scale={1}
          playing={playing && live}
          at={at}
        />
        {/* Inside the transformed box, so the sheen foreshortens with the
            surface rather than lying flat across the frame. */}
        {!!well.gloss && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              borderRadius: radiusPx,
              backgroundImage: glossCss(well.gloss),
              boxShadow: glossEdgeCss(well.gloss, w, h),
            }}
          />
        )}
      </div>

      {/* Handles ride above the surface rather than on it, so a corner dragged
          to the very edge of the frame is still catchable. */}
      {selected && interactive &&
        px.map((p, i) => (
          <button
            key={i}
            type="button"
            aria-label={`${CORNER_LABELS[i]} corner`}
            onPointerDown={(e) => {
              e.stopPropagation();
              capture(e.currentTarget, e.pointerId);
              drag.current = i;
            }}
            onPointerMove={(e) => {
              if (drag.current !== i) return;
              const host = e.currentTarget.offsetParent as HTMLElement | null;
              const r = host?.getBoundingClientRect();
              if (!r) return;
              onCorner(i, {
                x: Math.min(1.5, Math.max(-0.5, (e.clientX - r.left) / r.width)),
                y: Math.min(1.5, Math.max(-0.5, (e.clientY - r.top) / r.height)),
              });
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            className="pointer-events-auto absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-white bg-stamp-600 shadow-[0_2px_8px_rgba(0,0,0,0.5)] active:cursor-grabbing"
            style={{ left: p.x, top: p.y }}
          />
        ))}
    </>
  );
}
