import type { AspectId, SurfaceKind } from "@/lib/options";
import type { Quad } from "@/lib/perspective";

/** Which panel a piece of printed-card artwork represents. */
export type CardPanel = "front" | "inside";

export type AssetKind =
  | "card-art" /* uploaded printed-card artwork — see `panel` */
  | "card-video" /* uploaded 8–13s digital card clip */
  | "background" /* uploaded location photo the printed card is placed into */
  | "base" /* generated lifestyle scene, card already on the surface */
  | "video" /* final motion asset */
  | "freeform"; /* made on the open bench, image or clip, outside either pipeline */

export type Asset = {
  id: string;
  kind: AssetKind;
  url: string;
  contentType?: string;
  width?: number;
  height?: number;
  label: string;
  /** Chips rendered on the tile. */
  tags: string[];
  createdAt: number;
  parentId?: string;
  prompt?: string;
  /** Set on card-art: the front panel, or the full inside spread. */
  panel?: CardPanel;
  aspect?: AspectId;
  surface?: SurfaceKind;

  /* Set on scenes finished in the browser, so the screen can be re-aligned. */
  /** The render before compositing. */
  rawUrl?: string;
  /** Artwork warped onto the screen. */
  cardUrl?: string;
  /** Screen corners in rawUrl pixels. */
  quad?: Quad;
  /** True when artwork was supplied but the screen couldn't be located. */
  needsAlign?: boolean;
};

export type JobState = "queued" | "running" | "done" | "error" | "cancelled";

export type Job = {
  id: string;
  label: string;
  kind: AssetKind;
  model: string;
  state: JobState;
  queuePosition?: number;
  /** Free-text sub-stage, e.g. the browser-side logo pass. */
  stage?: string;
  error?: string;
  startedAt: number;
  finishedAt?: number;
};

/*
 * A bench asset is whichever the model returned, so the kind alone cannot say.
 * Reading the content type first makes this more correct everywhere, not just
 * for the bench: a `video` asset has always carried one too.
 */
export const isVideo = (a: Asset) =>
  a.contentType?.startsWith("video/") || a.kind === "video" || a.kind === "card-video";
