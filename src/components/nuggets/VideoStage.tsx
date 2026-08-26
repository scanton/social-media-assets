"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CANVASES } from "@/lib/popkit/catalogue";
import { renderBeat, safeZone } from "@/lib/popkit/preview";
import { tryGlyphDataUri } from "@/lib/popkit/glyphs";
import type { Beat, CanvasId, ProtectedRegion } from "@/lib/popkit/deck";
import { regionCoversTime, silencedByClatter } from "@/lib/popkit/rules";
import { playCue, warmCues } from "@/lib/popkit/cue-player";
import { beatScale } from "@/lib/popkit/kit/motion.js";
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
  canvas,
  beats,
  selectedId,
  onSelect,
  onMove,
  showSafeZone,
  regions,
  drawingRegion,
  onDrawRegion,
  onSelectRegion,
  selectedRegionId,
  videoRef,
  onTime,
  playhead,
  videoWidth,
}: {
  src: string | null;
  canvas: CanvasId;
  beats: Beat[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, anchor: { x: number; y: number }) => void;
  showSafeZone: boolean;
  regions: ProtectedRegion[];
  /** When true, dragging on the frame draws a region instead of moving a nugget. */
  drawingRegion: boolean;
  onDrawRegion: (r: { x: number; y: number; w: number; h: number }) => void;
  onSelectRegion: (id: string | null) => void;
  selectedRegionId: string | null;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onTime?: (t: number) => void;
  /** Beats and regions are shown only when live at this moment. */
  playhead: number;
  /** The source's own pixel width, so the stage never upscales past it. */
  videoWidth?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const dragging = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [playing, setPlaying] = useState(false);

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

  /**
   * Which beats the anti-clatter rule silences, from the kit's own function.
   *
   * The preview has to agree with the export about this or it teaches the wrong
   * thing: a cue you hear while editing and never hear in the render is worse
   * than one you never hear at all.
   */
  const silenced = useMemo(() => silencedByClatter(beats), [beats]);

  /** Last playhead the cue pass saw, so each entrance fires once. */
  const lastT = useRef(0);

  /**
   * Drive the playhead from rAF while the video plays, and sound each beat as
   * it arrives.
   *
   * `timeupdate` fires about four times a second, which is fine for a readout
   * and useless for both jobs here: a 300ms spring would arrive in two steps,
   * and a cue would land up to a quarter of a second late. The event still
   * handles seeks and the paused case; this covers playback.
   */
  /**
   * Advance to `t`, sounding any beat whose entrance was crossed getting there.
   *
   * Idempotent, because `lastT` only moves forward: calling it twice for the
   * same span sounds nothing the second time. That is what lets both the rAF
   * loop and `timeupdate` call it without doubling every cue.
   */
  const advanceTo = useCallback(
    (t: number) => {
      // Entrance only, per rule 1 of the sound pack. A backwards jump is a
      // seek, and a seek is not a performance.
      if (t >= lastT.current) {
        for (const b of beats) {
          if (b.t > lastT.current && b.t <= t && b.cue && b.cue !== "silent" && !silenced.has(b.id)) {
            playCue(b.cue);
          }
        }
      }
      lastT.current = t;
      onTime?.(t);
    },
    [beats, silenced, onTime],
  );

  /**
   * rAF while playing, for precision; `timeupdate` regardless, for survival.
   *
   * rAF is the only thing fine-grained enough for a 300ms spring and a 28ms
   * cue, and it is also the first thing a browser stops when the tab is not
   * visible. Leaning on it alone means playback in a background tab runs
   * silently. `timeupdate` keeps firing at about 4Hz there, so cues still land,
   * late but present, and the two cannot double up because `advanceTo` only
   * ever moves forward.
   */
  useEffect(() => {
    if (!playing || !videoRef?.current) return;
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) advanceTo(v.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, videoRef, advanceTo]);

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
        {src ? (
          <video
            ref={videoRef}
            src={src}
            className="absolute inset-0 h-full w-full object-contain"
            controls
            muted
            playsInline
            onTimeUpdate={(e) => advanceTo((e.target as HTMLVideoElement).currentTime)}
            onSeeked={(e) => {
              // Seeking is not playback: move the mark without sounding
              // everything scrubbed past.
              lastT.current = (e.target as HTMLVideoElement).currentTime;
              onTime?.((e.target as HTMLVideoElement).currentTime);
            }}
            onPlay={(e) => {
              // Nudged back a hair so a beat starting exactly here still counts
              // as a crossing rather than being already behind us.
              // Not clamped at zero: a beat entering at exactly 0.000 is the
              // ordinary case, and clamping made its entrance land on the mark
              // rather than after it, so the opening cue never sounded.
              lastT.current = (e.target as HTMLVideoElement).currentTime - 0.001;
              warmCues();
              setPlaying(true);
            }}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center">
            <p className="max-w-xs text-sm leading-relaxed text-white/60">
              Load a video to position nuggets over it. The canvas preset sets the frame.
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
            const pop = animating ? beatScale(playhead, beat.t, beat.out) : 1;

            const w = preview.w * scale;
            const h = preview.h * scale;
            const align = beat.align ?? "center";
            const offsetX = align === "left" ? 0 : align === "right" ? -w : -w / 2;

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
                  "pointer-events-auto absolute cursor-grab touch-none select-none active:cursor-grabbing [&>svg]:h-full [&>svg]:w-full",
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
                dangerouslySetInnerHTML={{ __html: preview.svg }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
