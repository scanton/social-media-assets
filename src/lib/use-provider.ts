"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_PROVIDER, PROVIDER_COOKIE, isProviderId, type ProviderId } from "@/lib/providers";

/**
 * The active provider, on the client.
 *
 * Read from the same readable cookie the server reads, through
 * `useSyncExternalStore` so the first paint matches what the server rendered
 * and there is no hydration mismatch — the pattern the rest of this app already
 * uses for browser-held state.
 *
 * Writing goes through the API rather than `document.cookie`, so there is one
 * place that decides what a valid provider is. The local snapshot updates
 * optimistically because the alternative is a header control that appears to do
 * nothing for a round trip.
 */

let snapshot: ProviderId = DEFAULT_PROVIDER;
let read = false;
const listeners = new Set<() => void>();

function currentFromCookie(): ProviderId {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${PROVIDER_COOKIE}=`))
    ?.slice(PROVIDER_COOKIE.length + 1);
  return isProviderId(raw) ? raw : DEFAULT_PROVIDER;
}

function subscribe(l: () => void) {
  if (!read) {
    read = true;
    snapshot = currentFromCookie();
  }
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useProvider() {
  const provider = useSyncExternalStore(
    subscribe,
    () => snapshot,
    // The server has no cookie access here; the real value arrives on subscribe.
    () => DEFAULT_PROVIDER,
  );

  const setProvider = useCallback(async (next: ProviderId) => {
    snapshot = next;
    listeners.forEach((l) => l());
    await fetch("/api/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: next }),
    }).catch(() => undefined);
  }, []);

  return { provider, setProvider };
}
