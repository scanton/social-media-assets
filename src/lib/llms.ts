/**
 * Where the AI guide lives.
 *
 * The studio publishes two plain-text files describing itself — `/llms.txt`
 * (what it makes, the rules that cost money to learn, an index of every
 * control) and `/llms-full.txt` (the same with every control and option written
 * out). Both are generated from `help.ts` by `pnpm llms`.
 *
 * WHY THIS IS CONFIGURABLE
 * Unset — the normal case — every reference is relative, which is correct: the
 * studio serves the guide from its own root and an assistant fetching
 * `/llms.txt` against the page it is looking at gets the right file.
 *
 * It exists for the case where the studio is rendered inside a document it does
 * not own. There a relative `/llms.txt` resolves against the *host's* root, not
 * ours, and an assistant following it gets a 404 and concludes the studio is
 * undocumented — a failure with no error attached to it. Setting this to the
 * base the guide is actually served from makes every reference absolute and
 * survives the move.
 *
 * Note that this is NOT the HeartStamp admin app at
 * heartstamp.com/admin/social-assets. That is a separate implementation of the
 * same product against HeartStamp's own design system; it does not serve this
 * app's files, and pointing at it would send assistants somewhere that has
 * never heard of `/llms.txt`. If that app wants a guide, it should serve one
 * from its own origin — `public/llms.txt` is a static generated file and copies
 * cleanly.
 */

const BASE = (process.env.NEXT_PUBLIC_STUDIO_BASE_URL ?? "").trim().replace(/\/+$/, "");

export const LLMS_TXT = `${BASE}/llms.txt`;
export const LLMS_FULL_TXT = `${BASE}/llms-full.txt`;
