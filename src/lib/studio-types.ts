import type { AspectId, SurfaceKind } from "@/lib/options";

export type AssetKind =
  | "card-art" /* uploaded printed-card / digital-card artwork */
  | "card-video" /* uploaded 8–13s digital card clip */
  | "base" /* generated lifestyle scene, card already on the surface */
  | "video"; /* final motion asset */

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
  aspect?: AspectId;
  surface?: SurfaceKind;
};

export type JobState = "queued" | "running" | "done" | "error" | "cancelled";

export type Job = {
  id: string;
  label: string;
  kind: AssetKind;
  model: string;
  state: JobState;
  queuePosition?: number;
  error?: string;
  startedAt: number;
  finishedAt?: number;
};

export const isVideo = (a: Asset) => a.kind === "video" || a.kind === "card-video";
