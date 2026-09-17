import "server-only";
import { cookies } from "next/headers";
import { createFalClient } from "@fal-ai/client";
import { FAL_COOKIE } from "@/lib/brand";
import { PROVIDERS, type ProviderId } from "@/lib/providers";

/**
 * Shared by every provider: the message differs only in whose key is missing,
 * and the route layer turns any of them into the same 428 the key dialog opens on.
 *
 * Carries the provider's id as well as its name. Once images and video could
 * run on different providers, "a key is missing" stopped being enough — the
 * dialog has to open for the RIGHT provider, and a sentence is no way to tell
 * it which.
 */
export class MissingKeyError extends Error {
  readonly provider: ProviderId;
  constructor(provider: ProviderId = "fal") {
    super(`No ${PROVIDERS[provider].label} API key on this browser. Add one in the studio header.`);
    this.name = "MissingKeyError";
    this.provider = provider;
  }
}

/** Reads the caller's own fal key out of their httpOnly cookie. Never persisted server-side. */
export async function readFalKey(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(FAL_COOKIE)?.value?.trim();
  return value ? value : null;
}

/**
 * A fal client scoped to this request only. We deliberately avoid the module-level
 * `fal.config()` singleton so one user's key can never leak into another's request.
 */
export async function falForRequest() {
  const key = await readFalKey();
  if (!key) throw new MissingKeyError();
  return createFalClient({ credentials: key });
}

export function looksLikeFalKey(value: string): boolean {
  // fal keys are `<uuid>:<hex secret>`; be permissive but reject obvious junk.
  return /^[A-Za-z0-9-]{8,}:[A-Za-z0-9]{16,}$/.test(value.trim());
}
