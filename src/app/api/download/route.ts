import { NextResponse } from "next/server";
import { readReplicateKey } from "@/lib/replicate-server";
import { currentUser } from "@/auth";

/**
 * Where generated media is allowed to come from. Anything else is refused,
 * because this route will fetch whatever URL it is handed and hand the bytes
 * back — an open one is an SSRF hole.
 *
 * Replicate serves outputs from `replicate.delivery` and its subdomains, and
 * files uploaded through /v1/files from api.replicate.com. Both are added as
 * exact suffixes rather than a substring test: "replicate.delivery.evil.com"
 * ends with neither.
 */
const ALLOWED_HOSTS = [
  "fal.media",
  "v2.fal.media",
  "v3.fal.media",
  "v3b.fal.media",
  "storage.googleapis.com",
  "replicate.delivery",
  "api.replicate.com",
];

const ALLOWED_SUFFIXES = [".fal.media", ".replicate.delivery"];

function hostAllowed(host: string) {
  return ALLOWED_HOSTS.includes(host) || ALLOWED_SUFFIXES.some((s) => host.endsWith(s));
}

/**
 * Streams a generated asset back through our origin with a Content-Disposition
 * header, so the browser saves it instead of navigating to fal's CDN.
 * Nothing is written to disk — we don't retain assets.
 */
/** Shared parse + SSRF guard. Returns the URL, or the response to send instead. */
/**
 * Replicate's files are not public, and its `urls.get` is not the bytes.
 *
 * An upload answers with `https://api.replicate.com/v1/files/{id}`, which is
 * the file RESOURCE — ask it for the file and you get JSON metadata. The
 * content is at the same path plus `/download`, and both need the caller's
 * bearer token. fal's CDN needs neither: its URLs are public and are the bytes.
 *
 * So a Replicate asset cannot be put in an <img> or a <video> the way a fal one
 * can, which is what "can't load right now" was: the browser has no way to send
 * an Authorization header, and no way to say that is why it failed.
 *
 * Everything therefore comes through here, where the key lives. This is also
 * why it matters that the health sweep uses the same route — an unauthenticated
 * probe would come back 401/403, and 403 is on that sweep's list of "the host
 * has dropped this", which would have quietly emptied the roll.
 */
const REPLICATE_API = "api.replicate.com";

async function prepare(target: URL): Promise<{ url: URL; headers: HeadersInit }> {
  if (target.hostname !== REPLICATE_API) return { url: target, headers: {} };

  /*
   * Authenticated, but not rewritten to /download.
   *
   * That endpoint returns the bytes and needs `owner`, `expiry` and an HMAC
   * signature made with the Files API signing secret — a different credential
   * from the API token, and not one a caller holds. Appending it just produces
   * "Missing query parameters".
   *
   * So this fetches the resource, which answers 200 with the file's metadata.
   * That is useless for display and exactly right for the health sweep, which
   * only needs to know whether the file still exists — and which would
   * otherwise read every Replicate asset as an error.
   */
  const key = await readReplicateKey();
  return { url: target, headers: key ? { Authorization: `Bearer ${key}` } : {} };
}

function resolveTarget(raw: string | null): URL | NextResponse {
  if (!raw) return NextResponse.json({ error: "url is required." }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url." }, { status: 400 });
  }

  if (target.protocol !== "https:" || !hostAllowed(target.hostname)) {
    return NextResponse.json({ error: "That host is not downloadable here." }, { status: 400 });
  }
  return target;
}

/**
 * Is this asset still on fal's CDN?
 *
 * fal drops generated media after a while, which leaves the roll full of
 * references to files that no longer exist. The browser can see that an image
 * failed to load but not *why* — a cross-origin failure is opaque — so this
 * asks on its behalf and reports the status, letting the client tell a deleted
 * file apart from a flaky connection. Only the former is safe to clean up.
 */
export async function HEAD(req: Request) {
  if (!(await currentUser())) return new NextResponse(null, { status: 401 });

  const target = resolveTarget(new URL(req.url).searchParams.get("url"));
  if (target instanceof NextResponse) return new NextResponse(null, { status: target.status });

  try {
    const { url, headers } = await prepare(target);
    let upstream = await fetch(url, { method: "HEAD", headers, cache: "no-store" });
    // Not every CDN answers HEAD; a single byte is enough to prove existence.
    if (upstream.status === 405 || upstream.status === 501) {
      upstream = await fetch(url, { headers: { ...headers, Range: "bytes=0-0" }, cache: "no-store" });
    }
    return new NextResponse(null, { status: upstream.ok ? 204 : upstream.status });
  } catch {
    // Unreachable is not the same as deleted, and must not be treated as such.
    return new NextResponse(null, { status: 504 });
  }
}

export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const filename = (params.get("filename") ?? "heartstamp-asset").replace(/[^\w.\-]/g, "_");
  /*
   * `inline` serves the bytes for display rather than as a download.
   *
   * The same proxy does both jobs now: a Replicate asset cannot go straight
   * into an <img> or a <video>, so its preview comes through here too — and a
   * preview answered with `Content-Disposition: attachment` starts a download
   * instead of drawing a picture.
   */
  const inline = params.get("inline") === "1";

  const target = resolveTarget(params.get("url"));
  if (target instanceof NextResponse) return target;

  // HEAD already guards this; GET did not, so a DNS failure or a dropped
  // connection surfaced as a bare 500 page where a download was expected.
  let upstream: Response;
  try {
    const { url, headers } = await prepare(target);
    upstream = await fetch(url, { headers, cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "Could not reach the asset host." }, { status: 504 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `Upstream returned ${upstream.status}.` }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": inline
        ? `inline; filename="${filename}"`
        : `attachment; filename="${filename}"`,
      /*
       * A preview is fetched on every render of a tile; a download is fetched
       * once. Letting the browser keep the former for a few minutes is the
       * difference between a roll that paints instantly and one that re-fetches
       * every thumbnail on every scroll. Private, because these are the
       * caller's own assets behind their own key.
       */
      "Cache-Control": inline ? "private, max-age=300" : "no-store",
    },
  });
}
