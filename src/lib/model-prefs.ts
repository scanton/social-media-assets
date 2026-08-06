"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  MODEL_COOKIE,
  MODEL_SLOTS,
  parseModelChoices,
  resolveModel,
  type ModelChoices,
  type ModelSlotId,
} from "@/lib/models";
import type { ModelSupports } from "@/lib/model-input";

/**
 * The user's model picks, kept in a cookie rather than localStorage.
 *
 * Everything else in the studio persists via lib/persisted-store, but that is
 * the session's *work*. This is a setting, and a cookie is the thing that both
 * the browser and the server can read — the same reason the fal key lives in
 * one. It is deliberately not httpOnly: the picker has to render the current
 * choice without a round-trip.
 */

const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${MODEL_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/* A tiny external store so every picker on the page reflects a change at once. */
let snapshot: ModelChoices = {};
let loaded = false;
const listeners = new Set<() => void>();

const EMPTY: ModelChoices = {};

function subscribe(onChange: () => void) {
  if (!loaded) {
    loaded = true;
    snapshot = parseModelChoices(readCookie());
  }
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function useModelChoices() {
  const choices = useSyncExternalStore(
    subscribe,
    () => snapshot,
    // The server has no cookie access here, and rendering defaults keeps
    // hydration matched — the real value arrives on subscribe.
    () => EMPTY,
  );

  const setChoice = useCallback((slot: ModelSlotId, modelId: string | null) => {
    const next: ModelChoices = { ...snapshot };
    // Clearing writes nothing rather than pinning today's default, so a future
    // change to the shipped default reaches anyone who never chose.
    if (!modelId || modelId === MODEL_SLOTS[slot].fallback) delete next[slot];
    else next[slot] = modelId;

    snapshot = next;
    document.cookie = `${MODEL_COOKIE}=${encodeURIComponent(
      JSON.stringify(next),
    )}; path=/; max-age=${ONE_YEAR}; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    listeners.forEach((l) => l());
  }, []);

  const modelFor = useCallback(
    (slot: ModelSlotId) => resolveModel(choices, slot),
    [choices],
  );

  return { choices, setChoice, modelFor };
}

/* ------------------------------ catalogue ----------------------------- */

export type CatalogEntry = {
  id: string;
  title: string;
  group?: string;
  description?: string;
  thumbnailUrl?: string;
  isDefault: boolean;
  supports: ModelSupports;
};

export type CatalogResponse = {
  slot: ModelSlotId;
  fallback: string;
  models: CatalogEntry[];
  /** True when fal's catalogue couldn't be read and only the default is offered. */
  partial: boolean;
};

/** One in-flight request per slot, shared across pickers and remembered per tab. */
const catalogCache = new Map<ModelSlotId, Promise<CatalogResponse>>();

export function loadCatalog(slot: ModelSlotId): Promise<CatalogResponse> {
  const cached = catalogCache.get(slot);
  if (cached) return cached;

  const request = fetch(`/api/fal/models?slot=${slot}`, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error(`Could not load models (${res.status}).`);
      return res.json() as Promise<CatalogResponse>;
    })
    .catch((err) => {
      // A failed lookup must not be cached, or the picker stays broken until
      // the tab is reloaded.
      catalogCache.delete(slot);
      throw err;
    });

  catalogCache.set(slot, request);
  return request;
}
