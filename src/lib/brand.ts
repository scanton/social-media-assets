export const BRAND = {
  name: "HeartStamp",
  product: "Asset Studio",
  accent: "#BE1E2E",
  allowedDomain: "heartstamp.com",
} as const;

/*
 * Cookie names now live in lib/providers.ts, next to everything else that
 * differs between fal and Replicate. Re-exported here because these two names
 * were the import path for the whole app before there was a second provider.
 */
export { PROVIDERS } from "./providers";

/** Cookie that holds the user's own fal.ai key. httpOnly — never exposed to JS. */
export const FAL_COOKIE = "hs_fal_key";
/** Non-sensitive companion cookie so the client can render "key connected" state. */
export const FAL_HINT_COOKIE = "hs_fal_hint";
