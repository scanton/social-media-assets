"use client";

import type { ReactNode } from "react";
import { AssetTile, PendingTile } from "../AssetTile";
import { useStudio } from "../studio-store";
import type { Asset, AssetKind } from "@/lib/studio-types";
import { cx } from "../ui";

export function SectionHead({
  step,
  title,
  blurb,
}: {
  step: number;
  title: string;
  blurb: string;
}) {
  return (
    <header className="animate-rise">
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-stamp-600 text-[13px] font-extrabold text-white">
          {step}
        </span>
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stamp-600">
          Step {step} of 4
        </span>
      </div>
      <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
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
}: {
  assets: Asset[];
  /** Only show in-flight tiles belonging to this step. */
  kind: AssetKind;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  emptyEmoji?: string;
  emptyText: string;
  cols?: string;
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
        />
      ))}
    </div>
  );
}

export function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-bold text-ink">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}
