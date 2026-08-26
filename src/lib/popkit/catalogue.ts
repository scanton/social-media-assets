/**
 * The six catalogues the builder picks from, read out of the vendored kit
 * rather than transcribed.
 *
 * `catalog-ids.md` warns "Never describe an asset in prose when an ID exists",
 * and a hand-copied list is the same mistake one step removed — it goes stale
 * the moment the kit gains an arrow. Every list here is derived from the kit's
 * own exports, so the picker cannot offer something compose() will reject.
 */

// The vendored kit is plain ESM JavaScript with no type declarations; see
// kit.d.ts beside this file for the shapes we rely on.
import { FRAME_NAMES } from "./kit/frames.js";
import { ARROW_NAMES } from "./kit/arrows2.js";
import { CAPTION_NAMES } from "./kit/captions.js";
import { TREATMENTS } from "./kit/finish.js";
import { COLORWAYS, CANVAS } from "./kit/tokens.js";
import { OBJECT_RICH_NAMES } from "./kit/objects-rich.js";
import { CATEGORY_RICH } from "./kit/categories-rich.js";
import CATEGORY_RICH_2 from "./kit/categories-rich-2.js";

/** 18 medallion frames, catalogue page H. */
export const FRAMES: string[] = [...FRAME_NAMES];

/** 34 arrows, catalogue page J. */
export const ARROWS: string[] = [...ARROW_NAMES];

/** 12 caption shells, catalogue page K. */
export const CAPTIONS: string[] = [...CAPTION_NAMES];

/** 13 border treatments, catalogue page I. */
export const BORDERS: string[] = [...TREATMENTS];

/** 8 colourways. */
export const COLORWAY_NAMES: string[] = Object.keys(COLORWAYS);

/** The canvas presets, with their safe zones. */
export const CANVASES = CANVAS;

/**
 * 62 glyphs: 47 occasions + 15 objects.
 *
 * The merge order is load-bearing. `categories-rich-2.js` is not 36 extra
 * occasions, it is a redraw of 36 of the 47 already in `categories-rich.js`,
 * and the kit's own `glyph-resolve.js` spreads it second so the newer art wins.
 * Spreading them the other way round would leave the builder previewing a
 * different drawing than the render route produces for the same name — the
 * exact silent divergence the spec's "one shared implementation" rule is about.
 */
const OCCASION_MAP: Record<string, unknown> = { ...CATEGORY_RICH, ...CATEGORY_RICH_2 };

export const OCCASION_GLYPHS: string[] = Object.keys(OCCASION_MAP).sort();
export const OBJECT_GLYPHS: string[] = [...OBJECT_RICH_NAMES].sort();
export const GLYPHS: string[] = [...OBJECT_GLYPHS, ...OCCASION_GLYPHS];

/** Human-facing label for a catalogue key: `occ-new-home` reads as "New home". */
export function glyphLabel(name: string): string {
  const bare = name.replace(/^(occ|obj|cul|ctx)-/, "").replace(/-/g, " ");
  return bare.charAt(0).toUpperCase() + bare.slice(1);
}

/* ------------------------------- wells -------------------------------- */

import { WELL_SHAPES, WELL_TEMPLATES } from "./kit/media.js";

export interface WellTemplate {
  id: string;
  name: string;
  use: string;
  spec: Record<string, unknown>;
}

/** The ten named formats, W01..W10, straight from the kit. */
export const WELLS: WellTemplate[] = WELL_TEMPLATES as WellTemplate[];

/** The seven shapes a well can take, with their aspect ratios. */
export const WELL_SHAPE_NAMES: string[] = Object.keys(WELL_SHAPES);
