"use client";

import { objectSvg } from "./kit/objects-rich.js";
import { OBJECTS } from "./kit/objects-rich.js";
import { CATEGORY_RICH } from "./kit/categories-rich.js";
import CATEGORY_RICH_2 from "./kit/categories-rich-2.js";
import STAMPY from "./stampy.json";

/**
 * Resolves one of the 62 glyph names to a data URI.
 *
 * This deliberately does NOT use the kit's own `glyph-resolve.js`. That module
 * imports `hands.js`, which reads PNGs off disk with `fs` — it would drag Node
 * into the browser bundle to serve gestures this feature never offers. What it
 * does do is copy that module's two load-bearing behaviours exactly:
 *
 *   the merge order — categories-rich-2 spread second, so its redraws of 36 of
 *   the 47 occasions win, matching what the render route will draw;
 *
 *   the loud failure — an unknown name throws rather than falling back. The kit
 *   retired its monoline set precisely because a silent fallback shipped the
 *   wrong drawing in the skill's first external test.
 */

const RICH: Record<string, unknown> = { ...CATEGORY_RICH, ...CATEGORY_RICH_2 };

// Merge the occasions into the object registry once, as glyph-resolve.js does:
// the two share a part-list shape and objectSvg() renders either. The cast is
// because the kit infers OBJECTS as a literal of its fifteen objects, and this
// is precisely the mutation that widens it.
const registry = OBJECTS as unknown as Record<string, unknown>;
for (const [name, def] of Object.entries(RICH)) {
  if (!registry[name]) registry[name] = def;
}

const cache = new Map<string, string>();

/** Browser-safe base64: the kit's own resolver uses Buffer, which is Node-only. */
function toDataUri(svg: string): string {
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
}

export function glyphDataUri(name: string, size = 512): string {
  const key = `${name}@${size}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const svg = objectSvg(name, { size });
  const uri = toDataUri(svg);
  cache.set(key, uri);
  return uri;
}

/** Returns undefined instead of throwing, for a picker thumbnail that may lag a rename. */
export function tryGlyphDataUri(name: string, size = 512): string | undefined {
  try {
    return glyphDataUri(name, size);
  } catch {
    return undefined;
  }
}

/* ---------------------------------------------------------------
   STAMPY

   Not generated. glyphs.md: "Stampy is artwork, not code… Never
   rebuild the character out of paths, never generate a face, and
   never substitute a star, an emoji or a generic head when a name
   does not resolve." So these are the real PNGs, copied to public/
   by scripts/sync-popkit.mjs and served.

   Deck names carry a `stampy-` prefix so one `glyph` field can hold
   an object, an occasion or an expression without three of them
   colliding; the kit's own names are bare.
   --------------------------------------------------------------- */

export const STAMPY_PREFIX = "stampy-";
export const STAMPY_NAMES: string[] = STAMPY.names;
export const STAMPY_USE: Record<string, string> = STAMPY.use;

export function isStampy(glyph: string | undefined): boolean {
  return !!glyph?.startsWith(STAMPY_PREFIX);
}

/** Deck name to the served PNG. Undefined for a name the pack does not have. */
export function stampyUrl(glyph: string): string | undefined {
  const name = glyph.slice(STAMPY_PREFIX.length);
  return STAMPY_NAMES.includes(name) ? `/stampy/${name}-512.png` : undefined;
}

/**
 * How much bigger this expression must be drawn so its head matches the rest
 * of the set.
 *
 * Every face carries its own measured head fraction, because the props do what
 * props should: the wizard hat, the explosion and the melt puddle push the
 * canvas out, so the head is a smaller share of a bigger picture. Ignoring this
 * and fitting each PNG to the box instead renders the wizard's head at two
 * thirds the size of grief's — 1.529 against 0.920.
 */
export function stampyHeadScale(glyph: string): number {
  return STAMPY.headScale[glyph.slice(STAMPY_PREFIX.length) as keyof typeof STAMPY.headScale] ?? 1;
}
