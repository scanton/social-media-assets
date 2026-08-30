import "server-only";
import { cookies } from "next/headers";
import { MissingKeyError } from "@/lib/fal-server";
import { PROVIDERS } from "@/lib/providers";

/**
 * Replicate's HTTP API, as much of it as the studio needs.
 *
 * Hand-rolled rather than the `replicate` npm package. The package is a thin
 * wrapper over the same six endpoints, and it wants a module-level token — the
 * exact singleton this codebase avoids for fal, because one user's key living
 * in module scope on a shared server is how it leaks into another user's
 * request. Everything here takes the key as an argument.
 */

const API = "https://api.replicate.com/v1";

/** Reads the caller's own Replicate token out of their httpOnly cookie. */
export async function readReplicateKey(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(PROVIDERS.replicate.cookie)?.value?.trim();
  return value ? value : null;
}

export async function requireReplicateKey(): Promise<string> {
  const key = await readReplicateKey();
  if (!key) throw new MissingKeyError("Replicate");
  return key;
}

/** The error shape `api-errors.ts` already knows how to render. */
class ReplicateError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "ReplicateError";
    this.status = status;
    this.body = body;
  }
}

/**
 * One request, with the auth header and error shape both handled.
 *
 * Throws something `errorResponse` can read: it looks for `status` and `body`,
 * and Replicate's failures are FastAPI-shaped like fal's, so the validation
 * detail renders as a sentence without any extra work here.
 */
export async function replicateFetch(
  key: string,
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<unknown> {
  const { json, headers, ...rest } = init;
  const res = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(json === undefined ? {} : { "Content-Type": "application/json" }),
      ...(headers as Record<string, string> | undefined),
    },
    ...(json === undefined ? {} : { body: JSON.stringify(json) }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail =
      (body as { detail?: unknown } | null)?.detail ??
      (body as { title?: unknown } | null)?.title;
    throw new ReplicateError(
      res.status,
      body,
      typeof detail === "string" ? detail : `Replicate returned ${res.status}.`,
    );
  }
  // 204 on some deletes; every path we call returns a body.
  return res.status === 204 ? null : res.json();
}

/**
 * Is this token real?
 *
 * `/account` is the cheapest authenticated call Replicate has — it runs no
 * model and costs nothing, which is what a key dialog needs. fal's key check
 * mints a scoped token for the same reason.
 */
export async function validateReplicateKey(key: string): Promise<boolean> {
  const res = await fetch(`${API}/account`, {
    headers: { Authorization: `Bearer ${key}` },
  }).catch(() => null);
  return Boolean(res?.ok);
}
