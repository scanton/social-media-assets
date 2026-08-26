/**
 * Deck JSON — the contract between the Nugget Builder and the v10 render route.
 *
 * The base shape is the one documented in the skill's
 * `references/motion-and-feedback.md`. This file is the single source of truth
 * for it on the app side; `kit/deck.schema.json`, vendored from the skill, is the same contract for
 * the Node scripts, and both ship in the v10 skill package so neither half can
 * drift from the other.
 *
 * ADDITIONS BEYOND THE DOCUMENTED v9 EXAMPLE
 * The spec (sub-task A1) anticipates three: an explicit `out` per beat, per-beat
 * catalogue IDs, and `protectedRegions`. Two more were needed and are called out
 * here rather than slipped in, per the spec's escalation rule:
 *
 *   `beat.override`  — A5 requires that a dwell trimmed below its computed floor
 *                      is "recorded, not silently applied". The documented schema
 *                      has nowhere to put that, and without it the render route
 *                      has to trust the editor rather than re-check.
 *   `beat.arrow` /
 *   `beat.medallion` — a catalogue ID alone cannot rebuild a compose() call. An
 *                      arrow needs its host and bearing (`from`/`edge`/`at01`/
 *                      `anchor`/`scale`), and `arrows.md` says a popup arrow
 *                      should usually set `over: false`. A medallion needs the
 *                      side it hangs on. Every field here is named after the
 *                      matching option in `references/compose-api.md`, so this
 *                      stays one format rather than a second one.
 */

/** Canvas presets from the kit's `tokens.js` CANVAS table. */
export type CanvasId = "reels" | "youtube" | "square" | "ios" | "desktop";

/**
 * The nine cues in `motion-and-feedback.md`'s sound pack, plus HeartStamp's own
 * two and the sentinel for none. Ours are registered into the kit's table at
 * runtime — see `cues.ts` for why that rather than a fork.
 */
export type SoundCue =
  | "bubble-pop-1"
  | "bubble-pop-2"
  | "pop-in"
  | "pop-in-alt"
  | "pop-out"
  | "stamp"
  | "paper-slide"
  | "seal"
  | "chime"
  | "tick"
  | "soft-error"
  /** The kit's own sentinel for no cue. `feedback.js` names it this, and
   *  `applySoundRules()` writes it when anti-clatter mutes a beat. */
  | "silent";

/**
 * Kept for forward compatibility with a future in-product use, and pinned to
 * "none" here. `motion-and-feedback.md`: "Only in the product. Never on a social
 * asset, because there is nothing to feel." The builder exposes no haptics UI.
 */
export type Haptic = "none";

/** Normalized 0–1 fraction of canvas width/height, so a deck is resolution-independent. */
export interface Anchor {
  x: number;
  y: number;
}

/** A medallion hung on one end of the caption. Mirrors compose()'s `left`/`right`. */
export interface BeatMedallion {
  /** Which end of the caption it hangs off. */
  side: "left" | "right";
  /** One of the 18 frames, catalogue page H. */
  frame: string;
  /** One of the 62 glyphs — 47 occasions, 15 objects. Omit for a plain fill. */
  glyph?: string;
  /** Border treatments, catalogue page I. Up to the 13 in `finish.js`. */
  borders?: string[];
  /** Overrides the colourway's fill for this medallion only. */
  fill?: string;
  /**
   * A picture or clip in the shape instead of a flat fill, which is what
   * `media-wells.md` calls a well: "a medallion with a hole in it". Any of the
   * eighteen shapes takes it, clipped to the inset core.
   *
   * A data URI, always. The reference doc writes it that way and the whole
   * pack works the same: there is no asset server behind any of this, and a
   * deck that points at one would stop rendering the moment it moved.
   * ADDED in v10.
   */
  media?: string;
  /** `xMidYMid slice` by default: fill the shape, crop the overflow. */
  mediaFit?: string;
  /** Set when `media` is a clip rather than a still. See `beatKind`. */
  mediaIsVideo?: boolean;
  /**
   * Glyph size as a fraction of the frame's safe box. compose() defaults to
   * 0.86, which on a circle leaves the artwork at under half the medallion's
   * diameter: the safe box is the inscribed square (68 of 100 units), and the
   * glyph's own SVG reserves a further 17% for its cream halo. ADDED in v10.
   */
  glyphFrac?: number;
}

/**
 * A media well: a shape with a picture or a clip in it.
 *
 * Mirrors the spec `media.js` takes, because that module owns the geometry and
 * the ten named formats. A well is its own kind of beat rather than a medallion
 * carrying media: wells are not square (16:9, 9:16, 4:3, 4:5, and a polaroid
 * with a caption lip), and a medallion is, so the medallion route could not
 * express one whatever size it was given.
 *
 * `medallion.media` is still the right thing for W09, a small picture standing
 * in for the glyph inside a caption nugget. That one really is a medallion.
 * ADDED in v10.
 */
export interface BeatWell {
  /** One of W01..W10, when it came from a template. Kept for the picker. */
  template?: string;
  /**
   * A shape well: one of the eighteen medallion frames holding the media,
   * which `media-wells.md` describes as the other half of the idea. When this
   * is set the well is drawn by compose() rather than by media.js, because a
   * heart or a burst is a frame and not a framed rectangle.
   *
   * The two families are genuinely different components, not one with a longer
   * list: a template well has a caption lip, a kicker and a badge, and a shape
   * well is a shape with a hole in it. ADDED in v10.
   */
  frame?: string;
  /** disc, rounded, wide, portrait, square, polaroid, crt. Template wells only. */
  shape: string;
  kind: "image" | "video";
  /** The picture, or the clip. A data URI: there is no asset server. */
  src?: string;
  /** A still for a clip, used anywhere video cannot be drawn. */
  poster?: string;
  caption?: string;
  kicker?: string;
  badge?: { text: string; bg?: string };
  /** The kit's own multiplier. 1 is the canvas default, and it scales the copy with it. */
  size?: number;
  tilt?: number;
}

/** Mirrors an entry in compose()'s `arrows` array. See `references/arrows.md`. */
export interface BeatArrow {
  /** One of the 34 arrows, catalogue page J. */
  name: string;
  /** Hangs the arrow off that medallion. */
  from?: "left" | "right";
  /** Or off a caption edge, at a fraction along it. */
  edge?: "top" | "bottom" | "left" | "right";
  at01?: number;
  /** Bearing on the host outline. 0 up, 90 right. */
  anchor?: number;
  /** Size as a multiple of the medallion diameter. */
  scale?: number;
  /**
   * Size in canvas px, overriding `scale`. An arrow on its own has no medallion
   * to be a multiple of, so this is how a standalone one is sized. ADDED in v10.
   */
  size?: number;
  /** Clearance before the arrow starts. Widened automatically near a protected region. */
  gap?: number;
  /**
   * False draws the arrow behind the caption so its tail tucks under the edge.
   * `arrows.md` says a popup arrow should usually set this, so the builder
   * defaults it false and only lets a standalone arrow set it true.
   *
   * Superseded by `layer`, which is read first. Kept because v9 decks set it.
   */
  over?: boolean;
  /**
   * Which layer the arrow draws on. ADDED in v10.
   *
   * - `under` — behind the whole caption (what `over: false` meant). The tail
   *   tucks under the shell, but an arrow lying mostly over the caption is
   *   swallowed by it and only the tip shows.
   * - `mid` — above the shell, below the medallion, still beneath the copy.
   *   Visible against the caption without ever covering a word.
   * - `over` — above everything, medallion included.
   */
  layer?: "under" | "mid" | "over";
}

/**
 * A dwell trimmed below its computed floor.
 *
 * Recorded rather than applied silently: `motion-and-feedback.md` calls a
 * sub-floor trim "a flagged compromise, not routine practice", and the render
 * route re-reports it rather than trusting that the editor asked.
 */
export interface BeatOverride {
  dwellFloor: {
    /** Seconds the formula asked for: 2.5 + 0.35 per 10 chars past the first 10. */
    computed: number;
    /** Seconds the deck actually gives it. */
    actual: number;
    reason?: string;
  };
}

export interface Beat {
  id: string;
  /** Entrance, in seconds from the start of the video. */
  t: number;
  /** Exit, in seconds. Explicit rather than inferred, so the render route never guesses. */
  out: number;
  /** Template variant id, e.g. "M01". Carried through from the v9 example. */
  variant?: string;
  /** The copy. Capped at 120 characters — see `annotation-system.md`. */
  text?: string;
  /** Caption shell, catalogue page K. One of 12. */
  caption?: string;
  /**
   * Wrap width in canvas px. compose() defaults it to 62% of canvas width,
   * which on a vertical canvas composes a cluster wider than the frame once a
   * medallion and arrow are attached — so the builder exposes it.
   */
  maxTextW?: number;
  /** Overrides the canvas base font size. The other half of the size dial. */
  fontSize?: number;
  /**
   * Medallion diameter as a multiple of caption height. compose() defaults to
   * 1.52, which makes the medallion the loudest thing in the cluster and, on a
   * 1080px canvas, pushes the whole nugget past the frame. Carried in the deck
   * because the render route has to draw the size that was approved, not the
   * kit default. ADDED in v10.
   */
  medallionScale?: number;
  /**
   * How far the medallion laps over the caption end. compose() defaults to
   * 0.30. Moves the medallion along the caption; it does not change the gap
   * between the medallion and the text, because compose() widens the caption's
   * text inset by the same amount to keep the copy clear. ADDED in v10.
   */
  overlap?: number;
  /**
   * Caption padding on one end only, in px, overriding the shell's own.
   *
   * This is the dial that sets the medallion-to-text gap. compose() seats the
   * text a constant distance from the medallion regardless of medallion size,
   * and the padding is the only term in that distance which does not scale
   * with the medallion — so it is the only way to bring a small medallion
   * nearer its copy. Per-end because the kit's single `captionPadX` closes the
   * gap on the medallion's side and drags the far end in by the same amount,
   * pushing the copy hard against it. Set only the end the medallion is on.
   * ADDED in v10.
   */
  captionPadL?: number;
  captionPadR?: number;
  /** Colourway. One of 8; sets every part at once. */
  colorway?: string;
  align?: "left" | "center" | "right";
  anchor: Anchor;
  rotate?: number;
  medallion?: BeatMedallion;
  /** Present on a well beat. See `BeatWell`. */
  well?: BeatWell;
  arrows?: BeatArrow[];
  cue?: SoundCue;
  haptic?: Haptic;
  override?: BeatOverride;
}

/**
 * A rectangle an arrow tip must not land on or near — a watermark, a wordmark,
 * on-screen text.
 *
 * New in v10. It is the systematic fix for the arrow-over-the-logo failure this
 * spec was written around: `arrows.md`'s "Small subjects need a wider gap" was
 * documented but nothing enforced it. Coordinates are normalized like `Anchor`.
 * `from`/`to` are optional seconds; omit both for a mark that is on screen the
 * whole time.
 */
export interface ProtectedRegion {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  from?: number;
  to?: number;
  label?: string;
}

export interface Deck {
  /** Schema version, so the render route can refuse a deck it predates. */
  v: 1;
  id: string;
  canvas: CanvasId;
  fps: number;
  /** The paired video. Same basename as the deck file, per the export contract. */
  video: {
    filename: string;
    duration: number;
    width: number;
    height: number;
  };
  beats: Beat[];
  protectedRegions?: ProtectedRegion[];
}

/* ------------------------------ the rules ------------------------------ */

/** `annotation-system.md`: 44 pixels is still the gate. */
export const CAPTION_MAX_CHARS = 120;

/** compose()'s own medallion-to-caption ratio, for reference in the UI. */
export const MEDALLION_SCALE_KIT_DEFAULT = 1.52;

/**
 * What the builder opens a new beat at. Below the kit default on purpose: 1.52
 * is tuned for a medallion that carries the beat, and most nuggets are a
 * caption with a medallion attached, not the other way round.
 */
export const MEDALLION_SCALE_DEFAULT = 1.15;

/** compose()'s own glyph fraction. */
export const GLYPH_FRAC_KIT_DEFAULT = 0.86;

/**
 * What the builder opens a medallion at. Above the kit default because 0.86
 * fills less than half a circle's diameter once the glyph's halo margin is
 * taken off; 1.25 fills it without breaching the frame on any of the 18 shapes.
 */
export const GLYPH_FRAC_DEFAULT = 1.25;

/** Cues closer than this collide; the second is silenced. `applySoundRules()`. */
export const ANTI_CLATTER_MS = 250;

/**
 * Picker order, which is not the same thing as the default.
 *
 * Silence leads because it is the most reached-for entry once a deck gets
 * dense — the sound pack's own advice is that most nuggets in a sequence want
 * no cue — and hunting to the bottom of the list for it is friction on the
 * choice people make most. What a new beat OPENS on is `DEFAULT_CUE`, which is
 * a separate decision and still a bubble pop.
 */
export const SOUND_CUES: SoundCue[] = [
  "silent",
  "bubble-pop-1", "bubble-pop-2",
  "pop-in", "pop-in-alt", "pop-out", "stamp", "paper-slide",
  "seal", "chime", "tick", "soft-error",
];

/**
 * `motion-and-feedback.md` gives a pointer 15 frames of lead at 30fps, and says
 * it compresses "toward 5 to 8 frames before 'point, then tell' stops reading
 * as two separate moments". Five frames is the floor that leaves.
 */
export const POINTER_LEAD_MIN_S = 5 / 30;

export type BeatKind = "nugget" | "well" | "arrow";

/**
 * Which of the three shapes a beat is, read off what it carries.
 *
 * Inferred rather than declared, because a `kind` field could disagree with the
 * beat's own contents and then two things would be true at once. The spec is
 * also explicit about not growing a second config format alongside this one.
 *
 * It decides which floor applies, and the floors are about different things: a
 * nugget's is reading time, a well's is looking time, and an arrow points at
 * something rather than being read at all.
 */
export function beatKind(beat: Pick<Beat, "text" | "medallion" | "arrows" | "well">): BeatKind {
  if (beat.well) return "well";
  if (beat.text && beat.text.trim()) return "nugget";
  if (beat.medallion) return "well";
  if (beat.arrows?.length) return "arrow";
  return "nugget";
}

/**
 * What a new beat should run for, given its copy.
 *
 * The floor rounded up to the next tenth. A beat created exactly at its floor
 * is technically legal but sits one nudge away from illegal, so the first drag
 * of the out edge fires the override dialog, and an override prompt on a beat
 * nobody has deliberately squeezed teaches people to dismiss the one that
 * matters. The rounding buys visible headroom instead.
 */
export function defaultDwellSeconds(text: string | undefined): number {
  return Math.ceil(dwellFloorSeconds(text) * 10) / 10;
}

/**
 * `2.5s + 0.35s per additional 10 characters past the first 10`.
 *
 * Computed, never guessed — and a floor, not a target. Empty copy still needs
 * the base: a medallion-and-arrow beat has to be readable too.
 */
export function dwellFloorSeconds(text: string | undefined): number {
  const chars = (text ?? "").length;
  const past = Math.max(0, chars - 10);
  return 2.5 + 0.35 * (past / 10);
}

/**
 * The floor for a beat, whichever kind it is.
 *
 * A nugget and a well both answer to the dwell rule: one is being read, the
 * other looked at, and 2.5s is the base either way. An arrow is neither. It
 * points, and `motion-and-feedback.md` measures a pointer in lead frames rather
 * than dwell seconds, so holding a bare arrow on screen for two and a half
 * seconds would be applying the wrong rule rather than a strict one.
 */
export function floorForBeat(beat: Pick<Beat, "text" | "medallion" | "arrows">): number {
  return beatKind(beat) === "arrow" ? POINTER_LEAD_MIN_S : dwellFloorSeconds(beat.text);
}
