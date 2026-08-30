import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/auth";
import { PROVIDER_COOKIE, isProviderId } from "@/lib/providers";
import { activeProvider } from "@/lib/active-provider";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Which provider the studio is pointed at.
 *
 * A route rather than a client-set cookie so the server and the browser can
 * never disagree about it: every generation reads this same cookie, and a
 * client that wrote it directly could set one the server does not recognise.
 */
export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ provider: await activeProvider() });
}

export async function POST(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { provider } = (await req.json().catch(() => ({}))) as { provider?: unknown };
  if (!isProviderId(provider)) {
    return NextResponse.json({ error: `Unknown provider: ${String(provider)}` }, { status: 400 });
  }
  const jar = await cookies();
  jar.set(PROVIDER_COOKIE, provider, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return NextResponse.json({ provider });
}
