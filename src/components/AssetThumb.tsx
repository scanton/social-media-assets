"use client";

import { reportAssetError, reportAssetOk, useAssetHealth } from "@/lib/asset-health";
import { mediaSrc } from "@/lib/client-api";
import { cx } from "./ui";

/**
 * A small asset preview that degrades instead of breaking.
 *
 * The tiles in the roll are not the only place an asset URL is rendered — the
 * step-1 panel slots, the batch summary and the reference chips all show
 * thumbnails too, and every one of them would show a torn-image icon once fal
 * drops the file. This keeps that in one place and feeds the same health store
 * the roll uses, so one failure anywhere marks the asset everywhere.
 */
export function AssetThumb({
  url,
  alt = "",
  className,
  video = false,
}: {
  url: string;
  alt?: string;
  className?: string;
  video?: boolean;
}) {
  const health = useAssetHealth(url);
  /*
   * Empty means there is nothing that CAN be shown — a Replicate file with no
   * thumbnail kept for it. Rendering an element with an empty src just makes
   * the browser fetch the page again and report a decode failure, so the
   * placeholder is drawn directly.
   */
  const src = mediaSrc(url);
  if (!src) {
    return (
      <span
        className={cx("grid shrink-0 place-items-center bg-canvas-2 text-ink-faint", className)}
        title="Staged on Replicate, which serves no preview"
      >
        <span className="text-xs opacity-60">🎞️</span>
      </span>
    );
  }

  if (health !== "ok") {
    return (
      <span
        className={cx(
          "grid shrink-0 place-items-center bg-canvas-2 text-ink-faint",
          className,
        )}
        title={health === "gone" ? "This file has expired on fal" : "Can't load this right now"}
      >
        <span className="text-xs opacity-60">{health === "checking" ? "⏳" : "🗓️"}</span>
      </span>
    );
  }

  if (video) {
    return (
      <video
        src={src}
        className={className}
        muted
        playsInline
        preload="metadata"
        onError={() => reportAssetError(url)}
        onLoadedData={() => reportAssetOk(url)}
      />
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => reportAssetError(url)}
      onLoad={() => reportAssetOk(url)}
    />
  );
}
