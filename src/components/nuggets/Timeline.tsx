"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkDwell } from "@/lib/popkit/rules";
import { beatKind, type Beat } from "@/lib/popkit/deck";
import { cx } from "../ui";
import { HelpTip } from "../HelpTip";

/**
 * The beat timeline: one draggable in/out block per nugget, over a scrubber.
 *
 * The dwell floor is enforced here rather than warned about afterwards, because
 * `motion-and-feedback.md` treats a sub-floor beat as a compromise that has to
 * be chosen. Dragging stops at the floor. Getting past it takes the explicit
 * override, which records the numbers it was granted against — so trimming
 * further later re-blocks rather than inheriting the old permission.
 */

const MIN_S = 0.05;

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

export function Timeline({
  beats,
  duration,
  selectedId,
  playhead,
  onSelect,
  onChange,
  onScrub,
  onRequestOverride,
}: {
  beats: Beat[];
  duration: number;
  selectedId: string | null;
  playhead: number;
  onSelect: (id: string) => void;
  onChange: (id: string, next: Partial<Beat>) => void;
  onScrub: (t: number) => void;
  /** Fired when a drag is refused by the floor, so the UI can offer the override. */
  onRequestOverride: (id: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; edge: "in" | "out" | "move"; grab: number } | null>(null);
  const [scrubbing, setScrubbing] = useState(false);

  const toSeconds = useCallback(
    (clientX: number) => {
      const r = trackRef.current?.getBoundingClientRect();
      if (!r || !r.width) return 0;
      return Math.min(duration, Math.max(0, ((clientX - r.left) / r.width) * duration));
    },
    [duration],
  );

  /**
   * A scrub that began on the track has to survive the pointer leaving it.
   * Pointer capture normally handles that, but it is best-effort here (a stale
   * pointer id makes it throw), and the window is where a release genuinely
   * always lands. Listening there means letting go over the video, the sidebar
   * or outside the window all end the scrub rather than leaving the playhead
   * glued to the cursor.
   */
  // Held in a ref because the parent passes an inline arrow: depending on it
  // directly would tear down and re-add the window listeners on every render
  // of the whole builder, mid-drag.
  const scrubRef = useRef(onScrub);
  useEffect(() => {
    scrubRef.current = onScrub;
  });

  useEffect(() => {
    if (!scrubbing) return;
    const move = (e: PointerEvent) => scrubRef.current(toSeconds(e.clientX));
    const stop = () => setScrubbing(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [scrubbing, toSeconds]);

  const onDown = (e: React.PointerEvent, id: string, edge: "in" | "out" | "move") => {
    e.stopPropagation();
    const b = beats.find((x) => x.id === id);
    if (!b) return;
    capture(e.target as Element, e.pointerId);
    onSelect(id);
    setDrag({ id, edge, grab: toSeconds(e.clientX) - b.t });
  };

  const onMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const b = beats.find((x) => x.id === drag.id);
    if (!b) return;
    const at = toSeconds(e.clientX);
    const floor = checkDwell(b).computed;
    // An override already granted for this beat is honoured while dragging;
    // without one the floor is a wall.
    const min = b.override?.dwellFloor ? MIN_S : floor;

    if (drag.edge === "move") {
      const span = b.out - b.t;
      const t = Math.min(Math.max(0, at - drag.grab), Math.max(0, duration - span));
      onChange(b.id, { t, out: t + span });
      return;
    }
    if (drag.edge === "in") {
      const t = Math.min(at, b.out - min);
      if (b.out - at < min && at > b.t) onRequestOverride(b.id);
      onChange(b.id, { t: Math.max(0, t) });
      return;
    }
    const out = Math.max(at, b.t + min);
    if (at - b.t < min && at < b.out) onRequestOverride(b.id);
    onChange(b.id, { out: Math.min(duration, out) });
  };

  const pct = (s: number) => `${(duration ? (s / duration) * 100 : 0).toFixed(3)}%`;

  return (
    <div className="select-none">
      <div className="mb-1.5 flex items-baseline justify-between text-[11px] text-ink-faint">
        <span className="flex items-center gap-1.5 font-bold uppercase tracking-[0.09em]">
          Timeline
          <HelpTip id="pop.timeline" />
        </span>
        <span className="tabular-nums">
          {playhead.toFixed(2)}s / {duration.toFixed(2)}s
        </span>
      </div>

      <div
        ref={trackRef}
        onPointerMove={onMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onPointerDown={(e) => {
          // A beat block stops propagation, so reaching here means the track
          // itself was grabbed: jump the playhead, then follow the pointer.
          capture(e.currentTarget, e.pointerId);
          onScrub(toSeconds(e.clientX));
          setScrubbing(true);
        }}
        className={cx(
          "relative touch-none rounded-xl border border-hairline bg-paper p-2",
          scrubbing ? "cursor-grabbing" : "cursor-pointer",
        )}
        style={{ minHeight: beats.length * 34 + 26 }}
      >
        {/* one second per tick, as far as it stays legible */}
        <div className="pointer-events-none absolute inset-x-2 top-2 h-3">
          {Array.from({ length: Math.max(0, Math.floor(duration)) + 1 }, (_, i) => (
            <span
              key={i}
              className="absolute top-0 text-[9px] tabular-nums text-ink/25"
              style={{ left: pct(i), transform: "translateX(-50%)" }}
            >
              {i}
            </span>
          ))}
        </div>

        <div className="relative mt-4">
          {beats.map((b, i) => {
            const d = checkDwell(b);
            const active = b.id === selectedId;
            return (
              <div key={b.id} className="relative mb-1.5 h-7">
                <div
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => onDown(e, b.id, "move")}
                  onKeyDown={(e) => e.key === "Enter" && onSelect(b.id)}
                  className={cx(
                    "absolute top-0 flex h-7 cursor-grab items-center overflow-hidden rounded-lg border text-[10px] font-bold active:cursor-grabbing",
                    active ? "border-stamp-600 bg-stamp-100 text-ink" : "border-hairline bg-white text-ink/70",
                    d.short && "border-red-400 bg-red-50",
                    d.overridden && "border-amber-400 bg-amber-50",
                  )}
                  style={{ left: pct(b.t), width: pct(Math.max(MIN_S, b.out - b.t)) }}
                  title={`${b.text?.slice(0, 40) || beatKind(b)} — ${(b.out - b.t).toFixed(2)}s, floor ${d.computed.toFixed(2)}s`}
                >
                  <span
                    onPointerDown={(e) => onDown(e, b.id, "in")}
                    className="h-full w-2 shrink-0 cursor-ew-resize bg-black/10"
                  />
                  <span className="truncate px-1.5">{i + 1}. {b.text?.slice(0, 28) || beatKind(b)}</span>
                  <span
                    onPointerDown={(e) => onDown(e, b.id, "out")}
                    className="ml-auto h-full w-2 shrink-0 cursor-ew-resize bg-black/10"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div
          className={cx(
            "pointer-events-none absolute bottom-1 top-1 w-px bg-stamp-600",
            scrubbing && "w-0.5",
          )}
          style={{ left: `calc(0.5rem + ${pct(playhead)})` }}
        >
          {/* the grab affordance: without it a draggable playhead looks like a
              tick mark, and nobody tries to drag a tick mark */}
          <span
            className={cx(
              "absolute -left-[5px] -top-1 h-2.5 w-2.5 rounded-full bg-stamp-600 transition-transform",
              scrubbing && "scale-125",
            )}
          />
        </div>
      </div>
    </div>
  );
}
