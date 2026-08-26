"use client";

import {
  ANTI_CLATTER_MS, CAPTION_MAX_CHARS, floorForBeat,
  type Beat, type CanvasId, type ProtectedRegion,
} from "./deck";
import { CANVASES } from "./catalogue";
import { applySoundRules } from "./kit/feedback.js";

/**
 * The rules the editor enforces, as pure functions over a deck.
 *
 * Separated from the components deliberately. Every one of these is a spec
 * acceptance test — sound cues 250ms apart warn, a sub-floor dwell is blocked
 * unless overridden, an arrow tip in a protected region blocks export — and a
 * rule buried in a click handler cannot be checked without a browser.
 *
 * None of them silently corrects anything. `motion-and-feedback.md` calls a
 * sub-floor trim "a flagged compromise, not routine practice", which only means
 * something if the compromise is visible and recorded.
 */

export interface Issue {
  /** `error` blocks export. `warn` is advisory. */
  level: "error" | "warn";
  /** Which beat it belongs to, when it belongs to one. */
  beatId?: string;
  code: string;
  message: string;
}

/* ------------------------------ A5: dwell ------------------------------ */

export interface DwellCheck {
  computed: number;
  actual: number;
  /** Under the floor and not yet overridden. */
  short: boolean;
  /** Under the floor, with an override recorded that matches. */
  overridden: boolean;
}

export function checkDwell(beat: Beat): DwellCheck {
  const computed = floorForBeat(beat);
  const actual = Math.max(0, beat.out - beat.t);
  const under = actual + 1e-9 < computed;

  // An override only counts for the numbers it was recorded against. Trim the
  // beat further and the recorded compromise no longer describes it, so the
  // block comes back rather than the stale note covering the new value.
  const rec = beat.override?.dwellFloor;
  const overridden =
    under && !!rec &&
    Math.abs(rec.computed - computed) < 0.01 &&
    Math.abs(rec.actual - actual) < 0.01;

  return { computed, actual, short: under && !overridden, overridden };
}

/* --------------------------- A6: sound cues ---------------------------- */

/**
 * Which beats the anti-clatter rule will silence.
 *
 * Asks the kit rather than re-deriving it. `applySoundRules()` is the function
 * the render route runs, and `motion-and-feedback.md` says of this exact rule
 * "do not trust the edit to catch it" -- so the editor showing a *second*
 * implementation's opinion of what will be silenced would be worse than
 * showing none. Run the real one and report what it did.
 */
export function silencedByClatter(beats: Beat[]): Set<string> {
  const after = applySoundRules(
    beats.map((b) => ({ id: b.id, t: b.t, cue: b.cue ?? "silent" })),
    { minGapMs: ANTI_CLATTER_MS },
  ) as Array<{ id: string; mutedBy?: string }>;
  return new Set(after.filter((b) => b.mutedBy === "anti-clatter").map((b) => b.id));
}

/** The beat immediately before `id` that still sounds, for the warning text. */
function previousVoiced(beats: Beat[], id: string): Beat | undefined {
  const voiced = beats.filter((b) => b.cue && b.cue !== "silent").sort((a, b) => a.t - b.t);
  const i = voiced.findIndex((b) => b.id === id);
  return i > 0 ? voiced[i - 1] : undefined;
}

/** `motion-and-feedback.md`: "a dense sequence is mostly silent." */
export function voicedShare(beats: Beat[]): number {
  if (!beats.length) return 0;
  return beats.filter((b) => b.cue && b.cue !== "silent").length / beats.length;
}

/* ----------------------- A4: protected regions ------------------------ */

/**
 * `arrows.md` puts an arrow tip 8 to 16px outside its subject. The same
 * number is the clearance a protected region gets: a tip that lands on the
 * boundary is as wrong as one inside it.
 */
export const PROTECTED_CLEARANCE_PX = 16;

export interface PlacedArrow {
  /** Canvas pixels. */
  x: number;
  y: number;
}

/** True when the region is live at that moment. No range means always. */
export function regionCoversTime(r: ProtectedRegion, t: number): boolean {
  if (r.from !== undefined && t < r.from) return false;
  if (r.to !== undefined && t > r.to) return false;
  return true;
}

/**
 * Regions whose box, grown by the clearance, contains the tip.
 *
 * Normalized region coordinates against canvas-pixel arrows, so the clearance
 * is converted rather than compared across units — a 16px margin on a 1080px
 * frame is not 16px on a 393px one.
 */
export function regionsHit(
  tip: PlacedArrow,
  regions: ProtectedRegion[],
  canvas: CanvasId,
  t: number,
): ProtectedRegion[] {
  const c = CANVASES[canvas];
  return regions.filter((r) => {
    if (!regionCoversTime(r, t)) return false;
    const padX = PROTECTED_CLEARANCE_PX / c.w;
    const padY = PROTECTED_CLEARANCE_PX / c.h;
    const nx = tip.x / c.w;
    const ny = tip.y / c.h;
    return (
      nx >= r.x - padX && nx <= r.x + r.w + padX &&
      ny >= r.y - padY && ny <= r.y + r.h + padY
    );
  });
}

/* ---------------------------- the safe zone ---------------------------- */

export interface PlacedBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Which edges of the safe zone a cluster breaks, if any.
 *
 * Guidance, not a gate: the spec reserves hard blocks for the dwell floor and
 * the protected-region clearance, and a person may have a good reason to run a
 * nugget to the edge. The safe zone comes from `tokens.js`'s own CANVAS table,
 * in px per preset, so it is the kit's number and not a house rule invented
 * here.
 */
export function safeZoneBreaks(box: PlacedBox, canvas: CanvasId): string[] {
  const c = CANVASES[canvas];
  const out: string[] = [];
  if (box.x < c.safe.l) out.push("left");
  if (box.y < c.safe.t) out.push("top");
  if (box.x + box.w > c.w - c.safe.r) out.push("right");
  if (box.y + box.h > c.h - c.safe.b) out.push("bottom");
  return out;
}

/* ------------------------------ the sweep ------------------------------ */

export function collectIssues(
  beats: Beat[],
  regions: ProtectedRegion[],
  canvas: CanvasId,
  /** Arrow tips in canvas px, per beat id. From compose()'s own report. */
  tips: Map<string, PlacedArrow[]>,
  videoDuration?: number,
  /** Each beat's placed cluster box in canvas px, for the safe-zone check. */
  boxes?: Map<string, PlacedBox>,
): Issue[] {
  const out: Issue[] = [];

  for (const b of beats) {
    const chars = (b.text ?? "").length;
    if (chars > CAPTION_MAX_CHARS) {
      out.push({
        level: "error", beatId: b.id, code: "caption-length",
        message: `Copy is ${chars - CAPTION_MAX_CHARS} characters over the ${CAPTION_MAX_CHARS} cap.`,
      });
    }

    const d = checkDwell(b);
    if (d.short) {
      out.push({
        level: "error", beatId: b.id, code: "dwell-floor",
        message: `On screen for ${d.actual.toFixed(2)}s against a ${d.computed.toFixed(2)}s floor. Override it explicitly or give it more time.`,
      });
    } else if (d.overridden) {
      out.push({
        level: "warn", beatId: b.id, code: "dwell-override",
        message: `Below the ${d.computed.toFixed(2)}s floor at ${d.actual.toFixed(2)}s, recorded as a deliberate compromise.`,
      });
    }

    if (b.out <= b.t) {
      out.push({
        level: "error", beatId: b.id, code: "reversed",
        message: "Leaves before it arrives.",
      });
    }
    if (videoDuration !== undefined && b.out > videoDuration + 1e-6) {
      out.push({
        level: "error", beatId: b.id, code: "past-end",
        message: `Runs ${(b.out - videoDuration).toFixed(2)}s past the end of the video.`,
      });
    }

    const box = boxes?.get(b.id);
    if (box) {
      const breaks = safeZoneBreaks(box, canvas);
      if (breaks.length) {
        out.push({
          level: "warn", beatId: b.id, code: "safe-zone",
          message: `Runs outside the ${canvas} safe zone on the ${breaks.join(" and ")}. Platform UI can cover it there.`,
        });
      }
    }

    for (const tip of tips.get(b.id) ?? []) {
      const hit = regionsHit(tip, regions, canvas, b.t);
      for (const r of hit) {
        out.push({
          level: "error", beatId: b.id, code: "protected-region",
          message: `Arrow lands on "${r.label || "a protected region"}" — needs ${PROTECTED_CLEARANCE_PX}px clearance.`,
        });
      }
    }
  }

  for (const id of silencedByClatter(beats)) {
    const b = beats.find((x) => x.id === id);
    const prev = previousVoiced(beats, id);
    if (!b) continue;
    out.push({
      level: "warn", beatId: id, code: "anti-clatter",
      message: prev
        ? `Cue lands ${Math.round((b.t - prev.t) * 1000)}ms after the previous one, inside the ${ANTI_CLATTER_MS}ms window. The render route silences it.`
        : `Cue falls inside the ${ANTI_CLATTER_MS}ms anti-clatter window and the render route silences it.`,
    });
  }

  const share = voicedShare(beats);
  if (beats.length > 2 && share > 0.5) {
    out.push({
      level: "warn", code: "sound-density",
      message: `${Math.round(share * 100)}% of beats are voiced. A dense sequence is mostly silent.`,
    });
  }

  return out;
}
