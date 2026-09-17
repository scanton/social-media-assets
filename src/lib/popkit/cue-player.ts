"use client";

import { createPlayer } from "./kit/feedback.js";
// Side effect: registers HeartStamp's cues into the table the player reads.
import { CUE_TABLE, cueSrc } from "./cues";

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

/*
 * Uploaded cues do not go through the kit's player.
 *
 * It builds its URL as `basePath + file`, so `"/sfx/" + "blob:http://…"`
 * resolves to nothing at all. Rather than fork the vendored file over one
 * string concatenation, anything carrying its own URL is played here, through
 * the same shape of graph — a buffer source into a gain node set from the
 * table — so a custom cue and a shipped one sound the same at the same number.
 */
let ctx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();

async function playFromUrl(cue: string, url: string): Promise<void> {
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ctx ??= new AC();
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  let buf = buffers.get(url);
  if (!buf) {
    const res = await fetch(url);
    buf = await ctx.decodeAudioData(await res.arrayBuffer());
    buffers.set(url, buf);
  }
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  g.gain.value = CUE_TABLE[cue]?.gain ?? 0.6;
  src.buffer = buf;
  src.connect(g);
  g.connect(ctx.destination);
  src.start();
}

export function playCue(cue: string | undefined): void {
  if (!cue || cue === "silent") return;
  const spec = CUE_TABLE[cue];
  if (spec?.url) {
    void playFromUrl(cue, spec.url).catch(() => {
      /* a cue that will not decode is a silent beat, not a broken editor */
    });
    return;
  }
  if (!cueSrc(cue)) return;
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
