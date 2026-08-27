"use client";

/**
 * The glass on a screen well.
 *
 * A screen composited into a photograph is an emitter pasted onto a scene that
 * has light in it, and the eye notices what is missing: the sheen of a sheet of
 * glass catching the room, and the slight darkening where the panel meets its
 * bezel. Neither is a filter effect. Both are cheap, and together they do more
 * for the illusion than anything else in this phase.
 *
 * Defined once, in the surface's own coordinates, and applied by both
 * renderers — as a CSS gradient over the element in the editor, and painted
 * onto the canvas in the export. Two separate recipes would drift.
 */

/** `gloss` is 0..1. Everything here is a fraction of that. */
export interface GlossStops {
  /** The diagonal sheen, as CSS/canvas gradient stops. */
  sheen: { at: number; alpha: number }[];
  /** How dark the very edge of the panel goes. */
  edgeAlpha: number;
}

export function glossStops(gloss: number): GlossStops {
  const g = Math.max(0, Math.min(1, gloss));
  return {
    /*
     * A band rather than a wash. A linear fade across the whole panel reads as
     * a gradient someone applied; a band with a soft edge reads as a window
     * reflected in it.
     */
    sheen: [
      { at: 0, alpha: 0 },
      { at: 0.34, alpha: 0.1 * g },
      { at: 0.46, alpha: 0.26 * g },
      { at: 0.52, alpha: 0.05 * g },
      { at: 1, alpha: 0 },
    ],
    edgeAlpha: 0.4 * g,
  };
}

/** The sheen as a CSS gradient, for the element in the editor. */
export function glossCss(gloss: number): string {
  const { sheen } = glossStops(gloss);
  const stops = sheen
    .map((s) => `rgba(255,255,255,${s.alpha.toFixed(3)}) ${(s.at * 100).toFixed(1)}%`)
    .join(", ");
  // 118deg: across the panel and slightly down, which is where a window is.
  return `linear-gradient(118deg, ${stops})`;
}

/** The darkened edge as a CSS inset shadow, in px of the element. */
export function glossEdgeCss(gloss: number, w: number, h: number): string {
  const { edgeAlpha } = glossStops(gloss);
  if (edgeAlpha <= 0) return "none";
  const spread = Math.max(2, Math.round(Math.min(w, h) * 0.06));
  return `inset 0 0 ${spread}px ${Math.round(spread / 3)}px rgba(0,0,0,${edgeAlpha.toFixed(3)})`;
}
