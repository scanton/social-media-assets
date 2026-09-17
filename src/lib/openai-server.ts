import "server-only";
import { cookies } from "next/headers";
import { PROVIDERS } from "@/lib/providers";
import { MissingKeyError } from "@/lib/fal-server";
import { requireReplicateKey } from "@/lib/replicate-server";

/**
 * Rendering images on the user's own OpenAI account.
 *
 * The third provider, and the first that is not a job queue. fal and Replicate
 * both take a POST, hand back an id, and are polled; OpenAI's Images API
 * answers with the picture. That difference is absorbed at the submit route,
 * which returns the finished data inline — see `submitToProvider`.
 *
 * WHY NOT THE GENERIC ADAPTER
 * model-input.ts exists to fit one payload to any of fal's ~1,400 published
 * schemas, which is a real problem worth a general solution. This is three
 * models with one hand-written contract and no published JSON Schema to adapt
 * against, so the mapping is written out. A general adapter pointed at a schema
 * invented here would only be guessing with extra steps.
 *
 * VERIFIED AGAINST THE DOCUMENTATION, NOT A LIVE KEY. Every other provider in
 * this codebase was pinned down by querying its API, which is the habit that
 * has caught the most mistakes — but that needs a key, and asking for one to
 * write the integration is not a trade worth making. The model ids, the size
 * rule and the quality list below all come from OpenAI's own reference; the
 * first real render is what confirms them.
 */

const API = "https://api.openai.com/v1";

export async function readOpenAIKey(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(PROVIDERS.openai.cookie)?.value?.trim();
  return value ? value : null;
}

export async function requireOpenAIKey(): Promise<string> {
  const key = await readOpenAIKey();
  if (!key) throw new MissingKeyError("openai");
  return key;
}

/* ----------------------------- the models ---------------------------- */

/**
 * What the studio offers on this provider.
 *
 * A fixed list, because OpenAI publishes no machine-readable schema for these
 * and `/v1/models` needs the user's key to read — so a catalogue fetch would
 * cost a round trip and a key to return something already known. Flare first:
 * it is the default everywhere else in the studio.
 */
export const OPENAI_IMAGE_MODELS = [
  {
    id: "gpt-image-2.5-flare",
    label: "GPT Image 2.5 Flare",
    description: "Fast, high-quality everyday generation and editing. The studio default.",
  },
  {
    id: "gpt-image-2.5-sunburst",
    label: "GPT Image 2.5 Sunburst",
    description: "Slower, and better where editing precision matters most.",
  },
  {
    id: "gpt-image-2",
    label: "GPT Image 2",
    description: "The previous generation. Cheaper, and what earlier decks were drawn with.",
  },
] as const;

export const isOpenAIImageModel = (id: string) =>
  OPENAI_IMAGE_MODELS.some((m) => m.id === id);

/* ------------------------- shaping the request ------------------------ */

/** OpenAI's own values. `auto` lets the model decide, which is our default. */
const QUALITY = new Set(["auto", "low", "medium", "high", "xhigh", "max"]);

/**
 * Turns the studio's canonical size into OpenAI's `size` string.
 *
 * Three rules, and breaking any one of them is a 400 rather than a smaller
 * picture: both edges must divide by 16, the aspect must sit between 1:3 and
 * 3:1, and the string is `WIDTHxHEIGHT`. The studio's own resolutions do not
 * naturally land on multiples of 16 — 1080 does not — so they are rounded here
 * rather than being sent and rejected.
 */
export function openAISize(input: Record<string, unknown>): string | undefined {
  const size = input.image_size;
  let w: number | undefined;
  let h: number | undefined;

  if (size && typeof size === "object") {
    const o = size as { width?: unknown; height?: unknown };
    if (typeof o.width === "number" && typeof o.height === "number") {
      w = o.width;
      h = o.height;
    }
  }
  if (typeof size === "string") {
    // The named fal sizes, as aspect ratios at a sane long edge.
    const named: Record<string, [number, number]> = {
      square: [1024, 1024],
      square_hd: [1024, 1024],
      portrait_4_3: [1024, 1360],
      portrait_16_9: [1024, 1808],
      landscape_4_3: [1360, 1024],
      landscape_16_9: [1808, 1024],
    };
    const hit = named[size];
    if (hit) [w, h] = hit;
  }
  if (w === undefined || h === undefined) return undefined;

  /*
   * Round FIRST, then bring the ratio inside 1:3..3:1.
   *
   * The other order looks more natural and is wrong: clamping to exactly 3:1
   * and then rounding each edge to a multiple of 16 can land at 3.01, which is
   * outside the range and a 400. Correcting after the rounding means the number
   * that gets sent is the number that was checked.
   *
   * Corrected by growing the short edge rather than shrinking the long one, so
   * a deliberately wide crop stays as wide as it was asked to be.
   */
  const to16 = (n: number) => Math.max(256, Math.round(n / 16) * 16);
  w = to16(w);
  h = to16(h);
  // Bounded: each step moves 16px and the ratio is finite, so this lands.
  for (let i = 0; i < 512 && w / h > 3; i++) h += 16;
  for (let i = 0; i < 512 && w / h < 1 / 3; i++) w += 16;
  return `${w}x${h}`;
}

export interface OpenAIImageRequest {
  model: string;
  prompt: string;
  size?: string;
  quality?: string;
  n?: number;
  output_format?: string;
  /** Reference images, as URLs the server will fetch. Edits only. */
  imageUrls: string[];
}

/**
 * The studio's payload, in OpenAI's names.
 *
 * Anything the Images API has no opinion about is dropped rather than passed
 * through — an unknown field is a 400 there, not an ignored one, which is the
 * opposite of how fal and Replicate behave and the thing most likely to bite
 * when a new control is added upstream.
 */
export function toOpenAIRequest(model: string, input: Record<string, unknown>): OpenAIImageRequest {
  const prompt = typeof input.prompt === "string" ? input.prompt : "";
  const quality = typeof input.quality === "string" && QUALITY.has(input.quality)
    ? input.quality
    : undefined;
  const nRaw = input.num_images;
  const n = typeof nRaw === "number" && nRaw >= 1 ? Math.min(10, Math.round(nRaw)) : undefined;

  const urls = Array.isArray(input.image_urls)
    ? (input.image_urls as unknown[]).filter((u): u is string => typeof u === "string")
    : typeof input.image_url === "string"
      ? [input.image_url]
      : [];

  return {
    model,
    prompt,
    size: openAISize(input),
    quality,
    n,
    output_format: typeof input.output_format === "string" ? input.output_format : undefined,
    imageUrls: urls,
  };
}

/* ------------------------------ calling ------------------------------ */

type ImagesResponse = { data?: { b64_json?: string; url?: string; revised_prompt?: string }[] };

async function readError(res: Response): Promise<never> {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body?.error?.message ?? "";
  } catch {
    /* not JSON */
  }
  throw new Error(detail || `OpenAI rejected the request (${res.status}).`);
}

/**
 * The finished image, in the shape the rest of the studio already reads.
 *
 * Data URIs rather than links, because that is all there is: these models
 * return base64 and host nothing. It is the same position Replicate's renders
 * are in, and the client handles it the same way — see render-store.ts.
 */
function toStudioOutput(body: ImagesResponse, format: string): { images: { url: string }[] } {
  const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
  const images = (body.data ?? [])
    .map((d) => (d.b64_json ? `data:${mime};base64,${d.b64_json}` : d.url))
    .filter((u): u is string => typeof u === "string" && u.length > 0)
    .map((url) => ({ url }));
  if (!images.length) throw new Error("OpenAI returned no image.");
  return { images };
}

export async function renderWithOpenAI(
  key: string,
  model: string,
  input: Record<string, unknown>,
): Promise<{ images: { url: string }[] }> {
  const req = toOpenAIRequest(model, input);
  if (!req.prompt) throw new Error("A prompt is required.");
  const format = req.output_format ?? "png";

  /*
   * Two endpoints, chosen by whether there are references — the same split fal
   * makes with its `/edit` variant. Generations takes JSON; edits takes
   * multipart, because it is carrying files.
   */
  if (!req.imageUrls.length) {
    const res = await fetch(`${API}/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.model,
        prompt: req.prompt,
        ...(req.size ? { size: req.size } : {}),
        ...(req.quality ? { quality: req.quality } : {}),
        ...(req.n ? { n: req.n } : {}),
        ...(req.output_format ? { output_format: req.output_format } : {}),
      }),
    });
    if (!res.ok) await readError(res);
    return toStudioOutput((await res.json()) as ImagesResponse, format);
  }

  /*
   * References arrive as URLs — fal's CDN, usually — and OpenAI wants bytes, so
   * they are fetched here and forwarded. That is the one place this provider
   * costs meaningfully more than the others: the images travel through our
   * function rather than being handed over as links.
   */
  const form = new FormData();
  form.append("model", req.model);
  form.append("prompt", req.prompt);
  if (req.size) form.append("size", req.size);
  if (req.quality) form.append("quality", req.quality);
  if (req.n) form.append("n", String(req.n));
  if (req.output_format) form.append("output_format", req.output_format);

  for (const [i, url] of req.imageUrls.entries()) {
    /*
     * A reference can be anywhere the upload route put it. fal's CDN is public
     * and needs nothing; Replicate's file store is auth-gated and 401s a plain
     * fetch, which would surface as "a reference image could not be read" with
     * no hint that a credential was the problem. So the key goes on when the
     * URL is theirs.
     */
    const onReplicate = url.startsWith("https://api.replicate.com/");
    const headers = onReplicate
      ? { Authorization: `Bearer ${await requireReplicateKey()}` }
      : undefined;
    const got = await fetch(url, headers ? { headers } : undefined);
    if (!got.ok) throw new Error(`A reference image could not be read (${got.status}).`);
    const blob = await got.blob();
    // `image[]` rather than `image`: the edits endpoint takes an array, and the
    // studio's composite step sends up to three.
    form.append("image[]", blob, `reference-${i + 1}.png`);
  }

  const res = await fetch(`${API}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) await readError(res);
  return toStudioOutput((await res.json()) as ImagesResponse, format);
}
