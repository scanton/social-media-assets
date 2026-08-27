"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HELP, type HelpEntry } from "@/lib/help";
import { cx } from "./cx";

/**
 * The little "?" beside a title.
 *
 * WHY CLICK AND NOT HOVER
 * Hover tips cannot be read on a touchscreen, cannot be reached from the
 * keyboard without also being a focus trap, and vanish the moment you move the
 * pointer toward the thing you were trying to read. These hold open until
 * dismissed, so the list of terms inside them is actually usable.
 *
 * WHY A PORTAL
 * Several of these live inside scrolling columns — PopKit's picker column, the
 * output panels — and a popover inside `overflow: hidden` gets clipped. It is
 * rendered into <body> and positioned from the trigger's rect instead, then
 * repositioned while the page scrolls so it stays pinned to its "?".
 */

/**
 * Where the panel is portaled to.
 *
 * Our root, not `document.body`. Every style we ship is scoped to that
 * element, so a panel portaled past it arrives with no tokens, no reset and no
 * utilities — a plain white rectangle of serif text. It still escapes the
 * scrolling columns it needs to escape, because those are far below the root.
 */
const studioRoot = () =>
  document.getElementById("heartstamp-studio") ?? document.body;

const GAP = 8;
const WIDTH = 320;
const MARGIN = 12;

/** Where the panel goes, given where the button is. */
function place(rect: DOMRect, panelHeight: number) {
  // Narrower than the panel on a small phone, so the width gives way first —
  // clamping position alone would push the left edge off-screen.
  const width = Math.min(WIDTH, Math.max(200, window.innerWidth - MARGIN * 2));
  const rightmost = Math.max(MARGIN, window.innerWidth - width - MARGIN);
  const left = Math.min(Math.max(MARGIN, rect.left + rect.width / 2 - width / 2), rightmost);

  /*
   * A glossary of thirteen border treatments is taller than half a laptop
   * screen, so "flip it above instead" is not always enough. Pick the roomier
   * side and cap the panel to what that side actually has — it scrolls inside
   * rather than covering the control it is explaining.
   */
  const roomBelow = window.innerHeight - rect.bottom - GAP - MARGIN;
  const roomAbove = rect.top - GAP - MARGIN;
  const up = panelHeight > roomBelow && roomAbove > roomBelow;
  const room = Math.max(120, up ? roomAbove : roomBelow);

  return {
    left,
    width,
    maxHeight: room,
    top: up ? Math.max(MARGIN, rect.top - GAP - Math.min(panelHeight, room)) : rect.bottom + GAP,
    // Which way the panel opens, so the animation grows from the button.
    up,
  };
}

export function HelpTip({
  /** Key into the copy registry. An unknown key renders nothing. */
  id,
  className,
}: {
  id: string;
  className?: string;
}) {
  const entry: HelpEntry | undefined = HELP[id];
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
    up: boolean;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const reposition = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    // scrollHeight, not offsetHeight: once capped, the box is shorter than
    // its content and measuring the box would keep it capped forever.
    setPos(place(rect, panelRef.current?.scrollHeight ?? 260));
  }, []);

  useEffect(() => {
    if (!open) return;
    // Measure once the panel is in the DOM, so a tall one flips upward.
    reposition();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    // Capture, so it also follows columns that scroll inside themselves.
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, reposition]);

  if (!entry) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        // Prefixed rather than inflected: several titles are already phrases
        // ("What are you making"), and "What is What are you making?" is nonsense.
        aria-label={`Explain: ${entry.title}`}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "focus-stamp grid h-4 w-4 shrink-0 place-items-center rounded-full border text-[10px] font-bold leading-none transition-all duration-200",
          open
            ? "border-stamp-600 bg-stamp-600 text-white"
            : "border-ink/20 bg-white text-ink-faint hover:border-stamp-300 hover:bg-stamp-50 hover:text-stamp-600",
          className,
        )}
      >
        <span aria-hidden="true">?</span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={entry.title}
            style={{
              position: "fixed",
              left: pos?.left ?? -9999,
              top: pos?.top ?? -9999,
              width: pos?.width ?? WIDTH,
              maxHeight: pos?.maxHeight,
              // Hidden until placed, or it flashes at the wrong spot first.
              visibility: pos ? "visible" : "hidden",
            }}
            className={cx(
              "z-[60] overflow-y-auto overscroll-contain rounded-2xl border border-hairline bg-white p-4 text-left shadow-[0_24px_60px_-18px_rgba(14,14,16,0.35)] motion-safe:animate-pop-in",
              pos?.up ? "origin-bottom" : "origin-top",
            )}
          >
            <div className="flex items-start gap-2">
              <h4 className="min-w-0 flex-1 font-display text-sm font-bold leading-snug text-ink">
                {entry.title}
              </h4>
              <VideoLink video={entry.video} title={entry.title} />
            </div>

            <p className="mt-2 text-xs leading-relaxed text-ink-soft">{entry.body}</p>

            {entry.terms && entry.terms.length > 0 && (
              <ul className="mt-3 space-y-1.5 border-t border-hairline pt-3">
                {entry.terms.map((t) => (
                  <li key={t.term} className="flex gap-2 text-xs leading-relaxed">
                    <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-stamp-400" />
                    <span className="min-w-0">
                      <span className="font-bold text-ink">{t.term}</span>
                      <span className="text-ink-soft"> — {t.what}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          studioRoot(),
        )}
    </>
  );
}

/**
 * The walkthrough link.
 *
 * Kept visible before the videos exist so the slot is obvious and filling it
 * later is one line in the registry — but plainly dimmed and inert, rather than
 * a live-looking control that does nothing.
 */
function VideoLink({ video, title }: { video?: HelpEntry["video"]; title: string }) {
  const icon = (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M2 4.2A1.7 1.7 0 0 1 3.7 2.5h5.1a1.7 1.7 0 0 1 1.7 1.7v7.6a1.7 1.7 0 0 1-1.7 1.7H3.7A1.7 1.7 0 0 1 2 11.8V4.2Zm9.9 2.6 2.5-1.6a.5.5 0 0 1 .8.4v4.8a.5.5 0 0 1-.8.4l-2.5-1.6V6.8Z" />
    </svg>
  );

  if (!video) {
    return (
      <span
        title="Walkthrough video coming soon"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-ink/20"
      >
        {icon}
        <span className="sr-only">No walkthrough video for {title} yet</span>
      </span>
    );
  }

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      title={video.label ?? `Watch: ${title}`}
      className="focus-stamp grid h-6 w-6 shrink-0 place-items-center rounded-lg text-stamp-600 transition-colors hover:bg-stamp-50"
    >
      {icon}
      <span className="sr-only">{video.label ?? `Watch a walkthrough of ${title}`}</span>
    </a>
  );
}
