"use client";

import { useState } from "react";
import { mediaSrc } from "@/lib/client-api";
import { downloadUrl } from "@/lib/client-api";
import type { Asset } from "@/lib/studio-types";
import { isVideo } from "@/lib/studio-types";
import { reportAssetError, reportAssetOk, useAssetHealth } from "@/lib/asset-health";
import { LavaHearts } from "./LavaHearts";
import { cx } from "./ui";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

function filenameFor(asset: Asset) {
  const ext = EXT[asset.contentType ?? ""] ?? (isVideo(asset) ? "mp4" : "png");
  const slug = asset.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `heartstamp-${slug || asset.kind}-${asset.id.slice(-5)}.${ext}`;
}

export function AssetTile({
  asset,
  selected,
  onSelect,
  onRemove,
  onAlign,
  selectable = false,
}: {
  asset: Asset;
  selected?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
  /** Opens the screen aligner. Only passed where re-compositing makes sense. */
  onAlign?: () => void;
  selectable?: boolean;
}) {
  const [zoom, setZoom] = useState(false);
  const video = isVideo(asset);

  // fal drops media after a while, so a tile from last week points at nothing.
  // Rendering a broken <img> is the one outcome worth avoiding.
  const health = useAssetHealth(asset.url);
  const missing = health === "gone" || health === "unreachable" || health === "checking";

  return (
    <>
      <div
        className={cx(
          "group relative animate-pop-in overflow-hidden rounded-2xl border bg-white transition-all duration-300",
          selected
            ? "border-stamp-600 shadow-[0_0_0_3px_rgba(190,30,46,0.14),0_14px_34px_-16px_rgba(190,30,46,0.6)]"
            : "border-hairline hover:-translate-y-1 hover:border-stamp-300 hover:shadow-[0_16px_36px_-18px_rgba(14,14,16,0.32)]",
        )}
      >
        <div className="relative aspect-4/5 overflow-hidden bg-canvas-2">
          {missing ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-canvas-2 px-3 text-center">
              <span className="text-2xl opacity-40">{health === "checking" ? "⏳" : "🗓️"}</span>
              <p className="text-[11px] font-bold leading-snug text-ink-faint">
                {health === "checking"
                  ? "Checking…"
                  : health === "gone"
                    ? "Expired on fal"
                    : "Can't load right now"}
              </p>
              {health === "gone" && (
                <p className="text-[10px] leading-snug text-ink-faint">
                  fal no longer has this file
                </p>
              )}
            </div>
          ) : video ? (
            <video
              src={mediaSrc(asset.url)}
              className="h-full w-full object-cover"
              muted
              loop
              playsInline
              preload="metadata"
              onError={() => reportAssetError(asset.url)}
              onLoadedData={() => reportAssetOk(asset.url)}
              onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
              onMouseLeave={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0;
              }}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={mediaSrc(asset.url)}
              alt={asset.label}
              loading="lazy"
              onError={() => reportAssetError(asset.url)}
              onLoad={() => reportAssetOk(asset.url)}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          )}

          {video && (
            <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-ink/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
              ▶ video
            </span>
          )}

          {asset.needsAlign && (
            <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
              ⚠ align screen
            </span>
          )}

          {selectable && (
            <button
              type="button"
              onClick={onSelect}
              aria-pressed={selected}
              className="absolute inset-0 focus-stamp"
              title={selected ? "Selected" : "Select this asset"}
            >
              <span className="sr-only">{selected ? "Selected" : "Select"} {asset.label}</span>
            </button>
          )}

          {selectable && (
            <span
              className={cx(
                "pointer-events-none absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border-2 transition-all duration-300",
                selected
                  ? "scale-100 border-stamp-600 bg-stamp-600 text-white"
                  : "scale-90 border-white/80 bg-ink/25 text-transparent backdrop-blur-sm group-hover:scale-100",
              )}
            >
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 6.2 4.8 9 10 3.5" />
              </svg>
            </span>
          )}

          {/* Hover action bar */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-2 items-center justify-end gap-1.5 bg-gradient-to-t from-ink/70 to-transparent p-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            {!missing && (
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="pointer-events-auto rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-ink shadow-sm transition-transform hover:scale-105"
            >
              Preview
            </button>
            )}
            {!missing && onAlign && asset.cardUrl && (
              <button
                type="button"
                onClick={onAlign}
                title="Drag the screen corners and re-composite"
                className={cx(
                  "pointer-events-auto rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm transition-transform hover:scale-105",
                  asset.needsAlign ? "bg-amber-500 text-white" : "bg-white/95 text-ink",
                )}
              >
                Align
              </button>
            )}
            {!missing && (
              <a
                href={downloadUrl(asset.url, filenameFor(asset))}
                className="pointer-events-auto rounded-full bg-stamp-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition-transform hover:scale-105"
              >
                Download
              </a>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                title="Remove from roll"
                className="pointer-events-auto rounded-full bg-white/95 px-2 py-1 text-[11px] font-bold text-ink-soft shadow-sm transition-transform hover:scale-105 hover:text-stamp-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="p-2.5">
          <p className="truncate text-[12px] font-bold text-ink">{asset.label}</p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {asset.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-canvas-2 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[95] flex animate-pop-in items-center justify-center bg-ink/80 p-4 backdrop-blur-md sm:p-10"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-modal="true"
          aria-label={asset.label}
        >
          <div className="flex max-h-full w-full max-w-4xl flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            {video ? (
              <video src={mediaSrc(asset.url)} className="max-h-[76vh] w-auto rounded-2xl shadow-2xl" controls autoPlay loop playsInline />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={mediaSrc(asset.url)} alt={asset.label} className="max-h-[76vh] w-auto rounded-2xl shadow-2xl" />
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href={downloadUrl(asset.url, filenameFor(asset))}
                className="rounded-full bg-stamp-600 px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-105"
              >
                Download
              </a>
              <button
                type="button"
                onClick={() => setZoom(false)}
                className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/25"
              >
                Close
              </button>
            </div>
            {asset.prompt && (
              <details className="w-full max-w-2xl rounded-2xl bg-white/10 p-3 text-left text-xs text-white/80">
                <summary className="cursor-pointer font-semibold text-white">Prompt used</summary>
                <p className="mt-2 leading-relaxed">{asset.prompt}</p>
              </details>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Placeholder shown while a job is in flight. */
export function PendingTile({ label, state, queuePosition, error, stage }: {
  label: string;
  state: string;
  queuePosition?: number;
  error?: string;
  stage?: string;
}) {
  const failed = state === "error";
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-2xl border bg-white",
        failed ? "border-stamp-200" : "border-hairline",
      )}
    >
      <div className="relative aspect-4/5 overflow-hidden">
        {failed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-stamp-50 p-4 text-center">
            <span className="text-2xl">😵‍💫</span>
            <p className="text-[11px] font-semibold leading-snug text-stamp-700">{error ?? "Generation failed"}</p>
          </div>
        ) : (
          <>
            <div className="absolute inset-0 bg-stamp-50/40">
              <LavaHearts />
            </div>
            {/* The field is busy behind the label, so the label gets its own plate. */}
            <div className="absolute inset-0 flex items-end justify-center p-2.5">
              <p className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-stamp-700 shadow-sm backdrop-blur-sm">
                {stage
                  ? stage
                  : state === "queued"
                    ? queuePosition != null
                      ? `#${queuePosition} in queue`
                      : "Queued"
                    : "Rendering"}
              </p>
            </div>
          </>
        )}
      </div>
      <div className="p-2.5">
        <p className="truncate text-[12px] font-bold text-ink-faint">{label}</p>
      </div>
    </div>
  );
}
