"use client";

import { useSyncExternalStore } from "react";
import { ANGLES, ASPECTS, DEVICES, FRAMINGS, MOTIONS, SCENES, type AspectId, type SurfaceKind } from "@/lib/options";
import type { Asset, AssetKind, CardPanel } from "@/lib/studio-types";

export type BaseConfig = {
  deviceId: string;
  sceneId: string;
  audienceId: string;
  lightingId: string;
  lookId: string;
  presenceId: string;
  /** How much of the frame the product fills. */
  framingId: string;
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
  /*
   * Which assets are currently wired into the pipeline. These live here rather
   * than in component state because they used to reset on every reload — the
   * artwork was still in the roll, nothing was selected, and step 2 quietly
   * rendered a blank screen.
   */
  /** Printed-card front panel. */
  cardFrontId: string | null;
  /** Printed-card inside spread — optional; unlocks the opening motions. */
  cardInsideId: string | null;
  /** Digital-card animation clip. */
  cardVideoId: string | null;
  baseId: string | null;
};

export const DEFAULT_BASE: BaseConfig = {
  deviceId: "iphone-portrait",
  sceneId: "coffee-shop",
  audienceId: "genz",
  lightingId: "window",
  lookId: "iphone",
  presenceId: "hands",
  framingId: "hero",
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
  cardFrontId: null,
  cardInsideId: null,
  cardVideoId: null,
  baseId: null,
};

const has = (list: { id: string }[], id: string) => list.some((o) => o.id === id);

/** A motion is usable if it exists and its inside-spread requirement is met. */
export function motionUsable(motionId: string, assets: Asset[]): boolean {
  const motion = MOTIONS.find((m) => m.id === motionId);
  if (!motion) return false;
  if (!motion.requiresInside) return true;
  return assets.some((a) => a.kind === "card-art" && a.panel === "inside");
}

/** Shape as it comes off disk: selection ids may be absent on older sessions. */
type RawPersisted = Omit<Persisted, "cardFrontId" | "cardInsideId" | "cardVideoId" | "baseId"> & {
  cardFrontId?: string | null;
  cardInsideId?: string | null;
  cardVideoId?: string | null;
  baseId?: string | null;
  /** Pre-split sessions kept a single artwork slot. */
  cardArtId?: string | null;
};

/**
 * Repairs a restored session: drops selections whose asset is gone, falls back
 * to the newest asset of the right kind when nothing is selected, and resets any
 * taxonomy id that no longer exists (the option lists change between releases).
 */
function sanitize(p: RawPersisted): Persisted {
  const newestOf = (kind: AssetKind) =>
    p.assets.filter((a) => a.kind === kind).sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null;

  /*
   * `null` means the user deliberately cleared the slot, so leave it cleared.
   * `undefined` means this session predates selection persistence, and a stale
   * id means the asset is gone — both fall back to the newest of that kind.
   */
  const resolve = (id: string | null | undefined, kind: AssetKind): string | null => {
    if (id === null) return null;
    if (id && p.assets.some((a) => a.id === id && a.kind === kind)) return id;
    return newestOf(kind);
  };

  const newestPanel = (panel: CardPanel) =>
    p.assets
      .filter((a) => a.kind === "card-art" && a.panel === panel)
      .sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null;

  const resolvePanel = (id: string | null | undefined, panel: CardPanel): string | null => {
    if (id === null) return null;
    if (id && p.assets.some((a) => a.id === id && a.kind === "card-art" && a.panel === panel)) {
      return id;
    }
    return newestPanel(panel);
  };

  const angleIds = p.base.angleIds.filter((id) => has(ANGLES, id));
  const aspectIds = p.base.aspectIds.filter((id) => has(ASPECTS, id));

  const { cardArtId: _legacy, ...rest } = p;
  return {
    ...rest,
    // Sessions from before the front/inside split carried one artwork slot.
    cardFrontId: resolvePanel(p.cardFrontId ?? _legacy, "front"),
    cardInsideId: resolvePanel(p.cardInsideId, "inside"),
    cardVideoId: resolve(p.cardVideoId, "card-video"),
    baseId: resolve(p.baseId, "base"),
    base: {
      ...p.base,
      deviceId: has(DEVICES, p.base.deviceId) ? p.base.deviceId : DEFAULT_BASE.deviceId,
      sceneId: has(SCENES, p.base.sceneId) ? p.base.sceneId : DEFAULT_BASE.sceneId,
      framingId: has(FRAMINGS, p.base.framingId) ? p.base.framingId : DEFAULT_BASE.framingId,
      angleIds: angleIds.length ? angleIds : DEFAULT_BASE.angleIds,
      aspectIds: aspectIds.length ? aspectIds : DEFAULT_BASE.aspectIds,
    },
    video: {
      ...p.video,
      // An opening motion with no inside spread left to reveal would render a
      // card opening onto artwork the model invented.
      motionId: motionUsable(p.video.motionId, p.assets) ? p.video.motionId : DEFAULT_VIDEO.motionId,
    },
  };
}

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
    const saved = JSON.parse(raw) as Partial<RawPersisted>;
    return sanitize({
      assets: Array.isArray(saved.assets) ? saved.assets : DEFAULTS.assets,
      base: { ...DEFAULT_BASE, ...(saved.base ?? {}) },
      video: { ...DEFAULT_VIDEO, ...(saved.video ?? {}) },
      surface: saved.surface === "print" ? "print" : "screen",
      cardFrontId: saved.cardFrontId,
      cardInsideId: saved.cardInsideId,
      cardArtId: saved.cardArtId,
      cardVideoId: saved.cardVideoId,
      baseId: saved.baseId,
    });
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
