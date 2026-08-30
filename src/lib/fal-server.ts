import "server-only";
import { cookies } from "next/headers";
import { createFalClient } from "@fal-ai/client";
import { FAL_COOKIE } from "@/lib/brand";

/**
 * Shared by both providers: the message differs only in whose key is missing,
 * and the route layer turns either one into the same 428 the key dialog opens on.
 */
export class MissingKeyError extends Error {
  constructor(provider = "fal.ai") {
    super(`No ${provider} API key on this browser. Add one in the studio header.`);
    this.name = "MissingKeyError";
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
