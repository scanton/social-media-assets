"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ExampleGallery as Gallery, ExampleItem } from "@/lib/examples";
import { cx } from "./cx";

/**
 * A picture per option, opened from a help tooltip.
 *
 * Portaled to the studio root for the same reason the tooltip is: the controls
 * live in scrolling columns that would clip it, and past the root there are no
 * styles at all.
 */
const studioRoot = () => document.getElementById("heartstamp-studio") ?? document.body;

export function ExampleGalleryDialog({
  gallery,
  startAt,
  onClose,
}: {
  gallery: Gallery;
  /** Option id to open enlarged, or null for the grid. */
  startAt: string | null;
  onClose: () => void;
}) {
  const [focus, setFocus] = useState<number | null>(() => {
    const i = gallery.items.findIndex((it) => it.id === startAt);
    return i >= 0 ? i : null;
  });
  const count = gallery.items.length;

  const step = useCallback(
    (by: number) => setFocus((f) => (f === null ? f : (f + by + count) % count)),
    [count],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Back out one level: the enlarged picture first, then the gallery.
        e.stopPropagation();
        if (focus !== null) setFocus(null);
        else onClose();
      } else if (focus !== null && e.key === "ArrowRight") step(1);
      else if (focus !== null && e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [focus, onClose, step]);

  const current = focus === null ? null : gallery.items[focus];

  return createPortal(
    <div
      className="fixed inset-0 z-[96] flex animate-pop-in items-center justify-center bg-ink/80 p-3 backdrop-blur-md sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${gallery.title} examples`}
    >
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start gap-3 border-b border-hairline px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold text-ink">
              {current ? (
                <button
                  type="button"
                  onClick={() => setFocus(null)}
                  className="focus-stamp mr-2 rounded-full px-1 text-ink-faint hover:text-stamp-600"
                  aria-label="Back to all examples"
                >
                  ←
                </button>
              ) : null}
              {gallery.title} examples
            </h3>
            <p className="mt-0.5 text-xs text-ink-soft">{gallery.constant}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close examples"
            className="focus-stamp grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-canvas-2 hover:text-ink"
          >
            ✕
          </button>
        </header>

        {current ? (
          <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto p-4 sm:flex-row sm:items-stretch sm:gap-5 sm:p-6">
            <div className="flex min-h-0 min-w-0 max-w-full items-center gap-2">
              <NavButton label="Previous example" onClick={() => step(-1)}>
                ‹
              </NavButton>
              <ExampleImage key={current.id} item={current} className="max-h-[62vh] min-w-0 max-w-full rounded-2xl object-contain" />
              <NavButton label="Next example" onClick={() => step(1)}>
                ›
              </NavButton>
            </div>
            <div className="w-full max-w-sm sm:pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">
                {(focus ?? 0) + 1} of {count}
              </p>
              <h4 className="mt-1 font-display text-xl font-bold text-ink">
                {current.emoji ? <span className="mr-1.5">{current.emoji}</span> : null}
                {current.label}
              </h4>
              {current.hint && <p className="mt-1.5 text-sm text-ink-soft">{current.hint}</p>}
              {current.asks && (
                <p className="mt-3 rounded-xl bg-canvas-2 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                  <span className="font-bold text-ink">What the model is asked for: </span>
                  {current.asks}
                </p>
              )}
              <p className="mt-4 text-xs leading-relaxed text-ink-faint">
                An example, not a promise: every render is different. Step through with ‹ › (or the arrow keys) to compare.
              </p>
            </div>
          </div>
        ) : (
          <ul className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 sm:p-5 md:grid-cols-4 lg:grid-cols-5">
            {gallery.items.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setFocus(i)}
                  className="focus-stamp group block w-full overflow-hidden rounded-2xl border border-hairline bg-white text-left transition-all hover:-translate-y-0.5 hover:border-stamp-300 hover:shadow-md"
                >
                  <ExampleImage item={item} className="aspect-4/5 w-full object-cover" lazy />
                  <span className="block px-2.5 py-2">
                    <span className="block truncate text-[12px] font-bold text-ink">
                      {item.emoji ? <span className="mr-1">{item.emoji}</span> : null}
                      {item.label}
                    </span>
                    {item.hint && (
                      <span className="mt-0.5 block truncate text-[11px] text-ink-faint">{item.hint}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    studioRoot(),
  );
}

function NavButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus-stamp grid h-10 w-10 shrink-0 place-items-center rounded-full border border-hairline bg-white text-2xl leading-none text-ink hover:border-stamp-300 hover:text-stamp-600"
    >
      {children}
    </button>
  );
}

/** The picture, or a quiet placeholder until the render script has made it. */
export function ExampleImage({
  item,
  className,
  lazy,
}: {
  item: ExampleItem;
  className?: string;
  lazy?: boolean;
}) {
  const [missing, setMissing] = useState(false);
  if (missing) {
    return (
      <span
        className={cx(
          "grid aspect-4/5 place-items-center bg-canvas-2 text-center text-[11px] font-semibold text-ink-faint",
          className,
        )}
      >
        No example yet
      </span>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={item.src}
      alt={`Example: ${item.label}`}
      loading={lazy ? "lazy" : undefined}
      onError={() => setMissing(true)}
      className={cx("bg-canvas-2", className)}
    />
  );
}
