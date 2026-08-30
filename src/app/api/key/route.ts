import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentUser } from "@/auth";
import { PROVIDERS, PROVIDER_IDS, isProviderId, type ProviderId } from "@/lib/providers";
import { validateReplicateKey } from "@/lib/replicate-server";

const ONE_YEAR = 60 * 60 * 24 * 365;

const hintOf = (key: string) => `••••${key.slice(-4)}`;

function whichProvider(url: string, fallback: ProviderId = "fal"): ProviderId {
  const p = new URL(url).searchParams.get("provider");
  return isProviderId(p) ? p : fallback;
}

/**
 * Does this key work?
 *
 * Both probes are chosen to be the cheapest authenticated call the provider
 * offers — a typo should fail here, in the dialog, rather than three steps into
 * a render. Neither runs a model, so neither costs anything.
 */
async function validate(provider: ProviderId, key: string): Promise<boolean | null> {
  if (provider === "replicate") return validateReplicateKey(key);

  // fal: minting a 60-second scoped token proves the credential without work.
  const probe = await fetch("https://rest.alpha.fal.ai/tokens/", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ allowed_apps: ["fal-ai/any"], token_expiration: 60 }),
  }).catch(() => null);

  if (probe && (probe.status === 401 || probe.status === 403)) return false;
  // Anything else — including fal being unreachable — is not the key's fault.
  return true;
}

/**
 * The connection state of every provider, not just the active one.
 *
 * The header has to show which providers are usable before you switch to one:
 * finding out that Replicate has no key by switching to it and watching a
 * render fail is the worse version of this.
 */
export async function GET() {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const jar = await cookies();

  const providers = Object.fromEntries(
    PROVIDER_IDS.map((id) => [
      id,
      {
        connected: Boolean(jar.get(PROVIDERS[id].cookie)?.value),
        hint: jar.get(PROVIDERS[id].hintCookie)?.value ?? null,
      },
    ]),
  );

  return NextResponse.json({
    providers,
    // The shape the app used before there was a second provider, so a client
    // that has not been updated still reads the fal state correctly.
    connected: providers.fal.connected,
    hint: providers.fal.hint,
  });
}

export async function POST(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { key?: string; provider?: string };
  const provider = isProviderId(body.provider) ? body.provider : whichProvider(req.url);
  const spec = PROVIDERS[provider];

  const trimmed = body.key?.trim() ?? "";
  if (!trimmed) return NextResponse.json({ error: "Key is required." }, { status: 400 });
  if (!spec.looksLikeKey(trimmed)) {
    return NextResponse.json(
      {
        error:
          provider === "fal"
            ? "That doesn't look like a fal key. They look like `abc123…:9f8e7d…`."
            : "That doesn't look like a Replicate token. They are one long run of letters and numbers.",
      },
      { status: 400 },
    );
  }

  if ((await validate(provider, trimmed)) === false) {
    return NextResponse.json(
      { error: `${spec.label} rejected that key. Double-check it and try again.` },
      { status: 400 },
    );
  }

  const jar = await cookies();
  const secure = process.env.NODE_ENV === "production";
  jar.set(spec.cookie, trimmed, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  // Readable companion cookie: last 4 chars only, purely for UI state.
  jar.set(spec.hintCookie, hintOf(trimmed), {
    httpOnly: false,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });

  return NextResponse.json({ provider, connected: true, hint: hintOf(trimmed) });
}

export async function DELETE(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const provider = whichProvider(req.url);
  const spec = PROVIDERS[provider];
  const jar = await cookies();
  jar.delete(spec.cookie);
  jar.delete(spec.hintCookie);
  return NextResponse.json({ provider, connected: false });
}
