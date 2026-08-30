/**
 * The two places a render can happen.
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

export type ProviderId = "fal" | "replicate";

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
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS) as ProviderId[];

export const isProviderId = (v: unknown): v is ProviderId =>
  typeof v === "string" && v in PROVIDERS;

/**
 * Which provider the studio is pointed at.
 *
 * Readable rather than httpOnly: it is a preference, not a secret, and the
 * header has to render the current one before any request goes out.
 */
export const PROVIDER_COOKIE = "hs_provider";

/** fal is where the studio started and where its prompts were tuned. */
export const DEFAULT_PROVIDER: ProviderId = "fal";
