export const BRAND = {
  name: "HeartStamp",
  product: "Asset Studio",
  accent: "#BE1E2E",
  allowedDomain: "heartstamp.com",
} as const;

/** Cookie that holds the user's own fal.ai key. httpOnly — never exposed to JS. */
export const FAL_COOKIE = "hs_fal_key";
/** Non-sensitive companion cookie so the client can render "key connected" state. */
export const FAL_HINT_COOKIE = "hs_fal_hint";
