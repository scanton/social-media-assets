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

import type { ProviderId } from "@/lib/providers";

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
  /**
   * The same step, on Replicate.
   *
   * Not derived from the fal id: the providers publish different models under
   * similar names, and the differences are the kind that fail at submit rather
   * than at compile. Each of these was chosen by reading the model's own
   * published schema —
   *
   *   `openai/gpt-image-2` on Replicate is text-to-image ONLY. It has no image
   *   input at all, so it cannot stand in for the composite step the way its
   *   fal namesake's `/edit` endpoint does.
   *
   *   Both video steps run on `bytedance/seedance-2.5`, read from the API's
   *   own schema rather than off its docs page — which shows a subset, and
   *   which is why an earlier version of this comment claimed 2.5 had no
   *   reference arrays and sent the screen-replace step to 2.0. It has all
   *   three, takes up to 30 seconds where 2.0 stops at 15, and declares no
   *   maximum on `prompt` where 2.0 caps it at 4000 — that cap is what was
   *   cutting the last few hundred characters off a scene prompt, and those
   *   are the clauses keeping content inside the screen.
   */
  replicateFallback: string;
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
  /*
   * Replicate's names sit alongside fal's. Every one of these was read off a
   * real published schema rather than guessed: `image_input` is what
   * nano-banana and seedream call an array of reference images, and
   * `reference_images` / `reference_videos` are seedance-2.0's names for the
   * arrays fal spells `image_urls` / `video_urls`.
   */
  image_urls: ["image_urls", "reference_image_urls", "image_input", "reference_images"],
  video_urls: ["video_urls", "reference_video_urls", "reference_videos"],
  /* Singular to singular, which is the only cross-shape rename that is safe. */
  image_url: ["image_url", "image"],
  num_images: ["num_images", "number_of_images", "max_images"],
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
    replicateFallback: "openai/gpt-image-2",
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
    replicateFallback: "google/nano-banana-pro",
  },
  animate: {
    id: "animate",
    label: "Video",
    blurb: "Animates the finished still into a clip.",
    category: "image-to-video",
    requires: ["prompt", "image_url"],
    fallback: "bytedance/seedance-2.5/image-to-video",
    replicateFallback: "bytedance/seedance-2.5",
  },
  screenReplace: {
    id: "screenReplace",
    label: "Reference video",
    blurb:
      "Plays your card clip on the surface, or opens a printed card to its inside spread. Needs a model that takes both image and video references — very few do.",
    category: "image-to-video",
    requires: ["prompt", "image_urls", "video_urls"],
    fallback: "bytedance/seedance-2.5/reference-to-video",
    replicateFallback: "bytedance/seedance-2.5",
  },
};

/** The shipped default for a step on a given provider. */
export function slotFallback(slot: ModelSlot, provider: ProviderId): string {
  return provider === "replicate" ? slot.replicateFallback : slot.fallback;
}

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
export type ModelChoices = Record<string, string>;

export const MODEL_COOKIE = "heartstamp-models";

/** Falls back per slot, so one unknown id can't strand the whole selection. */
/**
 * A stored choice is per provider, because a model id is.
 *
 * The two catalogues share no ids: picking `google/nano-banana-pro` for the
 * scene step and then switching to fal would submit a model fal has never
 * heard of, and the failure would arrive at render time looking like a bug in
 * the step rather than a stale preference.
 *
 * Keys are `provider:slot`. A bare `slot` key is the pre-provider format and is
 * read as fal's, so nobody's existing choices are lost by this change.
 */
export const choiceKey = (slot: ModelSlotId, provider: ProviderId) => `${provider}:${slot}`;

export function resolveModel(
  choices: ModelChoices,
  slot: ModelSlotId,
  provider: ProviderId = "fal",
): string {
  const chosen =
    choices[choiceKey(slot, provider)] ?? (provider === "fal" ? choices[slot] : undefined);
  return chosen || slotFallback(MODEL_SLOTS[slot], provider);
}

export function parseModelChoices(raw: string | undefined | null): ModelChoices {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: ModelChoices = {};
    /* Both key shapes: bare `slot` (pre-provider, meaning fal) and `provider:slot`. */
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v !== "string" || !v) continue;
      const bare = MODEL_SLOT_IDS.includes(k as ModelSlotId);
      const namespaced = k.includes(":") && MODEL_SLOT_IDS.includes(k.split(":")[1] as ModelSlotId);
      if (bare || namespaced) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}
