"use client";

import { useEffect, useRef } from "react";

/**
 * The music bed, playing under the deck in the editor.
 *
 * The export mixes it in Web Audio, where it costs nothing and cannot fight the
 * cues. Here it is an ordinary <audio> element following the transport, because
 * the point of hearing it while editing is judging the level against the pops —
 * and that judgement is only worth anything if what plays here is what gets
 * rendered.
 *
 * Follows rather than free-runs. The deck's clock is the transport's; letting
 * the element keep its own would drift within a minute and put the bed a beat
 * off wherever the playhead was dragged to. It is corrected on every scrub and
 * whenever it slips more than a moment.
 */
const DRIFT_TOLERANCE = 0.25;

export function useMusicBed({
  file,
  gain,
  playhead,
  playing,
}: {
  file: File | null;
  gain: number;
  playhead: number;
  playing: boolean;
}) {
  const el = useRef<HTMLAudioElement | null>(null);

  /*
   * The object URL and the element are made and freed together, in one effect.
   *
   * They were two, with the URL in state — which meant an effect writing state
   * that another effect read, a cascade the compiler refuses and a frame where
   * one existed without the other. Nothing outside needs the URL, so nothing
   * outside should be told about it.
   */
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.loop = true;
    audio.preload = "auto";
    el.current = audio;
    return () => {
      audio.pause();
      audio.src = "";
      el.current = null;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    const audio = el.current;
    if (audio) audio.volume = Math.max(0, Math.min(1, gain));
  }, [gain]);

  useEffect(() => {
    const audio = el.current;
    if (!audio) return;

    /*
     * Modulo its own length, so a bed shorter than the deck lines up with where
     * the playhead is rather than with how long it has been playing.
     */
    const len = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
    const want = len ? playhead % len : playhead;
    if (Math.abs(audio.currentTime - want) > DRIFT_TOLERANCE) audio.currentTime = want;

    if (playing && audio.paused) void audio.play().catch(() => undefined);
    if (!playing && !audio.paused) audio.pause();
  }, [playhead, playing]);
}
