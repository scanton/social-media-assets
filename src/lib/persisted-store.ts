"use client";

import { useSyncExternalStore } from "react";
import {
  ANGLES,
  ASPECTS,
  AUDIENCES,
  CARD_SIZES,
  DETAIL_CATEGORIES,
  DEVICES,
  ETHNICITIES,
  FRAMINGS,
  IMAGE_RESOLUTIONS,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
  resolveDetail,
  SUBJECT_AGES,
  SUBJECT_GENDERS,
  LIGHTING,
  LOOKS,
  MOTIONS,
  PRESENCE,
  SCENES,
  type AspectId,
  type ImageResolutionId,
  type SubjectAgeId,
  type SubjectGenderId,
  type SurfaceKind,
} from "@/lib/options";
import type { Asset, AssetKind, CardPanel } from "@/lib/studio-types";

export type BaseConfig = {
  deviceId: string;
  sceneId: string;
  audienceId: string;
  lightingId: string;
  lookId: string;
  presenceId: string;
  /** Who the people in the scene read as. Ignored when presenceId is "none". */
  ethnicityId: string;
  genderId: SubjectGenderId;
  ageId: SubjectAgeId;
  /** Styling details, category id → option id. See DETAIL_CATEGORIES. */
  details: Record<string, string>;
  /** How much of the frame the product fills. */
  framingId: string;
  /** The card's real-world size — see CARD_SIZES. Printed cards only. */
  cardSizeId: string;
  angleIds: string[];
  aspectIds: AspectId[];
  /** Renders per angle × orientation combo. */
  variations: number;
  /** Short edge of each render — see IMAGE_RESOLUTIONS. */
  imageResolution: ImageResolutionId;
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
  /**
   * Printed-card location photo. When set it *is* the scene, so the scene
   * controls in step 2 are locked and their stored values go unused.
   */
  backgroundId: string | null;
  baseId: string | null;
};

export const DEFAULT_BASE: BaseConfig = {
  deviceId: "iphone-portrait",
  sceneId: "coffee-shop",
  audienceId: "genz",
  lightingId: "window",
  lookId: "iphone",
  presenceId: "hands",
  ethnicityId: "unspecified",
  genderId: "unspecified",
  ageId: "adult",
  details: {},
  framingId: "hero",
  cardSizeId: "5x7",
  angleIds: ["pov"],
  aspectIds: ["9:16"],
  variations: 1,
  imageResolution: "720p",
  logo: true,
  quality: "medium",
  notes: "",
};

export const DEFAULT_VIDEO: VideoConfig = {
  engine: "animate",
  motionId: "slow-push",
  resolution: "720p",
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
  backgroundId: null,
  baseId: null,
};

const has = (list: { id: string }[], id: string) => list.some((o) => o.id === id);

/**
 * Drops any styling detail that no longer suits the subject.
 *
 * Gender and age are editable after the fact, so a stored pick has to be
 * re-checked rather than trusted — otherwise switching the subject to a child
 * would quietly keep a tattoo sleeve on them.
 */
function sanitizeDetails(
  details: Record<string, string> | undefined,
  genderId: string,
  ageId: string,
): Record<string, string> {
  const gender = (has(SUBJECT_GENDERS, genderId) ? genderId : DEFAULT_BASE.genderId) as SubjectGenderId;
  const age = (has(SUBJECT_AGES, ageId) ? ageId : DEFAULT_BASE.ageId) as SubjectAgeId;

  const out: Record<string, string> = {};
  for (const category of DETAIL_CATEGORIES) {
    const id = resolveDetail(category, details, gender, age);
    if (id !== "unspecified") out[category.id] = id;
  }
  return out;
}

export const hasInsideSpread = (assets: Asset[]) =>
  assets.some((a) => a.kind === "card-art" && a.panel === "inside");

/**
 * Which motions apply, given the product and what's been uploaded.
 *
 * For printed cards the two sets are mutually exclusive: with an inside spread
 * every motion opens the card, because that's the whole point of having one.
 * Without a spread nothing may open, because there'd be nothing truthful to
 * reveal.
 */
export function usableMotions(assets: Asset[], surface: SurfaceKind) {
  const inside = hasInsideSpread(assets);
  return MOTIONS.filter((m) => {
    if (m.surface && m.surface !== surface) return false;
    if (surface !== "print") return !m.requiresInside;
    return inside ? Boolean(m.requiresInside) : !m.requiresInside;
  });
}

export function motionUsable(motionId: string, assets: Asset[], surface: SurfaceKind): boolean {
  return usableMotions(assets, surface).some((m) => m.id === motionId);
}

/** Falls back to the first motion that fits, so a stale id can't strand the UI. */
export function firstUsableMotion(assets: Asset[], surface: SurfaceKind): string {
  return usableMotions(assets, surface)[0]?.id ?? DEFAULT_VIDEO.motionId;
}

/** Shape as it comes off disk: selection ids may be absent on older sessions. */
type RawPersisted = Omit<
  Persisted,
  "cardFrontId" | "cardInsideId" | "cardVideoId" | "backgroundId" | "baseId"
> & {
  cardFrontId?: string | null;
  cardInsideId?: string | null;
  cardVideoId?: string | null;
  backgroundId?: string | null;
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
    // A background locks the whole scene panel, so a stale or absent id must
    // never resolve into one being silently re-applied on reload.
    backgroundId:
      p.backgroundId && p.assets.some((a) => a.id === p.backgroundId && a.kind === "background")
        ? p.backgroundId
        : null,
    baseId: resolve(p.baseId, "base"),
    base: {
      ...p.base,
      deviceId: has(DEVICES, p.base.deviceId) ? p.base.deviceId : DEFAULT_BASE.deviceId,
      sceneId: has(SCENES, p.base.sceneId) ? p.base.sceneId : DEFAULT_BASE.sceneId,
      framingId: has(FRAMINGS, p.base.framingId) ? p.base.framingId : DEFAULT_BASE.framingId,
      cardSizeId: has(CARD_SIZES, p.base.cardSizeId) ? p.base.cardSizeId : DEFAULT_BASE.cardSizeId,
      presenceId: has(PRESENCE, p.base.presenceId) ? p.base.presenceId : DEFAULT_BASE.presenceId,
      ethnicityId: has(ETHNICITIES, p.base.ethnicityId) ? p.base.ethnicityId : DEFAULT_BASE.ethnicityId,
      genderId: has(SUBJECT_GENDERS, p.base.genderId) ? p.base.genderId : DEFAULT_BASE.genderId,
      ageId: has(SUBJECT_AGES, p.base.ageId) ? p.base.ageId : DEFAULT_BASE.ageId,
      details: sanitizeDetails(p.base.details, p.base.genderId, p.base.ageId),
      imageResolution: has(IMAGE_RESOLUTIONS, p.base.imageResolution)
        ? p.base.imageResolution
        : DEFAULT_BASE.imageResolution,
      lightingId: has(LIGHTING, p.base.lightingId) ? p.base.lightingId : DEFAULT_BASE.lightingId,
      lookId: has(LOOKS, p.base.lookId) ? p.base.lookId : DEFAULT_BASE.lookId,
      audienceId: has(AUDIENCES, p.base.audienceId) ? p.base.audienceId : DEFAULT_BASE.audienceId,
      angleIds: angleIds.length ? angleIds : DEFAULT_BASE.angleIds,
      aspectIds: aspectIds.length ? aspectIds : DEFAULT_BASE.aspectIds,
    },
    video: {
      ...p.video,
      // Uploading or removing an inside spread flips which set applies, so a
      // stored motion from the other set has to be swapped out.
      motionId: motionUsable(p.video.motionId, p.assets, p.surface)
        ? p.video.motionId
        : firstUsableMotion(p.assets, p.surface),
      // A tier that has since left the list, "4k" being the one that just did,
      // would otherwise sit in the store selecting nothing: the control has no
      // such option to show, and the value still reaches the model to be
      // coerced. Falling back is the honest read of "this is no longer offered".
      resolution: (VIDEO_RESOLUTIONS as readonly string[]).includes(p.video.resolution)
        ? p.video.resolution
        : DEFAULT_VIDEO.resolution,
      duration: (VIDEO_DURATIONS as readonly string[]).includes(p.video.duration)
        ? p.video.duration
        : DEFAULT_VIDEO.duration,
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
      backgroundId: saved.backgroundId,
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
