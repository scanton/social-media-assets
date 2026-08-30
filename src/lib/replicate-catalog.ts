import "server-only";
import type { InputSchema, JsonSchemaProp } from "@/lib/model-catalog";
import { replicateFetch } from "@/lib/replicate-server";

/**
 * Replicate's catalogue, shaped to look like fal's.
 *
 * The two providers organise themselves differently and the studio should not
 * have to care. fal has categories; Replicate has curated collections that
 * cover the same ground under different names, so the mapping below is the
 * whole of the difference for discovery purposes.
 *
 * WHY COLLECTIONS RATHER THAN SEARCH
 * `/search` would return more models, and most of them would be wrong: it
 * matches on text, so asking for "image to video" returns anything whose
 * description says those words, including trainers and utilities. A collection
 * is a human-curated list of models that actually do the thing, which is what
 * the picker is for.
 */

/** fal's category names on the left, the Replicate collection that matches on the right. */
const COLLECTION_FOR: Record<string, string> = {
  "text-to-image": "text-to-image",
  "image-to-image": "image-editing",
  "image-to-video": "image-to-video",
};

export const replicateCollectionFor = (category: string): string | null =>
  COLLECTION_FOR[category] ?? null;

/** What Replicate returns for a model, of which we use a little. */
type ReplicateModel = {
  owner?: unknown;
  name?: unknown;
  description?: unknown;
  cover_image_url?: unknown;
  is_official?: unknown;
  run_count?: unknown;
  latest_version?: { id?: unknown; openapi_schema?: unknown } | null;
};

export type ReplicateListed = {
  /** `owner/name`. The version is resolved at submit time. */
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  isOfficial: boolean;
  runCount: number;
  /** Present on collection responses, which saves a round trip per model. */
  schema: InputSchema | null;
};

/**
 * Pulls the input schema out of a version's OpenAPI document.
 *
 * Replicate names it exactly `Input`, unlike fal where it is
 * `<SomethingLong>Input` and has to be found by suffix. Written defensively
 * anyway: this is parsing someone else's JSON, and a model with no published
 * schema is a model the picker should skip rather than crash on.
 */
export function schemaFromVersion(version: unknown): InputSchema | null {
  const doc = (version as { openapi_schema?: unknown } | null)?.openapi_schema;
  const schemas = (doc as { components?: { schemas?: Record<string, unknown> } } | null)
    ?.components?.schemas;
  const input = schemas?.Input as { properties?: unknown; required?: unknown } | undefined;
  if (!input || typeof input.properties !== "object" || !input.properties) return null;
  return {
    properties: input.properties as Record<string, JsonSchemaProp>,
    required: Array.isArray(input.required) ? (input.required as string[]) : [],
  };
}

const listed = (m: ReplicateModel): ReplicateListed | null => {
  if (typeof m.owner !== "string" || typeof m.name !== "string") return null;
  return {
    id: `${m.owner}/${m.name}`,
    title: `${m.owner}/${m.name}`,
    description: typeof m.description === "string" ? m.description.trim() : undefined,
    thumbnailUrl: typeof m.cover_image_url === "string" ? m.cover_image_url : undefined,
    isOfficial: m.is_official === true,
    runCount: typeof m.run_count === "number" ? m.run_count : 0,
    schema: schemaFromVersion(m.latest_version),
  };
};

/** Everything in the collection that matches a fal category. */
export async function replicateCategoryModels(
  category: string,
  key: string,
): Promise<ReplicateListed[]> {
  const slug = replicateCollectionFor(category);
  if (!slug) return [];
  const body = (await replicateFetch(key, `/collections/${slug}`).catch(() => null)) as {
    models?: ReplicateModel[];
  } | null;
  const models = Array.isArray(body?.models) ? body.models : [];
  return models.map(listed).filter((m): m is ReplicateListed => m !== null);
}

/**
 * One model's input schema, and what a prediction against it needs.
 *
 * `is_official` decides the endpoint: official models are always on and are
 * addressed by name, community models by version id. Getting that wrong is a
 * 404 at submit rather than anything the schema would reveal, so it is read
 * here and carried alongside.
 */
export type ReplicateTarget = {
  schema: InputSchema | null;
  versionId: string | null;
  isOfficial: boolean;
};

export async function replicateModel(modelId: string, key: string): Promise<ReplicateTarget | null> {
  const [owner, name] = modelId.split("/");
  if (!owner || !name) return null;
  const m = (await replicateFetch(key, `/models/${owner}/${name}`).catch(() => null)) as
    | ReplicateModel
    | null;
  if (!m) return null;
  const versionId =
    typeof m.latest_version?.id === "string" ? (m.latest_version.id as string) : null;
  return { schema: schemaFromVersion(m.latest_version), versionId, isOfficial: m.is_official === true };
}

/** Free-text search, for the open bench where the catalogue is the whole point. */
export async function replicateSearch(query: string, key: string): Promise<ReplicateListed[]> {
  const body = (await replicateFetch(
    key,
    `/search?query=${encodeURIComponent(query)}&limit=100`,
  ).catch(() => null)) as { models?: { model?: ReplicateModel }[] } | null;
  const rows = Array.isArray(body?.models) ? body.models : [];
  return rows
    .map((r) => (r?.model ? listed(r.model) : null))
    .filter((m): m is ReplicateListed => m !== null);
}
