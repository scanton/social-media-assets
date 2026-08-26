"use client";

import { createPlayer } from "./kit/feedback.js";

/**
 * Plays a sound cue in the browser.
 *
 * Wraps the kit's own `createPlayer` rather than reaching for an `<audio>` tag,
 * because the player is where the gain lives: it reads `CUES[key].gain` and sets
 * a gain node from it. The wavs are written full scale for exactly that reason,
 * so playing one raw would be loud and, worse, would put `tick` and `seal` at
 * the same level when the whole point of the table is that they are not.
 *
 * One player for the page. An AudioContext per cue would leak them, and
 * browsers cap how many a document may open.
 */
let player: ReturnType<typeof createPlayer> | null = null;

const ensure = () => (player ??= createPlayer("/sfx/"));

export function playCue(cue: string | undefined): void {
  if (!cue || cue === "silent") return;
  void ensure().play(cue, "none");
}

/**
 * Builds the player and decodes every cue up front.
 *
 * Call it from a real user gesture. Two reasons, and the second is the one that
 * bites: an AudioContext created without the document having been interacted
 * with starts suspended and stays silent, and cues during playback are fired
 * from a rAF callback, which is not a gesture. Pressing play is, so warming
 * there means the context is already running when the first beat arrives.
 *
 * Decoding ahead also keeps the first cue on time. A `tick` is 28ms; fetching
 * and decoding it on the frame it is due would miss it entirely.
 */
export function warmCues(): void {
  void ensure().preload?.();
}
