/**
 * Where the AI guide lives.
 *
 * The studio publishes two plain-text files describing itself — `/llms.txt`
 * (what it makes, the rules that cost money to learn, an index of every
 * control) and `/llms-full.txt` (the same with every control and option written
 * out). Both are generated from `help.ts` by `pnpm llms`.
 *
 * WHY THE ORIGIN IS CONFIGURABLE
 * Embedded in a HeartStamp page, the studio is a fragment of somebody else's
 * document, and a relative `/llms.txt` there resolves against *their* origin —
 * pointing an assistant at a file that isn't ours and probably doesn't exist.
 * Setting NEXT_PUBLIC_STUDIO_ORIGIN to the studio's own origin makes every
 * reference absolute, so the link keeps working once the page is a guest.
 *
 * Left unset it stays relative, which is correct for the standalone deployment
 * and for local development.
 */

const ORIGIN = (process.env.NEXT_PUBLIC_STUDIO_ORIGIN ?? "").replace(/\/+$/, "");

export const LLMS_TXT = `${ORIGIN}/llms.txt`;
export const LLMS_FULL_TXT = `${ORIGIN}/llms-full.txt`;
