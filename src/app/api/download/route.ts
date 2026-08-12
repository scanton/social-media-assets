import { NextResponse } from "next/server";
import { currentUser } from "@/auth";

/** fal serves generated media from these hosts. Anything else is refused (SSRF guard). */
const ALLOWED_HOSTS = [
  "fal.media",
  "v2.fal.media",
  "v3.fal.media",
  "v3b.fal.media",
  "storage.googleapis.com",
];

function hostAllowed(host: string) {
  return ALLOWED_HOSTS.includes(host) || host.endsWith(".fal.media");
}

/**
 * Streams a generated asset back through our origin with a Content-Disposition
 * header, so the browser saves it instead of navigating to fal's CDN.
 * Nothing is written to disk — we don't retain assets.
 */
/** Shared parse + SSRF guard. Returns the URL, or the response to send instead. */
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
    let upstream = await fetch(target, { method: "HEAD", cache: "no-store" });
    // Not every CDN answers HEAD; a single byte is enough to prove existence.
    if (upstream.status === 405 || upstream.status === 501) {
      upstream = await fetch(target, { headers: { Range: "bytes=0-0" }, cache: "no-store" });
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

  const target = resolveTarget(params.get("url"));
  if (target instanceof NextResponse) return target;

  const upstream = await fetch(target, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: `Upstream returned ${upstream.status}.` }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
