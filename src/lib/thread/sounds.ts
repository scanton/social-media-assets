"use client";

import { BEATS, schedule, type Thread } from "./thread";

/**
 * The noises a phone makes while a conversation happens.
 *
 * Three of them, and the third had to be invented: the two message sounds are
 * the real ones, and there is no stock "somebody tapped a link" sample — so the
 * tap is a 90ms synthesised tock, built to read as UI rather than as a beep.
 *
 * All three were trimmed to their transient on the way in, for the reason
 * written up on the PopKit cue table: a buffer started at the moment of the
 * event with 130ms of silence in front of it lands four frames late, which
 * reads as the sound belonging to something else.
 */

export const SOUND_FILES = {
  send: "/sfx/thread-send.wav",
  receive: "/sfx/thread-receive.wav",
  tap: "/sfx/thread-tap.wav",
} as const;

export type SoundName = keyof typeof SOUND_FILES;

/**
 * Levels, relative to each other rather than to anything absolute.
 *
 * The message sounds are the conversation and carry it; the tap is punctuation
 * and sits under them. Both message files peak around -4dB on disk, so these
 * are close to their natural loudness — the point of the table is that they
 * stay in proportion when one is swapped.
 */
export const SOUND_GAIN: Record<SoundName, number> = {
  send: 0.55,
  receive: 0.6,
  tap: 0.4,
};

export interface SoundEvent {
  at: number;
  name: SoundName;
}

/**
 * Every sound the clip makes, and when.
 *
 * Derived from the same schedule that decides when the bubbles land, so the
 * sound cannot drift from the picture — there is one answer to "when does this
 * message arrive" and both the painter and the mixer ask it.
 *
 * Messages already on screen at t=0 make no sound. They arrived before the clip
 * started; playing their chimes at the top would say the opposite.
 */
export function soundEvents(thread: Thread): SoundEvent[] {
  if (!thread.sound) return [];
  const { items, threadEnds } = schedule(thread);
  const out: SoundEvent[] = [];

  for (const s of items) {
    if (s.at < 0) continue;
    // A divider is a date stamp, not a message, and nothing arrives with it.
    if (s.message.kind === "divider") continue;
    out.push({ at: s.at, name: s.message.from === "me" ? "send" : "receive" });
  }

  // The tap, on the press rather than on the sheet — a phone clicks under your
  // finger, not when the page has finished opening.
  out.push({ at: threadEnds + BEATS.dwell, name: "tap" });
  return out.sort((a, b) => a.at - b.at);
}

/** Decodes the three files into whichever context is going to play them. */
export async function loadSounds(
  ctx: BaseAudioContext,
): Promise<Partial<Record<SoundName, AudioBuffer>>> {
  const out: Partial<Record<SoundName, AudioBuffer>> = {};
  await Promise.all(
    (Object.keys(SOUND_FILES) as SoundName[]).map(async (name) => {
      try {
        const res = await fetch(SOUND_FILES[name]);
        if (!res.ok) return;
        out[name] = await ctx.decodeAudioData(await res.arrayBuffer());
      } catch {
        // A missing file costs that one sound, never the render.
      }
    }),
  );
  return out;
}
