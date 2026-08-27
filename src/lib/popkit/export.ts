"use client";

import { beatToComposeOptions } from "./preview";
import type { Beat, CanvasId, Deck, DeckBeat, MedallionSide, ProtectedRegion } from "./deck";
import { validateDeck } from "./kit/deck-validate.js";
import SCHEMA from "./kit/deck.schema.json";

/**
 * The Deck JSON, and the naming contract the zip has to honour.
 *
 * A7's test is exact: unzipping produces two files sharing a basename, "no more,
 * no fewer". So the basename is derived once, here, and both entries take it —
 * rather than each being named at its own call site and drifting apart.
 */

/** Strips the extension and anything that would be awkward in a filename. */
export function exportBasename(videoName: string | null): string {
  const stem = (videoName ?? "nuggets").replace(/\.[^.]+$/, "");
  const clean = stem.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "nuggets";
}

/** The source video's own extension, so the pair really is `<name>.<ext>`. */
export function videoExtension(videoName: string | null): string {
  const m = /\.([a-zA-Z0-9]+)$/.exec(videoName ?? "");
  return m ? m[1].toLowerCase() : "mp4";
}

export function buildDeck({
  id,
  canvas,
  fps,
  beats,
  regions,
  videoName,
  duration,
  width,
  height,
}: {
  id: string;
  canvas: CanvasId;
  fps: number;
  beats: Beat[];
  regions: ProtectedRegion[];
  videoName: string | null;
  duration: number;
  width: number;
  height: number;
}): Deck {
  const base = exportBasename(videoName);
  return {
    v: 1,
    id,
    canvas,
    fps,
    video: { filename: `${base}.${videoExtension(videoName)}`, duration, width, height },
    // Beats in timeline order, so the render route's filter_complex is built in
    // the order a person sees them rather than the order they were added.
    beats: [...beats].sort((a, b) => a.t - b.t).map(toDeckBeat),
    ...(regions.length ? { protectedRegions: regions } : {}),
  };
}


/**
 * The beat as the v10 schema declares it.
 *
 * The editor models both ends of a caption as `medallions: { left, right }`,
 * because once there can be two, which end one is on is its identity rather
 * than a field. The schema predates that: it declares a single `medallion`
 * with a `side`, and the beat is `additionalProperties: false`, so the editor's
 * shape cannot simply be spread into it.
 *
 * One medallion translates cleanly. Two cannot be expressed at all — and the
 * skill's render route would read `medallion`, find nothing, and draw a bare
 * caption rather than fail. The builder gates the zip on that before ever
 * getting here; this drops to the left one only so a deck that somehow arrives
 * anyway is still valid rather than silently malformed.
 */
function toDeckBeat(beat: Beat): DeckBeat {
  const { medallions, ...rest } = beat;
  const only = medallions?.left ?? medallions?.right;
  if (!only) return rest;
  const side: MedallionSide = medallions?.left ? "left" : "right";
  return { ...rest, medallion: { side, ...only } };
}

/**
 * What the render route will pass to compose() for each beat.
 *
 * Written into the deck as a sibling of the beat rather than in place of it:
 * the beat stays the editable record, and this is the resolved call. It exists
 * so B1 never has to guess how the editor interpreted a field — round-trip
 * fidelity is Test Case 5, and the cheapest way to pass it is to not re-derive.
 */
export function resolvedComposeOptions(beat: Beat, canvas: CanvasId): Record<string, unknown> {
  return beatToComposeOptions(beat, canvas);
}


/**
 * Checks a built deck against the schema the render route will check it with.
 *
 * The same file and the same validator run on both sides, so this is not a
 * second opinion: a deck that passes here passes there. Acceptance criterion 1
 * asks that the exported JSON validate with no missing required fields, and the
 * only way to mean that is to run the validation rather than assert it.
 */
export function validateDeckAgainstSchema(deck: Deck): string[] {
  return validateDeck(deck, SCHEMA) as string[];
}
