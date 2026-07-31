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
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const raw = params.get("url");
  const filename = (params.get("filename") ?? "heartstamp-asset").replace(/[^\w.\-]/g, "_");

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
