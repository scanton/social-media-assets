"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { cx } from "../ui";
import { HelpTip } from "../HelpTip";

/**
 * The picker column's accordion.
 *
 * The six catalogues run to 12 shells, 18 frames, 13 borders, 34 arrows and 62
 * glyphs. Flat, they push the controls below them — the arrow angle in
 * particular — past the bottom of the window, so you cannot see the nugget you
 * are adjusting while you adjust it. One section open at a time keeps the
 * column short enough that the stage stays in view.
 *
 * Children stay mounted when shut. They have to, or there is nothing to animate
 * on the way out, and it costs nothing that was not already being paid: every
 * one of these thumbnails rendered on every pass before there was an accordion.
 */

const AccordionCtx = createContext<{
  openId: string | null;
  toggle: (id: string) => void;
} | null>(null);

export function Accordion({
  children,
  defaultOpen = null,
}: {
  children: ReactNode;
  /** Section to start open, by its `id`. Null starts them all shut. */
  defaultOpen?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpen);
  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));
  return <AccordionCtx.Provider value={{ openId, toggle }}>{children}</AccordionCtx.Provider>;
}

/**
 * Overshoot on the way in, settle back. The row height cannot use this — an
 * `fr` track animated past its endpoint clips against `overflow: hidden` and
 * the content visibly jumps — so the bounce rides on the inner transform and
 * the height runs on a plain ease-out underneath it.
 */
const BOUNCE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const SETTLE = "cubic-bezier(0.22, 1, 0.36, 1)";

export function Disclosure({
  id,
  label,
  value,
  count,
  children,
  help,
}: {
  /** Identity within the accordion. */
  id: string;
  label: string;
  /** Key into the help registry. Draws a "?" beside the section name. */
  help?: string;
  /** The current selection, shown when the section is shut. */
  value?: string;
  /** How many options it holds. */
  count?: number;
  children: ReactNode;
}) {
  const ctx = useContext(AccordionCtx);
  const localId = useId();
  const open = ctx?.openId === id;

  return (
    <div className="border-b border-hairline last:border-b-0">
      {/* The tip is a sibling of the header, not a child: a button inside a
          button is invalid, and clicking it would also open the section. */}
      <div className="flex items-center gap-2">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={localId}
        onClick={() => ctx?.toggle(id)}
        className="focus-stamp flex min-w-0 flex-1 items-center gap-3 py-3 text-left"
      >
        <svg
          viewBox="0 0 12 12"
          aria-hidden="true"
          className={cx("h-3 w-3 shrink-0 text-ink/40 motion-safe:transition-transform", open && "rotate-90")}
          style={{ transitionDuration: "260ms", transitionTimingFunction: BOUNCE }}
        >
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs font-bold uppercase tracking-wide text-ink">{label}</span>
        <span className="ml-auto flex items-center gap-2">
          <span
            className={cx(
              "max-w-[10rem] truncate text-xs text-ink/60 motion-safe:transition-opacity motion-safe:duration-200",
              open && "opacity-0",
            )}
          >
            {value}
          </span>
          {count !== undefined && <span className="text-xs tabular-nums text-ink/35">{count}</span>}
        </span>
      </button>
      {help && <HelpTip id={help} />}
      </div>

      <div
        id={localId}
        role="region"
        aria-hidden={!open}
        inert={!open ? true : undefined}
        className={cx("grid motion-safe:transition-[grid-template-rows]", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
        style={{ transitionDuration: "300ms", transitionTimingFunction: SETTLE }}
      >
        <div className="overflow-hidden">
          <div
            className={cx(
              "pb-4 motion-safe:transition-all",
              open ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-[0.98] opacity-0",
            )}
            style={{
              transitionDuration: open ? "340ms" : "180ms",
              transitionTimingFunction: open ? BOUNCE : SETTLE,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
