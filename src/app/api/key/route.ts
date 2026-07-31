import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/auth";
import { FAL_COOKIE, FAL_HINT_COOKIE } from "@/lib/brand";
import { looksLikeFalKey } from "@/lib/fal-server";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jar = await cookies();
  return NextResponse.json({
    connected: Boolean(jar.get(FAL_COOKIE)?.value),
    hint: jar.get(FAL_HINT_COOKIE)?.value ?? null,
  });
}

export async function POST(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key } = (await req.json().catch(() => ({}))) as { key?: string };
  const trimmed = key?.trim() ?? "";
  if (!trimmed) return NextResponse.json({ error: "Key is required." }, { status: 400 });
  if (!looksLikeFalKey(trimmed)) {
    return NextResponse.json(
      { error: "That doesn't look like a fal key. They look like `abc123…:9f8e7d…`." },
      { status: 400 },
    );
  }

  // Validate against fal before we store anything, so a typo fails here and not
  // three steps into a generation.
  const probe = await fetch("https://rest.alpha.fal.ai/tokens/", {
    method: "POST",
    headers: { Authorization: `Key ${trimmed}`, "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_apps: ["fal-ai/any"], token_expiration: 60 }),
  }).catch(() => null);

  if (probe && (probe.status === 401 || probe.status === 403)) {
    return NextResponse.json({ error: "fal rejected that key. Double-check it and try again." }, { status: 400 });
  }

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(FAL_COOKIE, trimmed, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  // Readable companion cookie: last 4 chars only, purely for UI state.
  jar.set(FAL_HINT_COOKIE, `••••${trimmed.slice(-4)}`, {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });

  return NextResponse.json({ connected: true, hint: `••••${trimmed.slice(-4)}` });
}

export async function DELETE() {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jar = await cookies();
  jar.delete(FAL_COOKIE);
  jar.delete(FAL_HINT_COOKIE);
  return NextResponse.json({ connected: false });
}
