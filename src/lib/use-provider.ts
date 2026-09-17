"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  LEGACY_PROVIDER_COOKIE, defaultProviderFor, isProviderId, providerCookieFor, providerFor,
  type Capability, type ProviderId,
} from "@/lib/providers";

/**
 * The chosen providers, on the client.
 *
 * Read from the same readable cookies the server reads, through
 * `useSyncExternalStore` so the first paint matches what the server rendered
 * and there is no hydration mismatch — the pattern the rest of this app already
 * uses for browser-held state.
 *
 * Writing goes through the API rather than `document.cookie`, so there is one
 * place that decides what a valid provider is, and one place that refuses a
 * combination the studio cannot honour.
 */

type Snapshot = { image: ProviderId; video: ProviderId };

let snapshot: Snapshot = { image: defaultProviderFor("image"), video: defaultProviderFor("video") };
let read = false;
const listeners = new Set<() => void>();
const ping = () => listeners.forEach((l) => l());

function cookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function fromCookies(): Snapshot {
  const legacy = cookie(LEGACY_PROVIDER_COOKIE);
  const pick = (need: Capability) => {
    const own = cookie(providerCookieFor(need));
    // Same order the server uses: this capability's own choice, then the
    // pre-split one, then the default — and never something that cannot do it.
    if (isProviderId(own)) return providerFor(own, need);
    return providerFor(isProviderId(legacy) ? legacy : undefined, need);
  };
  return { image: pick("image"), video: pick("video") };
}

function subscribe(l: () => void) {
  if (!read) {
    read = true;
    snapshot = fromCookies();
  }
  listeners.add(l);
  return () => listeners.delete(l);
}

const server: Snapshot = {
  image: defaultProviderFor("image"),
  video: defaultProviderFor("video"),
};

export function useProviders() {
  const providers = useSyncExternalStore(
    subscribe,
    () => snapshot,
    // The server has no cookie access here; the real value arrives on subscribe.
    () => server,
  );

  const setProvider = useCallback(async (need: Capability, next: ProviderId) => {
    // Optimistic: the alternative is a header control that appears to do
    // nothing for a round trip.
    snapshot = { ...snapshot, [need]: next };
    ping();
    await fetch("/api/provider", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: next, need }),
    }).catch(() => undefined);
  }, []);

  return { providers, setProvider };
}

/**
 * Just the image one, for the many places that only render pictures.
 *
 * Kept because most callers genuinely do not care about video, and making each
 * of them destructure a pair would be noise.
 */
export function useProvider() {
  const { providers, setProvider } = useProviders();
  return {
    provider: providers.image,
    setProvider: useCallback((next: ProviderId) => setProvider("image", next), [setProvider]),
  };
}
