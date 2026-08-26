import type { InputSchema, JsonSchemaProp } from "@/lib/model-catalog";
import { inputAliases } from "@/lib/models";

/**
 * Reshapes the studio's canonical payload to fit whatever model was picked.
 *
 * The studio always describes a job the same way — prompt, references, 1080p,
 * eight seconds, 9:16 — and this projects that onto the target's real schema.
 * Nothing here guesses: every decision comes from the model's own OpenAPI
 * document.
 *
 * Three rules, in order of how often they matter:
 *
 *   drop    — a property the model has never heard of (`bitrate_mode` outside
 *             Seedance) is removed, not passed through and hoped for.
 *   coerce  — an enum we're not a member of gets the nearest legal value, so
 *             `duration: "8"` reaches Veo 3 as `"8s"` and Kling as `"10"`.
 *   default — when nothing sensible maps, the property is omitted entirely and
 *             the model's own default applies. Omitting beats guessing.
 */

/** Tokens whose numeric magnitude isn't recoverable by stripping non-digits. */
const MAGNITUDE: Record<string, number> = {
  "4k": 2160,
  "2k": 1440,
  "8k": 4320,
};

function magnitude(value: string): number | null {
  const key = value.trim().toLowerCase();
  if (key in MAGNITUDE) return MAGNITUDE[key];
  const digits = key.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) ? n : null;
}

/** Flattens `anyOf` so a property declared as a union is inspected as a whole. */
function branches(prop: JsonSchemaProp): JsonSchemaProp[] {
  return prop.anyOf?.length ? [prop, ...prop.anyOf] : [prop];
}

function enumValues(prop: JsonSchemaProp): unknown[] | null {
  for (const branch of branches(prop)) {
    if (Array.isArray(branch.enum) && branch.enum.length) return branch.enum;
  }
  return null;
}

/**
 * True when the property can hold a `{ width, height }` object.
 *
 * Image models declare `image_size` as `anyOf[$ref ImageSize, enum]`. We can't
 * follow the `$ref` from here, but a branch we can't read is exactly the object
 * branch — an unreadable branch means "object allowed" rather than "reject".
 */
function acceptsObject(prop: JsonSchemaProp): boolean {
  return branches(prop).some((b) => b.type === "object" || (!b.type && !b.enum && !b.anyOf));
}

/** Picks the enum member closest in magnitude — `"8"` → `"8s"`, `"4k"` → `"1080p"`. */
function nearestEnum(value: unknown, options: unknown[]): unknown | undefined {
  if (options.includes(value)) return value;
  if (typeof value !== "string" && typeof value !== "number") return undefined;

  const target = magnitude(String(value));
  if (target === null) return undefined;

  let best: unknown;
  let bestDistance = Infinity;
  for (const option of options) {
    if (typeof option !== "string" && typeof option !== "number") continue;
    const m = magnitude(String(option));
    if (m === null) continue;
    const distance = Math.abs(m - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = option;
    }
  }
  return best;
}

function coerce(value: unknown, prop: JsonSchemaProp): unknown | undefined {
  if (value === undefined || value === null) return undefined;

  const options = enumValues(prop);
  if (options) {
    // `"auto"` has no magnitude, so a model without it simply loses the
    // property and applies its own default — which is what auto meant anyway.
    return nearestEnum(value, options);
  }

  if (Array.isArray(value)) {
    if (!branches(prop).some((b) => b.type === "array" || !b.type)) return undefined;
    const max = prop.maxItems ?? prop.anyOf?.find((b) => b.maxItems)?.maxItems;
    return typeof max === "number" && value.length > max ? value.slice(0, max) : value;
  }

  if (typeof value === "object") {
    return acceptsObject(prop) ? value : undefined;
  }

  if (typeof value === "number") {
    let n = value;
    if (typeof prop.maximum === "number") n = Math.min(n, prop.maximum);
    if (typeof prop.minimum === "number") n = Math.max(n, prop.minimum);
    return n;
  }

  if (typeof value === "boolean") {
    return branches(prop).some((b) => b.type === "boolean" || !b.type) ? value : undefined;
  }

  return value;
}

export type AdaptResult = {
  input: Record<string, unknown>;
  /** Properties the model doesn't expose, or whose value had no legal analogue. */
  dropped: string[];
  /** `["duration 8 → 8s"]` — what the model will actually run. */
  coerced: string[];
};

export function adaptInput(
  input: Record<string, unknown>,
  schema: InputSchema | null,
): AdaptResult {
  // No schema means fal is unreachable or shapeless; the payload is already
  // correct for the default model, so pass it through untouched.
  if (!schema) return { input, dropped: [], coerced: [] };

  const out: Record<string, unknown> = {};
  const dropped: string[] = [];
  const coerced: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    /*
     * The model may call this input something else.
     *
     * Wan, MiniMax and Vidu take the same array of reference URLs Seedance
     * does and name it `reference_video_urls`. Sending our name would drop the
     * references silently and render a clip with nothing referenced, which is
     * a far worse failure than refusing the model outright, so the rename has
     * to happen here as well as in the matching.
     */
    const name = inputAliases(key).find((a) => a in schema.properties) ?? key;
    const prop = schema.properties[name];
    if (!prop) {
      dropped.push(key);
      continue;
    }
    const next = coerce(value, prop);
    if (next === undefined) {
      dropped.push(key);
      continue;
    }
    if (next !== value && typeof next !== "object") {
      coerced.push(`${key} ${String(value)} → ${String(next)}`);
    }
    if (name !== key) coerced.push(`${key} sent as ${name}`);
    out[name] = next;
  }

  return { input: out, dropped, coerced };
}

/**
 * Which of the studio's tuning controls a model honours.
 *
 * Surfaced in the picker so "this one ignores your aspect ratio" is visible
 * before spending a render, not inferred from a disappointing result.
 */
export type ModelSupports = {
  resolution: boolean;
  duration: boolean;
  aspectRatio: boolean;
  audio: boolean;
  imageSize: boolean;
  numImages: boolean;
};

export function readSupports(schema: InputSchema | null): ModelSupports {
  const has = (key: string) => Boolean(schema?.properties[key]);
  return {
    resolution: has("resolution"),
    duration: has("duration"),
    aspectRatio: has("aspect_ratio"),
    audio: has("generate_audio"),
    imageSize: has("image_size"),
    numImages: has("num_images"),
  };
}
