/**
 * The four generation steps, and which fal models can stand in for each.
 *
 * Every step used to name one hardcoded endpoint id. It still names one — as the
 * default and the fallback — but the id is now a *choice*, so a model released
 * next month can be tried without a deploy.
 *
 * What makes that safe is `requires`. Models inside a single fal category are
 * not drop-in replacements for one another: Seedance takes `duration: "auto"`,
 * Kling only accepts `"5"` or `"10"` and has no `resolution` at all, Veo 3 wants
 * `"8s"`. So a step only offers models whose input schema actually exposes the
 * properties that step's payload depends on, and lib/model-input.ts reshapes the
 * rest. Schemas are read from fal at runtime, never guessed from this file.
 */

export type ModelSlotId = "baseImage" | "compositeImage" | "animate" | "screenReplace";

export type ModelSlot = {
  id: ModelSlotId;
  label: string;
  /** Shown under the picker. */
  blurb: string;
  /** fal catalogue category a replacement has to come from. */
  category: "text-to-image" | "image-to-image" | "image-to-video";
  /**
   * Input properties the model must expose. These are the ones carrying data
   * that cannot be defaulted away — the prompt and the reference media. Tuning
   * knobs (resolution, duration…) are deliberately absent: those get adapted or
   * dropped, and demanding them would rule out good models for no reason.
   */
  requires: string[];
  /** Ships as the default, and catches any selection we can no longer verify. */
  fallback: string;
};

/**
 * Other names for the same input.
 *
 * A slot says it needs `video_urls`; Seedance calls it that, and Wan, MiniMax
 * and Vidu call the identical thing `reference_video_urls`. Matching on the
 * literal name excluded every one of them from the digital-card pipeline even
 * though they do exactly the job, which read as "only Seedance supports this"
 * when the truth was "only Seedance spells it our way".
 *
 * Aliases are same-shape only. Every name here is an array of strings, like the
 * canonical one, so nothing needs converting when it is renamed. A singular
 * `video_reference_url` is a different shape and deliberately absent: renaming
 * an array onto a string field would submit something the model cannot read.
 */
export const INPUT_ALIASES: Record<string, string[]> = {
  image_urls: ["image_urls", "reference_image_urls"],
  video_urls: ["video_urls", "reference_video_urls"],
};

/** Every name a model might use for this input, canonical first. */
export function inputAliases(key: string): string[] {
  return INPUT_ALIASES[key] ?? [key];
}

export const MODEL_SLOTS: Record<ModelSlotId, ModelSlot> = {
  baseImage: {
    id: "baseImage",
    label: "Scene image",
    blurb: "Builds the lifestyle still from the prompt alone, when no artwork is attached.",
    category: "text-to-image",
    requires: ["prompt"],
    fallback: "openai/gpt-image-2",
  },
  compositeImage: {
    id: "compositeImage",
    label: "Scene image",
    blurb: "Builds the still with your artwork — and your background, if you added one — as references.",
    category: "image-to-image",
    // `image_urls` rather than `image_url`: the step sends up to three
    // references, so a single-image endpoint cannot carry the payload.
    requires: ["prompt", "image_urls"],
    fallback: "openai/gpt-image-2/edit",
  },
  animate: {
    id: "animate",
    label: "Video",
    blurb: "Animates the finished still into a clip.",
    category: "image-to-video",
    requires: ["prompt", "image_url"],
    fallback: "bytedance/seedance-2.5/image-to-video",
  },
  screenReplace: {
    id: "screenReplace",
    label: "Reference video",
    blurb:
      "Plays your card clip on the surface, or opens a printed card to its inside spread. Needs a model that takes both image and video references — very few do.",
    category: "image-to-video",
    requires: ["prompt", "image_urls", "video_urls"],
    fallback: "bytedance/seedance-2.5/reference-to-video",
  },
};

export const MODEL_SLOT_IDS = Object.keys(MODEL_SLOTS) as ModelSlotId[];

export const isModelSlotId = (v: unknown): v is ModelSlotId =>
  typeof v === "string" && v in MODEL_SLOTS;

/** The shipped defaults, still addressable by name. */
export const MODELS = {
  baseImage: MODEL_SLOTS.baseImage.fallback,
  compositeImage: MODEL_SLOTS.compositeImage.fallback,
  animate: MODEL_SLOTS.animate.fallback,
  screenReplace: MODEL_SLOTS.screenReplace.fallback,
} as const;

/** The user's picks, as stored in the preference cookie. */
export type ModelChoices = Partial<Record<ModelSlotId, string>>;

export const MODEL_COOKIE = "heartstamp-models";

/** Falls back per slot, so one unknown id can't strand the whole selection. */
export function resolveModel(choices: ModelChoices, slot: ModelSlotId): string {
  return choices[slot] || MODEL_SLOTS[slot].fallback;
}

export function parseModelChoices(raw: string | undefined | null): ModelChoices {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: ModelChoices = {};
    for (const slot of MODEL_SLOT_IDS) {
      const v = parsed[slot];
      if (typeof v === "string" && v) out[slot] = v;
    }
    return out;
  } catch {
    return {};
  }
}
