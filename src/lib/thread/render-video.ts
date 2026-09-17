"use client";

import {
  OFFLINE_FPS, canEncodeOffline, encodeDeterministic, openFrameSource, scheduleSourceAudio,
} from "@/lib/video-encode-offline";
import type { RenderProgress } from "@/lib/video-encode";
import { chromeSvgFor, paintThread } from "./paint";
import { cardStartsAt, clipLength, schedule, type Thread } from "./thread";
import { SOUND_GAIN, loadSounds, soundEvents } from "./sounds";

/**
 * Burns a thread and its card into a clip.
 *
 * Deterministic only. PopKit keeps a MediaRecorder fallback because its export
 * predates the encoder and there are decks in the wild that rely on it; this
 * tool is new, so it gets one path. A browser without a WebCodecs encoder is
 * told so rather than handed a route whose whole failure mode is producing a
 * short file — which is exactly what the creator's demo ran into, and why its
 * README tells people to use OBS.
 */

export interface ThreadRenderResult {
  blob: Blob;
  ext: string;
}

export function canRenderThread(): boolean {
  return canEncodeOffline();
}

export async function renderThread({
  thread,
  card,
  thumb,
  w,
  h,
  onProgress,
  signal,
}: {
  thread: Thread;
  /** The card animation. Its own length decides how long the clip runs. */
  card: File | Blob;
  /** The link preview's thumbnail. */
  thumb?: Blob | null;
  w: number;
  h: number;
  onProgress?: (p: RenderProgress) => void;
  signal?: AbortSignal;
}): Promise<ThreadRenderResult> {
  if (!canEncodeOffline()) {
    throw new Error("This browser has no video encoder, so the thread can't be rendered here.");
  }

  onProgress?.({ stage: "Preparing", pct: 0, realtime: false });

  const source = await openFrameSource(card, { loop: false });
  if (!source) throw new Error("That card animation could not be decoded.");

  try {
    const { threadEnds } = schedule(thread);
    const cardAt = cardStartsAt(threadEnds);
    const duration = clipLength(threadEnds, source.duration);

    /*
     * The card's own frame rate, not a fixed 30.
     *
     * Most of this clip is drawn rather than filmed, so it has no native rate
     * of its own — but the card animation does, and it is the part a viewer
     * will notice judder in. Matching it makes the card a 1:1 copy through the
     * back half and costs the drawn half nothing.
     */
    const detected = source.frameRate;
    const fps = detected && detected >= 1 && detected <= 120 ? detected : OFFLINE_FPS;
    const frames = Math.max(1, Math.round(duration * fps));

    const chrome = new Image();
    chrome.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(chromeSvgFor(w, h, thread.clock))));
    await chrome.decode().catch(() => undefined);

    let thumbImage: HTMLImageElement | null = null;
    if (thumb) {
      const url = URL.createObjectURL(thumb);
      const img = new Image();
      img.src = url;
      await img.decode().catch(() => undefined);
      URL.revokeObjectURL(url);
      thumbImage = img;
    }

    /*
     * The card's audio, offset to where the card starts.
     *
     * The thread itself is silent — there is no sound to invent for a drawn
     * conversation, and a stock message chime over somebody's card is worse
     * than nothing. So the only audio is the card's own, and it has to begin
     * where the card does rather than at zero.
     */
    const rate = 48_000;
    const octx = new OfflineAudioContext(2, Math.max(1, Math.ceil(duration * rate)), rate);
    const carrier = octx.createGain();
    carrier.connect(octx.destination);
    const delay = octx.createDelay(Math.max(1, cardAt + 1));
    delay.delayTime.value = cardAt;
    delay.connect(carrier);
    const hasCardSound = await scheduleSourceAudio(card, octx, delay, source.duration);

    /*
     * The phone's own sounds, laid in beside the card's.
     *
     * Scheduled from `soundEvents`, which reads the same schedule the painter
     * does — so a chime cannot land on a frame where its bubble has not yet
     * appeared. A Web Audio graph sums whatever is connected, so these and the
     * card's audio mix by construction and neither knows about the other.
     */
    const events = soundEvents(thread);
    let hasPhoneSound = false;
    if (events.length) {
      const buffers = await loadSounds(octx);
      for (const e of events) {
        const buf = buffers[e.name];
        if (!buf || e.at < 0 || e.at >= duration) continue;
        const src = octx.createBufferSource();
        const g = octx.createGain();
        g.gain.value = SOUND_GAIN[e.name];
        src.buffer = buf;
        src.connect(g);
        g.connect(octx.destination);
        src.start(e.at);
        hasPhoneSound = true;
      }
    }

    const audio = hasCardSound || hasPhoneSound ? await octx.startRendering() : null;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");

    const result = await encodeDeterministic({
      canvas,
      fps,
      frames,
      audio,
      paint: async (_i, t) => {
        // The card's own clock runs from where it starts, not from zero.
        const frame = t >= cardAt ? await source.at(t - cardAt) : null;
        paintThread(
          ctx,
          { thread, w, h, card: frame, thumb: thumbImage, chrome, cardSeconds: source.duration },
          t,
        );
      },
      onProgress: (done, total) =>
        onProgress?.({
          stage: "Rendering",
          pct: Math.min(99, Math.round((done / total) * 100)),
          realtime: false,
        }),
      signal,
    });

    onProgress?.({ stage: "Rendering", pct: 100, realtime: false });
    return result;
  } finally {
    await source.close();
  }
}
