"use client";

import type { Transport as Clock } from "@/lib/popkit/use-playhead";
import { HelpTip } from "../HelpTip";
import { cx } from "../ui";

/**
 * Play, pause and rewind, outside whatever is behind the beats.
 *
 * A still background has no controls of its own, so the deck needs its own set
 * regardless. They are here for video too because getting back to the start
 * meant dragging the playhead to the left edge and hoping, which is a fiddly
 * way to do the most common thing in the room.
 */
export function Transport({
  clock,
  duration,
  disabled,
}: {
  clock: Clock;
  duration: number;
  disabled?: boolean;
}) {
  const dead = disabled || duration <= 0;
  const atStart = clock.playhead <= 0.001;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={dead || (atStart && !clock.playing)}
        onClick={clock.rewind}
        aria-label="Back to the start"
        title="Back to the start"
        className={cx(
          "focus-stamp grid h-9 w-9 place-items-center rounded-full border border-hairline bg-white text-ink",
          "transition-all hover:-translate-y-0.5 hover:border-stamp-300 active:scale-95",
          "disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0",
        )}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
          <path d="M3.6 2.5h1.6v11H3.6zM13.4 3.2v9.6a.6.6 0 0 1-.92.5l-7-4.8a.6.6 0 0 1 0-1l7-4.8a.6.6 0 0 1 .92.5Z" />
        </svg>
      </button>

      <button
        type="button"
        disabled={dead}
        onClick={clock.toggle}
        aria-label={clock.playing ? "Pause" : "Play"}
        title={clock.playing ? "Pause" : "Play"}
        className={cx(
          "focus-stamp grid h-10 w-10 place-items-center rounded-full text-white",
          "bg-stamp-600 shadow-[0_6px_18px_-8px_rgba(190,30,46,0.85)]",
          "transition-all hover:-translate-y-0.5 hover:bg-stamp-700 active:scale-95",
          "disabled:cursor-not-allowed disabled:bg-ink/20 disabled:shadow-none disabled:hover:translate-y-0",
        )}
      >
        {clock.playing ? (
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
            <path d="M4.5 2.5h3v11h-3zM8.5 2.5h3v11h-3z" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4" fill="currentColor">
            <path d="M4.8 2.7a.6.6 0 0 1 .92-.5l7.5 5.3a.6.6 0 0 1 0 1l-7.5 5.3a.6.6 0 0 1-.92-.5Z" />
          </svg>
        )}
      </button>

      <span className="flex items-center gap-1.5 tabular-nums text-xs text-ink-faint">
        {clock.playhead.toFixed(2)}s / {duration.toFixed(2)}s
        <HelpTip id="pop.transport" />
      </span>
    </div>
  );
}
