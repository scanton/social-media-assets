/**
 * The places a render can happen.
 *
 * The studio was built against fal, and every generation still describes the
 * same job in the same shape: a prompt, some reference URLs, a resolution, a
 * duration. What differs between providers is where that job is posted, what
 * the inputs are called, and how the answer comes back — and all three of those
 * are already things this codebase knows how to absorb. `model-input.ts` fits
 * the payload to whatever schema it is handed, and both providers publish JSON
 * Schema. So a provider is a small amount of plumbing rather than a second
 * pipeline.
 *
 * WHY A TOGGLE RATHER THAN A FALLBACK
 * Automatic failover sounds better than it is: a render that fails halfway is
 * ambiguous, retrying it elsewhere can bill twice for one asset, and an asset
 * roll where nothing records which provider drew what is a roll nobody can
 * reason about. One provider is active at a time and the header says which.
 */

export type ProviderId = "fal" | "replicate" | "openai";

/** The two kinds of work, and the axis the provider choice runs along. */
export type Capability = "image" | "video";

export interface ProviderSpec {
  id: ProviderId;
  /** How the provider names itself. Used in copy, so it is their spelling. */
  label: string;
  /** Where a user goes to mint a key. */
  keysUrl: string;
  /** Placeholder in the key dialog — the shape of a real key, not a real one. */
  keyExample: string;
  /** httpOnly, holds the key itself. */
  cookie: string;
  /** Readable, holds only the last few characters so the header can say "connected". */
  hintCookie: string;
  /**
   * A cheap shape check, so an obvious paste error fails in the dialog instead
   * of three steps into a render. Deliberately loose: the real gate is the
   * probe against the provider, and a regex that is too clever rejects the
   * valid key somebody actually has.
   */
  looksLikeKey: (value: string) => boolean;
  /**
   * What this provider is asked to do.
   *
   * The first two do both, so until now "the active provider" could stand for
   * the whole pipeline. OpenAI's image API is images and nothing else, which
   * makes the provider a per-capability choice rather than a global one — see
   * `providerFor`.
   */
  does: { image: boolean; video: boolean };
}

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  fal: {
    id: "fal",
    label: "fal.ai",
    keysUrl: "https://fal.ai/dashboard/keys",
    keyExample: "a1b2c3d4-…:9f8e7d6c5b4a…",
    cookie: "hs_fal_key",
    hintCookie: "hs_fal_hint",
    // fal keys are `<uuid>:<hex secret>`.
    looksLikeKey: (v) => /^[A-Za-z0-9-]{8,}:[A-Za-z0-9]{16,}$/.test(v.trim()),
    does: { image: true, video: true },
  },
  replicate: {
    id: "replicate",
    label: "Replicate",
    keysUrl: "https://replicate.com/account/api-tokens",
    keyExample: "r8_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    cookie: "hs_replicate_key",
    hintCookie: "hs_replicate_hint",
    /*
     * Replicate tokens have historically been `r8_…`, but that prefix is not
     * documented as a guarantee and a token minted before or after that
     * convention would be refused by a regex that insists on it. So: one
     * opaque run of token characters, long enough to not be a typo, and no
     * colon — which is the one thing that would mean a fal key was pasted into
     * the wrong box.
     */
    looksLikeKey: (v) => /^[A-Za-z0-9_-]{20,}$/.test(v.trim()),
    does: { image: true, video: true },
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    keysUrl: "https://platform.openai.com/api-keys",
    keyExample: "sk-proj-XXXXXXXXXXXXXXXXXXXXXXXX",
    cookie: "hs_openai_key",
    hintCookie: "hs_openai_hint",
    /*
     * `sk-` is OpenAI's long-standing prefix and `sk-proj-` its project-scoped
     * form, but the rest is opaque and the length has changed more than once.
     * Loose on purpose, like the others: the real gate is the request, and a
     * regex tight enough to be satisfying is tight enough to refuse somebody's
     * actual key.
     */
    looksLikeKey: (v) => /^sk-[A-Za-z0-9_-]{20,}$/.test(v.trim()),
    // Images only. The Images API has no video endpoint at all.
    does: { image: true, video: false },
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export const isProviderId = (v: unknown): v is ProviderId =>
  typeof v === "string" && v in PROVIDERS;

/**
 * Which provider the studio is pointed at — one answer per capability.
 *
 * Readable rather than httpOnly: it is a preference, not a secret, and the
 * header has to render the current one before any request goes out.
 *
 * Two cookies rather than one, because the two choices are genuinely
 * independent. Drawing on OpenAI says nothing about where a clip should be
 * rendered, and the single cookie made that a consequence rather than a
 * decision — video "fell" to Replicate because OpenAI could not do it, which is
 * the right default and the wrong way to arrive at it.
 */
export const IMAGE_PROVIDER_COOKIE = "hs_provider_image";
export const VIDEO_PROVIDER_COOKIE = "hs_provider_video";

/**
 * The cookie the studio used when one provider served everything.
 *
 * Read as a fallback so a browser that has been here before keeps the provider
 * it chose, rather than being silently moved to the new defaults the first time
 * it loads. Never written.
 */
export const LEGACY_PROVIDER_COOKIE = "hs_provider";

export const providerCookieFor = (need: Capability) =>
  need === "video" ? VIDEO_PROVIDER_COOKIE : IMAGE_PROVIDER_COOKIE;

/**
 * OpenAI for pictures, Replicate for clips.
 *
 * Images go direct to the model's own vendor rather than through an aggregator.
 * Video stays on Replicate: fal is where the studio started and where its
 * prompts were tuned — they still read in fal's dialect, `@Video1`, translated
 * to Replicate's `[Video1]` on the way out — but Replicate is where the video
 * models the slots point at actually live.
 */
export const DEFAULT_IMAGE_PROVIDER: ProviderId = "openai";
export const DEFAULT_VIDEO_PROVIDER: ProviderId = "replicate";

export const defaultProviderFor = (need: Capability) =>
  need === "video" ? DEFAULT_VIDEO_PROVIDER : DEFAULT_IMAGE_PROVIDER;

/** Kept for the handful of callers that just need *a* provider, e.g. a schema fetch. */
export const DEFAULT_PROVIDER: ProviderId = DEFAULT_IMAGE_PROVIDER;

/**
 * Can this provider serve media back to a browser?
 *
 * fal's uploads land on a public CDN: the URL is the file, anyone can fetch it,
 * and it lives about a week. Replicate's `/v1/files` is an input staging area —
 * auth-gated, expiring in 24 hours, and handing back a resource URL whose bytes
 * need an HMAC we cannot make.
 *
 * The distinction matters for anything the studio FINISHES rather than sends.
 * A composed scene is a model input and has to be somewhere a model can read
 * it. A logo-stamped clip is the deliverable: nothing else consumes it, and
 * putting it somewhere the user can neither watch nor download is worse than
 * not uploading it at all.
 */
export const providerHostsMedia = (provider: ProviderId): boolean =>
  provider !== "replicate" && provider !== "openai";

/* ------------------------- who serves what ------------------------- */

/**
 * Which providers a user may pick for a given job.
 *
 * The video list is the short one: OpenAI's Images API has no video endpoint,
 * so offering it there would be offering a choice that cannot be honoured.
 */
export const providersThatDo = (need: Capability): ProviderId[] =>
  PROVIDER_IDS.filter((id) => PROVIDERS[id].does[need]);

/**
 * A stored choice, made safe.
 *
 * A cookie can hold anything — an old value, a hand-edited one, or a provider
 * that could once do the job and no longer can. Rather than trust it, every
 * read passes through here, so "can this provider actually do this?" is asked
 * in one place instead of at each call site.
 */
export function providerFor(chosen: ProviderId | undefined, need: Capability): ProviderId {
  if (chosen && PROVIDERS[chosen].does[need]) return chosen;
  return defaultProviderFor(need);
}
