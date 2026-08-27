/**
 * Where the AI guide lives.
 *
 * The studio publishes two plain-text files describing itself — `/llms.txt`
 * (what it makes, the rules that cost money to learn, an index of every
 * control) and `/llms-full.txt` (the same with every control and option written
 * out). Both are generated from `help.ts` by `pnpm llms`.
 *
 * WHY THIS IS CONFIGURABLE
 * Embedded, the studio is a fragment of somebody else's document. It is hosted
 * at heartstamp.com/admin/social-assets, so a relative `/llms.txt` there
 * resolves to heartstamp.com/llms.txt — the host's root, which is not ours and
 * has no such file. An assistant following that link gets a 404 and concludes
 * the studio has no documentation.
 *
 * So NEXT_PUBLIC_STUDIO_BASE_URL holds the base the guide is actually served
 * from, and every reference is built off it. It is a base URL rather than an
 * origin because the embed lives under a path: both
 *
 *   https://studio.example.com
 *   https://heartstamp.com/admin/social-assets
 *
 * are valid values. Which one is correct depends on whether the host forwards
 * sub-paths through to this app — if it does, the second is friendlier because
 * it matches the URL the user is looking at; if it does not, the studio's own
 * origin is the one that resolves. Point it at whichever actually serves
 * `/llms.txt`, and check by fetching it.
 *
 * Left unset it stays relative, which is correct for the standalone deployment
 * and for local development.
 */

const BASE = (process.env.NEXT_PUBLIC_STUDIO_BASE_URL ?? "").trim().replace(/\/+$/, "");

export const LLMS_TXT = `${BASE}/llms.txt`;
export const LLMS_FULL_TXT = `${BASE}/llms-full.txt`;
