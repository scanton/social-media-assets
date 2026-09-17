"use client";

import { useState } from "react";
import { assetPreview, downloadUrl, isDownloadable } from "@/lib/client-api";
import { ASPECTS } from "@/lib/options";
import type { Asset } from "@/lib/studio-types";
import { filenameFor } from "../AssetTile";
import { cx } from "../ui";

export type PlateChoice = "cropped" | "original";

/**
 * One Device Shots plate, shown both ways: cropped in on the screen, and as the
 * model rendered it. The crop is a judgement call made by a detector, so the
 * person gets the last word — clicking a side picks it, and Preview and
 * Download act on whichever is picked.
 *
 * Drawn here rather than with AssetTile because that tile crops everything to
 * 4:5, which would hide the very difference being compared.
 */
export function PlatePair({
  asset,
  choice,
  onChoose,
  onRemove,
}: {
  /** `url` is the cropped version, `rawUrl` the render it came from. */
  asset: Asset;
  choice: PlateChoice;
  onChoose: (next: PlateChoice) => void;
  onRemove: () => void;
}) {
  const [zoom, setZoom] = useState(false);
  const aspect = ASPECTS.find((a) => a.id === asset.aspect);
  const ratio = aspect ? `${aspect.width} / ${aspect.height}` : "9 / 16";

  const versions: { id: PlateChoice; url: string; label: string }[] =
    asset.rawUrl
      ? [
          {
            id: "cropped",
            url: asset.url,
            label: `Cropped in · ${(asset.cropZoom ?? 1).toFixed(1)}×`,
          },
          { id: "original", url: asset.rawUrl, label: "As rendered" },
        ]
      : [{ id: "original", url: asset.url, label: "As rendered" }];
  const picked = versions.find((v) => v.id === choice) ?? versions[0];
  const pickedAsset: Asset = {
    ...asset,
    url: picked.url,
    contentType: "image/png",
  };
  const src = assetPreview(picked.url)?.src ?? picked.url;
  // Same name either way, told apart by a suffix, so the pair sorts together.
  const filename =
    versions.length > 1
      ? filenameFor(pickedAsset).replace(
          /\.png$/,
          picked.id === "cropped" ? "-cropped.png" : "-as-rendered.png",
        )
      : filenameFor(pickedAsset);

  return (
    <>
      <div className="col-span-2 animate-pop-in rounded-2xl border border-hairline bg-white p-2.5">
        <div
          className={cx(
            "grid gap-2",
            versions.length > 1 ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {versions.map((v) => {
            const on = v.id === picked.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onChoose(v.id)}
                aria-pressed={on}
                title={on ? "Using this one" : "Use this one"}
                className={cx(
                  "focus-stamp group relative overflow-hidden rounded-xl border-2 bg-canvas-2 text-left transition-all",
                  on
                    ? "border-stamp-600"
                    : "border-transparent opacity-60 hover:opacity-100",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={assetPreview(v.url)?.src ?? v.url}
                  alt={`${asset.label}, ${v.label}`}
                  style={{ aspectRatio: ratio }}
                  className="w-full object-contain"
                />
                <span
                  className={cx(
                    "absolute inset-x-1.5 bottom-1.5 rounded-full px-2 py-0.5 text-center text-[10px] font-bold backdrop-blur-sm",
                    on ? "bg-stamp-600 text-white" : "bg-white/90 text-ink",
                  )}
                >
                  {on && versions.length > 1 ? "✓ " : ""}
                  {v.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <p className="mr-auto min-w-0 truncate text-[12px] font-bold text-ink">
            {asset.label}
          </p>
          <button
            type="button"
            onClick={() => setZoom(true)}
            className="focus-stamp rounded-full border border-hairline px-2.5 py-1 text-[11px] font-bold text-ink hover:border-stamp-300"
          >
            Preview
          </button>
          {isDownloadable(picked.url) && (
            <a
              href={downloadUrl(picked.url, filename)}
              download={filename}
              className="focus-stamp rounded-full bg-stamp-600 px-2.5 py-1 text-[11px] font-bold text-white"
            >
              Download
            </a>
          )}
          <button
            type="button"
            onClick={onRemove}
            title="Remove this plate"
            aria-label="Remove this plate"
            className="focus-stamp rounded-full px-2 py-1 text-[11px] font-bold text-ink-faint hover:text-stamp-600"
          >
            ✕
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {asset.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-canvas-2 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-ink-faint"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Outside the card: its pop-in transform would otherwise trap a fixed overlay. */}
      {zoom && (
        <div
          className="fixed inset-0 z-[95] flex animate-pop-in items-center justify-center bg-ink/80 p-4 backdrop-blur-md sm:p-10"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-modal="true"
          aria-label={pickedAsset.label}
        >
          <div
            className="flex max-h-full w-full max-w-4xl flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={pickedAsset.label}
              className="max-h-[76vh] w-auto rounded-2xl shadow-2xl"
            />
            <div className="flex flex-wrap items-center justify-center gap-2">
              {versions.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChoose(picked.id === "cropped" ? "original" : "cropped")
                  }
                  className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/25"
                >
                  Show {picked.id === "cropped" ? "as rendered" : "cropped in"}
                </button>
              )}
              {isDownloadable(picked.url) && (
                <a
                  href={downloadUrl(picked.url, filename)}
                  download={filename}
                  className="rounded-full bg-stamp-600 px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-105"
                >
                  Download{" "}
                  {versions.length > 1
                    ? picked.label.split(" ·")[0].toLowerCase()
                    : ""}
                </a>
              )}
              <button
                type="button"
                onClick={() => setZoom(false)}
                className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/25"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
