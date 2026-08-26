"use client";

import type { ReactNode } from "react";
import { AssetTile, PendingTile } from "../AssetTile";
import { useStudio } from "../studio-store";
import type { Asset, AssetKind } from "@/lib/studio-types";
import { cx } from "../ui";
import { HelpTip } from "../HelpTip";

export function SectionHead({
  step,
  title,
  blurb,
  help,
}: {
  step: number;
  title: string;
  blurb: string;
  help?: string;
}) {
  // Printed cards run a scene step that digital cards skip.
  const { surface } = useStudio();
  const total = surface === "screen" ? 2 : 3;

  return (
    <header className="animate-rise">
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-stamp-600 text-[13px] font-extrabold text-white">
          {step}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stamp-600">
          Step {step} of {total}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2.5">
        <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {title}
        </h2>
        {help && <HelpTip id={help} className="h-5 w-5 text-xs" />}
      </div>
      <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-soft">{blurb}</p>
    </header>
  );
}

/** Results grid that interleaves in-flight jobs with finished assets. */
export function ResultsGrid({
  assets,
  kind,
  selectedId,
  onSelect,
  emptyEmoji = "🖼️",
  emptyText,
  cols = "sm:grid-cols-3 lg:grid-cols-4",
  onAlign,
}: {
  assets: Asset[];
  /** Only show in-flight tiles belonging to this step. */
  kind: AssetKind;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  emptyEmoji?: string;
  emptyText: string;
  cols?: string;
  onAlign?: (asset: Asset) => void;
}) {
  const s = useStudio();
  const live = s.jobs.filter(
    (j) => j.kind === kind && j.state !== "done" && j.state !== "cancelled",
  );

  if (!assets.length && !live.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-hairline bg-canvas-2/50 px-6 py-14 text-center">
        <span className="animate-float text-3xl">{emptyEmoji}</span>
        <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-faint">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className={cx("grid grid-cols-2 gap-3", cols)}>
      {live.map((j) => (
        <PendingTile
          key={j.id}
          label={j.label}
          state={j.state}
          queuePosition={j.queuePosition}
          error={j.error}
          stage={j.stage}
        />
      ))}
      {assets.map((a) => (
        <AssetTile
          key={a.id}
          asset={a}
          selectable={Boolean(onSelect)}
          selected={selectedId === a.id}
          onSelect={() => onSelect?.(a.id)}
          onRemove={() => s.removeAsset(a.id)}
          onAlign={onAlign ? () => onAlign(a) : undefined}
        />
      ))}
    </div>
  );
}

export function Panel({
  title,
  children,
  aside,
  locked,
  lockNote,
  help,
}: {
  title: string;
  /** Key into the help registry. Draws a "?" beside the panel's title. */
  help?: string;
  children: ReactNode;
  aside?: ReactNode;
  /** Greys the controls out and takes them out of the tab order entirely. */
  locked?: boolean;
  /** Why they're locked, and how to get them back. Stays interactive. */
  lockNote?: ReactNode;
}) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <h3 className="font-display text-base font-bold text-ink">{title}</h3>
          {help && <HelpTip id={help} />}
        </span>
        {aside}
      </div>
      {lockNote && (
        <div className="mb-5 rounded-2xl border border-stamp-200 bg-stamp-50 px-3.5 py-3 text-xs leading-relaxed text-stamp-800">
          {lockNote}
        </div>
      )}
      {/* `inert` rather than pointer-events: keyboard and screen readers skip it too. */}
      <div inert={locked} className={cx("transition-opacity duration-300", locked && "opacity-45")}>
        {children}
      </div>
    </section>
  );
}
