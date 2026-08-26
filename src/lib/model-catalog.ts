import "server-only";
import { MODEL_SLOTS, type ModelSlot, type ModelSlotId, inputAliases } from "@/lib/models";
import { readSupports, type ModelSupports } from "@/lib/model-input";

/**
 * Reads fal's model catalogue and works out which models a given step can
 * actually use.
 *
 * Both upstream endpoints are the undocumented ones behind fal.ai's own site,
 * so everything here is defensive: responses are validated rather than trusted,
 * and any failure degrades to "just the default model" instead of throwing. A
 * dead catalogue must never take the studio down with it.
 *
 * Caching leans on Next's Data Cache, which is per-URL and survives cold starts
 * on Vercel. A full sweep is ~15 pages plus one schema fetch per candidate; once
 * warm it costs nothing, and the entries expire a day apart from each other
 * rather than all at once.
 */

const LIST_URL = "https://fal.ai/api/models";
const SCHEMA_URL = "https://fal.ai/api/openapi/queue/openapi.json";

const LIST_TTL = 60 * 60 * 6; // categories gain members often
const SCHEMA_TTL = 60 * 60 * 24; // a published model's inputs rarely move

/** Guard against a paging bug upstream turning into an unbounded fetch loop. */
const MAX_PAGES = 15;

export type CatalogModel = {
  id: string;
  title: string;
  /** fal's own grouping, e.g. "Image Editing" — handy for optgroup-style UI. */
  group?: string;
  description?: string;
  thumbnailUrl?: string;
  /** True for the slot's shipped default, which is always offered. */
  isDefault: boolean;
  /** Which studio controls this model honours — the rest are dropped at submit. */
  supports: ModelSupports;
};

type RawModel = {
  id?: unknown;
  title?: unknown;
  category?: unknown;
  shortDescription?: unknown;
  thumbnailUrl?: unknown;
  group?: { label?: unknown } | null;
  deprecated?: unknown;
  removed?: unknown;
  publishedAt?: unknown;
  date?: unknown;
};

export type InputSchema = {
  properties: Record<string, JsonSchemaProp>;
  required: string[];
};

export type JsonSchemaProp = {
  type?: string;
  /** fal writes one for most inputs; the freeform page shows it as the hint. */
  description?: string;
  title?: string;
  enum?: unknown[];
  default?: unknown;
  maximum?: number;
  minimum?: number;
  maxItems?: number;
  anyOf?: JsonSchemaProp[];
  items?: JsonSchemaProp;
};

/* ----------------------------- catalogue ----------------------------- */

async function fetchCategory(category: string): Promise<RawModel[]> {
  const out: RawModel[] = [];
  let pages = 1;

  for (let page = 1; page <= Math.min(pages, MAX_PAGES); page++) {
    const url = `${LIST_URL}?categories=${encodeURIComponent(category)}&page=${page}`;
    const res = await fetch(url, {
      next: { revalidate: LIST_TTL },
      headers: { accept: "application/json" },
    });
    if (!res.ok) break;

    const body = (await res.json()) as { items?: unknown; pages?: unknown };
    if (!Array.isArray(body.items)) break;
    out.push(...(body.items as RawModel[]));
    if (typeof body.pages === "number") pages = body.pages;
  }

  return out;
}

/**
 * fal serves one OpenAPI document per endpoint. The input schema is the
 * component whose name ends in "Input" — there is no stable key for it, and the
 * document also carries output and error schemas we don't want.
 */
export async function fetchInputSchema(modelId: string): Promise<InputSchema | null> {
  const url = `${SCHEMA_URL}?endpoint_id=${encodeURIComponent(modelId)}`;
  let res: Response;
  try {
    res = await fetch(url, { next: { revalidate: SCHEMA_TTL }, headers: { accept: "application/json" } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let doc: { components?: { schemas?: Record<string, unknown> } };
  try {
    doc = await res.json();
  } catch {
    return null;
  }

  const schemas = doc.components?.schemas ?? {};
  for (const [name, value] of Object.entries(schemas)) {
    const schema = value as { properties?: unknown; required?: unknown };
    if (!name.toLowerCase().endsWith("input") || !schema.properties) continue;
    if (typeof schema.properties !== "object") continue;
    return {
      properties: schema.properties as Record<string, JsonSchemaProp>,
      required: Array.isArray(schema.required) ? (schema.required as string[]) : [],
    };
  }
  return null;
}

const usable = (m: RawModel): m is RawModel & { id: string } =>
  typeof m.id === "string" && Boolean(m.id) && !m.deprecated && !m.removed;

/** Newest first — the whole point of this is trying models as they land. */
function newestFirst(a: RawModel, b: RawModel): number {
  const when = (m: RawModel) => {
    const raw = (typeof m.publishedAt === "string" && m.publishedAt) || (typeof m.date === "string" && m.date);
    const t = raw ? Date.parse(raw) : NaN;
    return Number.isNaN(t) ? 0 : t;
  };
  return when(b) - when(a);
}

/**
 * Every model in the slot's category whose input schema exposes what the step
 * needs to send. Schema checks run concurrently but bounded — one burst of 200
 * outbound requests is a good way to get rate-limited.
 */
export async function compatibleModels(slot: ModelSlot): Promise<CatalogModel[]> {
  const raw = (await fetchCategory(slot.category)).filter(usable).sort(newestFirst);

  const CONCURRENCY = 12;
  const compatible: CatalogModel[] = [];
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      const index = cursor++;
      if (index >= raw.length) return;
      const model = raw[index];

      const schema = await fetchInputSchema(model.id);
      if (!schema) continue;
      if (!slot.requires.every((prop) => inputAliases(prop).some((a) => a in schema.properties))) continue;
      // A required input we have no value for would fail at submit time.
      if (schema.required.some((prop) => !KNOWN_INPUTS.has(prop))) continue;

      compatible.push({
        id: model.id,
        title: typeof model.title === "string" && model.title ? model.title : model.id,
        group: typeof model.group?.label === "string" ? model.group.label : undefined,
        description: typeof model.shortDescription === "string" ? model.shortDescription.trim() : undefined,
        thumbnailUrl: typeof model.thumbnailUrl === "string" ? model.thumbnailUrl : undefined,
        isDefault: model.id === slot.fallback,
        supports: readSupports(schema),
      });
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, raw.length) }, worker));

  // Concurrency scrambles order; restore newest-first, default pinned to top.
  const rank = new Map(raw.map((m, i) => [m.id, i]));
  compatible.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0);
  });

  // The default is offered even if the catalogue is down or has dropped it —
  // the picker must never present an empty list.
  if (!compatible.some((m) => m.isDefault)) {
    compatible.unshift({
      id: slot.fallback,
      title: slot.fallback,
      isDefault: true,
      supports: readSupports(await fetchInputSchema(slot.fallback)),
    });
  }
  return compatible;
}

/**
 * Inputs the studio knows how to produce. A model requiring anything outside
 * this set is filtered out rather than offered and left to fail — which is the
 * difference between a selector that works and one that just looks like it does.
 */
const KNOWN_INPUTS = new Set([
  "prompt",
  "image_url",
  "image_urls",
  "video_url",
  "video_urls",
  "image_size",
  "num_images",
  "quality",
  "output_format",
  "resolution",
  "duration",
  "aspect_ratio",
  "generate_audio",
  "bitrate_mode",
]);

/** True when `modelId` is a legitimate stand-in for `slot`. */
export async function isModelAllowed(modelId: string, slot: ModelSlotId): Promise<boolean> {
  const definition = MODEL_SLOTS[slot];
  if (modelId === definition.fallback) return true;

  const schema = await fetchInputSchema(modelId);
  if (!schema) return false;
  if (!definition.requires.every((prop) => inputAliases(prop).some((a) => a in schema.properties))) return false;
  if (schema.required.some((prop) => !KNOWN_INPUTS.has(prop))) return false;

  // Category membership is the guard that keeps this from being an open proxy
  // to all 1,400 fal endpoints — a matching schema alone is not enough.
  const inCategory = (await fetchCategory(definition.category)).filter(usable);
  return inCategory.some((m) => m.id === modelId);
}


/* --------------------------- the open catalogue --------------------------- */

/**
 * The categories the freeform page may reach.
 *
 * The same guard the slots rely on, written down explicitly: a matching schema
 * alone is not enough to make something safe to proxy, and fal has around 1,400
 * endpoints. These four are the media ones this product is about.
 */
export const OPEN_CATEGORIES = [
  "text-to-image",
  "image-to-image",
  "text-to-video",
  "image-to-video",
] as const;

export type OpenCategory = (typeof OPEN_CATEGORIES)[number];

export const isOpenCategory = (v: unknown): v is OpenCategory =>
  typeof v === "string" && (OPEN_CATEGORIES as readonly string[]).includes(v);

/**
 * Every usable model in a category, with no schema filtering.
 *
 * The slots ask `compatibleModels` for the ones that can take a specific
 * payload. This is the other question: what is there? The freeform page builds
 * its controls from whatever the chosen model actually declares, so a model
 * that takes an unusual set of inputs is interesting rather than disqualified.
 *
 * No per-model schema fetch here either, which is what makes it quick: 200
 * models is 200 outbound requests, and the schema is only needed once someone
 * has picked one.
 */
export async function categoryModels(category: OpenCategory): Promise<CatalogModel[]> {
  const raw = (await fetchCategory(category)).filter(usable).sort(newestFirst);
  return raw.map((m) => ({
    id: m.id as string,
    title: typeof m.title === "string" && m.title ? m.title : (m.id as string),
    group: typeof m.group?.label === "string" ? m.group.label : undefined,
    description: typeof m.shortDescription === "string" ? m.shortDescription.trim() : undefined,
    thumbnailUrl: typeof m.thumbnailUrl === "string" ? m.thumbnailUrl : undefined,
    isDefault: false,
    supports: {
      resolution: false, duration: false, aspectRatio: false,
      audio: false, imageSize: false, numImages: false,
    },
  }));
}

/** True when the model really is in one of the open categories. */
export async function isModelInOpenCategory(modelId: string): Promise<boolean> {
  for (const category of OPEN_CATEGORIES) {
    const inIt = (await fetchCategory(category)).filter(usable);
    if (inIt.some((m) => m.id === modelId)) return true;
  }
  return false;
}
