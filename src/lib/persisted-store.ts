"use client";

import { useSyncExternalStore } from "react";
import type { AspectId, SurfaceKind } from "@/lib/options";
import type { Asset } from "@/lib/studio-types";

export type BaseConfig = {
  deviceId: string;
  sceneId: string;
  audienceId: string;
  lightingId: string;
  lookId: string;
  presenceId: string;
  angleIds: string[];
  aspectIds: AspectId[];
  /** Renders per angle × orientation combo. */
  variations: number;
  /** Burn the HeartStamp emblem into the bottom-right corner of each still. */
  logo: boolean;
  quality: "auto" | "low" | "medium" | "high";
  notes: string;
};

export type VideoConfig = {
  engine: "animate" | "screen-replace";
  motionId: string;
  resolution: "480p" | "720p" | "1080p" | "4k";
  duration: string;
  aspectRatio: "auto" | "9:16" | "16:9" | "1:1" | "4:3" | "3:4" | "21:9";
  generateAudio: boolean;
  notes: string;
};

export type Persisted = {
  assets: Asset[];
  base: BaseConfig;
  video: VideoConfig;
  surface: SurfaceKind;
};

export const DEFAULT_BASE: BaseConfig = {
  deviceId: "iphone-portrait",
  sceneId: "coffee-shop",
  audienceId: "genz",
  lightingId: "window",
  lookId: "iphone",
  presenceId: "hands",
  angleIds: ["pov"],
  aspectIds: ["9:16"],
  variations: 1,
  logo: true,
  quality: "high",
  notes: "",
};

export const DEFAULT_VIDEO: VideoConfig = {
  engine: "animate",
  motionId: "slow-push",
  resolution: "1080p",
  duration: "auto",
  aspectRatio: "auto",
  generateAudio: false,
  notes: "",
};

const DEFAULTS: Persisted = {
  assets: [],
  base: DEFAULT_BASE,
  video: DEFAULT_VIDEO,
  surface: "screen",
};

const STORAGE_KEY = "heartstamp-studio-v2";

/*
 * A tiny external store rather than useState + a hydration effect.
 *
 * The server (and the first client render) see DEFAULTS, so hydration always
 * matches. localStorage is read once when the first component subscribes;
 * React re-reads the snapshot right after subscribing and re-renders with the
 * restored session.
 */
let snapshot: Persisted = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

function readStorage(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw) as Partial<Persisted>;
    return {
      assets: Array.isArray(saved.assets) ? saved.assets : DEFAULTS.assets,
      base: { ...DEFAULT_BASE, ...(saved.base ?? {}) },
      video: { ...DEFAULT_VIDEO, ...(saved.video ?? {}) },
      surface: saved.surface === "print" ? "print" : "screen",
    };
  } catch {
    return DEFAULTS;
  }
}

function writeStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* quota exceeded — state stays in memory for this session */
  }
}

function subscribe(onChange: () => void) {
  if (!loaded) {
    loaded = true;
    snapshot = readStorage();
  }
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => DEFAULTS;

export function usePersisted(): Persisted {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Reads the live snapshot outside of render — for event handlers that patch state. */
export function getPersisted(): Persisted {
  return snapshot;
}

export function updatePersisted(patch: Partial<Persisted>) {
  snapshot = { ...snapshot, ...patch };
  writeStorage();
  listeners.forEach((l) => l());
}
