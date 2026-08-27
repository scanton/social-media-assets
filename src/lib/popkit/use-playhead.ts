"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeTicker } from "@/lib/video-encode";
import { playCue, warmCues } from "./cue-player";
import { silencedByClatter } from "./rules";
import type { Beat } from "./deck";

/**
 * The deck's clock.
 *
 * WHY THE APP OWNS TIME NOW
 * The playhead used to *be* the <video> element's currentTime, which worked
 * only because there was always a video. A still background has no clock at
 * all, so time has to exist independently of whatever is behind the beats. The
 * element becomes one possible source rather than the source.
 *
 * WHILE PLAYING A VIDEO, THE ELEMENT STILL LEADS
 * Not because it has to, but because it is the thing making sound: a clock
 * that free-ran alongside it would drift, and cues would slide off the frames
 * they belong to. So playback reads the element, and everything else — seeking,
 * rewinding, the transport buttons — drives it.
 *
 * CUES LIVE HERE TOO
 * They are a function of how time moved rather than of what time it is: an
 * entrance sounds when the playhead *crosses* it going forward, and never when
 * you scrub back over it. That distinction is only knowable at the clock, and
 * having it anywhere else is what made the old version need two code paths that
 * had to agree.
 */

export interface Transport {
  /**
   * Attach to the background video: `<video ref={clock.attach} />`.
   *
   * A callback ref rather than a ref object, and the element is held in state
   * rather than in a ref. The clock has to write `currentTime` to seek, which
   * is not something it may do to a ref handed in from outside — and holding
   * the element in state is what makes the listener effect below rebind when
   * the source actually changes, instead of when some proxy for it does.
   */
  attach: (el: HTMLVideoElement | null) => void;
  /** Seconds. */
  playhead: number;
  playing: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Move the mark without sounding everything scrubbed past. */
  seek: (t: number) => void;
  /** Back to the top. Stays paused if paused, keeps playing if playing. */
  rewind: () => void;
}

export function usePlayhead({
  duration,
  beats,
}: {
  duration: number;
  beats: Beat[];
}): Transport {
  /*
   * The element twice, deliberately.
   *
   * `mediaEl` is what the callbacks write to — seeking is `currentTime = t`,
   * and a DOM node is the one thing here that genuinely is mutable. A ref is
   * the only place the compiler allows that: props and state are both
   * off-limits to write through.
   *
   * `media` is the same element as state, and exists only so the effects below
   * re-run when a different source is attached. Reading a ref cannot wake an
   * effect, and the listeners have to move when the element does.
   *
   * Both are null whenever the background is a still, which is the
   * free-running case.
   */
  const mediaEl = useRef<HTMLVideoElement | null>(null);
  const [media, setMedia] = useState<HTMLVideoElement | null>(null);
  const attach = useCallback((el: HTMLVideoElement | null) => {
    mediaEl.current = el;
    setMedia(el);
  }, []);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);

  /**
   * Which beats the anti-clatter rule silences, from the kit's own function.
   *
   * The preview has to agree with the export about this or it teaches the wrong
   * thing: a cue you hear while editing and never hear in the render is worse
   * than one you never hear at all.
   */
  const silenced = useMemo(() => silencedByClatter(beats), [beats]);

  /** Last playhead the cue pass saw, so each entrance fires once. */
  const lastT = useRef(0);

  /**
   * Advance to `t`, sounding any beat whose entrance was crossed getting there.
   *
   * Idempotent, because `lastT` only moves forward: calling it twice for the
   * same span sounds nothing the second time. That is what lets both the rAF
   * loop and `timeupdate` call it without doubling every cue.
   */
  const advanceTo = useCallback(
    (t: number) => {
      // Entrance only, per rule 1 of the sound pack. A backwards jump is a
      // seek, and a seek is not a performance.
      if (t >= lastT.current) {
        for (const b of beats) {
          if (b.t > lastT.current && b.t <= t && b.cue && b.cue !== "silent" && !silenced.has(b.id)) {
            playCue(b.cue);
          }
        }
      }
      lastT.current = t;
      setPlayhead(t);
    },
    [beats, silenced],
  );

  /** Put the mark somewhere without performing anything on the way. */
  const mark = useCallback((t: number) => {
    lastT.current = t;
    setPlayhead(t);
  }, []);

  const seek = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(duration || 0, t));
      const el = mediaEl.current;
      if (el) el.currentTime = clamped;
      mark(clamped);
    },
    [duration, mark],
  );

  const play = useCallback(() => {
    if (!duration) return;
    // A play at the very end would otherwise sit there doing nothing.
    const atEnd = playhead >= duration - 0.02;
    const from = atEnd ? 0 : playhead;
    /*
     * Nudged back a hair so a beat starting exactly here still counts as a
     * crossing rather than being already behind us. Not clamped at zero: a beat
     * entering at exactly 0.000 is the ordinary case, and clamping made its
     * entrance land on the mark rather than after it, so the opening cue never
     * sounded.
     */
    lastT.current = from - 0.001;
    // Must ride the gesture: an AudioContext built without one starts suspended
    // and stays silent, and a cue fired from rAF is not a gesture.
    warmCues();

    const el = mediaEl.current;
    if (el) {
      if (atEnd) el.currentTime = 0;
      void el.play().catch(() => setPlaying(false));
      // `playing` follows the element's own event, so the two cannot disagree.
      return;
    }
    if (atEnd) setPlayhead(0);
    setPlaying(true);
  }, [duration, playhead]);

  const pause = useCallback(() => {
    const el = mediaEl.current;
    if (el) {
      el.pause();
      return;
    }
    setPlaying(false);
  }, []);

  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play]);

  const rewind = useCallback(() => {
    const el = mediaEl.current;
    const wasPlaying = playing;
    seek(0);
    // Deliberately does not stop: rewinding mid-play is "watch it again".
    if (!el || !wasPlaying) return;
    /*
     * Resumed on `seeked`, not here.
     *
     * Some browsers pause on a backward seek, and the pause lands *after* the
     * seek resolves — so a play() issued synchronously on this line is undone a
     * moment later and the deck stops instead of starting over. Waiting for the
     * seek to finish is a no-op where the browser kept playing anyway.
     */
    el.addEventListener("seeked", () => void el.play().catch(() => undefined), { once: true });
  }, [seek, playing]);

  /*
   * The element's own events are the truth about whether it is playing — it can
   * stop for reasons we did not ask for, and a flag we set optimistically would
   * be wrong until the next render.
   */
  useEffect(() => {
    const el = media;
    if (!el) return;
    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);
    /*
     * ~4Hz, which is useless for a 300ms spring and a 28ms cue but keeps
     * working when the tab is hidden and rAF stops. The two cannot double a cue
     * because advanceTo only ever moves forward.
     */
    const onTime = () => advanceTo(el.currentTime);
    const onSeeked = () => mark(el.currentTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onStop);
    el.addEventListener("ended", onStop);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onSeeked);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onStop);
      el.removeEventListener("ended", onStop);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onSeeked);
    };
  }, [media, advanceTo, mark]);

  /**
   * Playback. Reads the element when there is one, and counts when there is not.
   *
   * On the kit's worker ticker rather than rAF, for the same reason the export
   * is: a browser stops rAF in a hidden tab, and a still-backed deck has no
   * other clock to fall back on — a video at least keeps getting `timeupdate`.
   * Without this, switching tabs mid-playback froze a still deck silently and
   * it simply never reached its own end.
   */
  useEffect(() => {
    if (!playing) return;
    let prev = performance.now();
    const ticker = makeTicker();

    ticker.start(() => {
      if (media) {
        advanceTo(media.currentTime);
        return;
      }
      const now = performance.now();
      const next = lastT.current + (now - prev) / 1000;
      prev = now;
      if (next >= duration) {
        advanceTo(duration);
        setPlaying(false);
        return;
      }
      advanceTo(next);
    });
    return () => ticker.stop();
  }, [playing, duration, advanceTo, media]);

  /* A shorter deck than the mark is a deck the mark is no longer inside. */
  useEffect(() => {
    if (duration > 0 && lastT.current > duration) mark(duration);
  }, [duration, mark]);

  return { attach, playhead, playing, play, pause, toggle, seek, rewind };
}
