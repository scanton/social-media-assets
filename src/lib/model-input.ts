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

/**
 * Flattens a union so a property declared as one is inspected as a whole.
 *
 * `anyOf` is how fal declares a nullable or multi-typed input. `allOf` is how
 * Cog — and therefore every Replicate model — points at an enum it defined
 * elsewhere. Those refs are inlined when the schema is read, so this should
 * rarely see one; it looks anyway, because the cost is a property access and
 * the failure mode is an enum silently becoming a free-text field.
 */
function branches(prop: JsonSchemaProp): JsonSchemaProp[] {
  const union = prop.anyOf?.length ? prop.anyOf : prop.allOf;
  return union?.length ? [prop, ...union] : [prop];
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

/**
 * True when the property will only accept a number.
 *
 * `null` branches are ignored: a nullable integer is still an integer as far as
 * a string value is concerned.
 */
function numericOnly(prop: JsonSchemaProp): boolean {
  const declared = branches(prop)
    .map((b) => b.type)
    .filter((t): t is string => typeof t === "string" && t !== "null");
  return declared.length > 0 && declared.every((t) => t === "integer" || t === "number");
}

/**
 * Trims to whole clauses, keeping the front.
 *
 * Only ". " counts as a boundary — that is how joinPrompts glues clauses
 * together. A comma is not one: cutting there leaves "No finger, thumb or
 * stylus ever enters", which is not a shortened instruction but a different
 * one, and it still reads as something to obey.
 *
 * If no clause boundary sits in the last 40% the text is not clause-shaped, so
 * it falls back to a word boundary. Ragged, but never a fragment posing as a
 * rule.
 */
function fitText(value: string, max: number): string {
  if (value.length <= max) return value;
  const head = value.slice(0, max);
  const clause = head.lastIndexOf(". ");
  if (clause > max * 0.6) return head.slice(0, clause + 1);
  const word = head.lastIndexOf(" ");
  return (word > 0 ? head.slice(0, word) : head).trimEnd();
}

/** A bound, wherever in the union it was declared. */
function bound(prop: JsonSchemaProp, key: "minimum" | "maximum" | "maxLength"): number | undefined {
  for (const b of branches(prop)) {
    if (typeof b[key] === "number") return b[key];
  }
  return undefined;
}

function fit(value: number, prop: JsonSchemaProp): number {
  let n = value;
  const max = bound(prop, "maximum");
  const min = bound(prop, "minimum");
  if (typeof max === "number") n = Math.min(n, max);
  if (typeof min === "number") n = Math.max(n, min);
  // An integer field rejects 7.5 for the same reason it rejects "auto".
  return branches(prop).some((b) => b.type === "integer") ? Math.round(n) : n;
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

  /*
   * A string aimed at a numeric property.
   *
   * The studio's tuning values are strings because the model this pipeline grew
   * up around spells them that way — Seedance declares `duration` as an enum of
   * `"auto"`, `"4"`, `"5"`… A model that declares it as a plain integer can read
   * neither form: `"8"` needs converting, and `"auto"` has no integer in it at
   * all.
   *
   * This used to fall through the bottom of the function untouched, so the
   * string went out as-is and fal rejected the whole job before rendering a
   * frame:
   *
   *   duration: Input should be a valid integer, unable to parse string
   *
   * Recover the magnitude where there is one, and drop the property where there
   * is not so the model's own default applies — which is what `"auto"` was
   * asking for. That is the rule this file already claimed to follow.
   */
  if (typeof value === "string" && numericOnly(prop)) {
    const n = magnitude(value);
    return n === null ? undefined : fit(n, prop);
  }

  if (typeof value === "number") {
    return fit(value, prop);
  }

  /*
   * A string longer than the model will take.
   *
   * fal's seedance declares no limit on `prompt`; Replicate's caps it at 4000,
   * and the studio's scene prompts run close to that once styling, presence and
   * a motion are all in play. Unhandled, the whole render is refused with
   * "String length must be less than or equal to 4000" — after the click, and
   * with nothing said about which field or by how much.
   *
   * Cut at a sentence boundary rather than at the character. These prompts are
   * a list of clauses joined with ". ", and several of the last ones are the
   * rules that exist because renders broke without them — the screen being a
   * hard clipping boundary, nobody touching the glass. Half of one of those is
   * worse than none of it: a fragment still reads as an instruction.
   *
   * What was dropped is reported rather than swallowed. `coerced` is already
   * shown, so the answer to "why does this look different on Replicate" is on
   * screen instead of in a schema nobody reads.
   */
  if (typeof value === "string") {
    const max = bound(prop, "maxLength");
    if (typeof max === "number" && value.length > max) return fitText(value, max);
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
      /*
       * A shortened prompt is reported by how much, not by quoting both copies
       * of it. "prompt a photorealistic live-action clip of… → a photorealistic
       * live-action clip of…" is four thousand characters that say nothing.
       */
      const shortened =
        typeof value === "string" && typeof next === "string" && next.length < value.length;
      coerced.push(
        shortened
          ? `${key} shortened by ${(value as string).length - (next as string).length} characters ` +
            `to fit this model's limit`
          : `${key} ${String(value)} → ${String(next)}`,
      );
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

/**
 * What the model says about the reference clips it will accept.
 *
 * This is prose, not schema. fal expresses "up to three seconds" in a
 * `description` and enforces it at submit — nothing in the JSON Schema says so,
 * so no amount of adapting can satisfy it and the studio cannot know it is
 * about to fail. Gemini Omni Flash caps reference video at three seconds; a
 * digital card animation is two to fifteen, sweet spot eight to thirteen. Every
 * render on that pairing is rejected, and the only signal was a validation
 * error after the fact.
 *
 * So the sentence is lifted out and shown in the picker. Only the ones
 * mentioning seconds: the rest of the description is format and file-size trivia
 * that has never been the thing that failed, and a paragraph nobody reads warns
 * about nothing.
 *
 * Deliberately not parsed into a number. The phrasings in the catalogue include
 * "at most three seconds", "between 2 and 15 seconds" and "2-15 seconds each,
 * combined duration at most 15 seconds" — word numerals, ranges, and per-clip
 * versus combined. A parser would be wrong quietly, which is worse than the
 * model's own words being shown as it wrote them.
 */
export function readClipLimit(schema: InputSchema | null): string | undefined {
  if (!schema) return undefined;
  const name = inputAliases("video_urls").find((a) => a in schema.properties);
  const description = name ? schema.properties[name]?.description : undefined;
  if (!description) return undefined;

  const limits = description
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /\bseconds?\b/i.test(sentence));

  return limits.length ? limits.join(" ") : undefined;
}
