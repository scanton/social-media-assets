"use client";

import { useSyncExternalStore } from "react";

/**
 * Tracks which assets fal still has.
 *
 * fal drops generated media after a while, and the roll lives in localStorage
 * indefinitely — so a session opened a week later is full of references to files
 * that are gone, rendering as broken images.
 *
 * Nothing is checked up front. An `<img>` that loads fine costs nothing and
 * proves the asset exists, so verification only runs for the ones that actually
 * fail. That keeps the happy path free: a healthy roll of thirty assets makes
 * zero extra requests.
 *
 * The distinction that matters is deleted vs unreachable. A cross-origin load
 * failure is opaque to the browser, so the failed URL is re-checked through our
 * own proxy: a 404 means fal really has dropped it and it is safe to clean up,
 * while a timeout or a 5xx means try again later and must never delete anything.
 */

export type AssetHealth = "ok" | "checking" | "gone" | "unreachable";

const health = new Map<string, AssetHealth>();
const listeners = new Set<() => void>();

/** Recomputed on write so `useSyncExternalStore` sees a stable reference. */
let goneSnapshot: string[] = [];

function publish() {
  goneSnapshot = [...health.entries()].filter(([, v]) => v === "gone").map(([url]) => url);
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/* --------------------------- verification queue --------------------------- */

const MAX_CONCURRENT = 4;
const queue: string[] = [];
let active = 0;

async function verify(url: string) {
  try {
    const res = await fetch(`/api/download?url=${encodeURIComponent(url)}`, {
      method: "HEAD",
      cache: "no-store",
    });
    // 404/403/410 — fal has dropped it. Anything else (timeout, 5xx, our own
    // 401) is inconclusive, and inconclusive must never mean "delete".
    const gone = res.status === 404 || res.status === 403 || res.status === 410;
    health.set(url, gone ? "gone" : res.ok ? "ok" : "unreachable");
  } catch {
    health.set(url, "unreachable");
  } finally {
    publish();
    active--;
    pump();
  }
}

function pump() {
  while (active < MAX_CONCURRENT && queue.length) {
    const url = queue.shift()!;
    active++;
    void verify(url);
  }
}

/**
 * Called when an `<img>` or `<video>` fails to load.
 *
 * Idempotent: a URL is only ever verified once per session, however many tiles
 * happen to be showing it.
 */
export function reportAssetError(url: string) {
  if (!url || health.has(url)) return;
  // Data URIs never expire, and asking our proxy about one would 400.
  if (!/^https?:/i.test(url)) {
    health.set(url, "unreachable");
    publish();
    return;
  }
  health.set(url, "checking");
  publish();
  queue.push(url);
  pump();
}

/** Marks an asset healthy again — used when a load succeeds after a retry. */
export function reportAssetOk(url: string) {
  if (health.get(url) === "ok" || !health.has(url)) return;
  health.set(url, "ok");
  publish();
}

const getHealth = (url: string) => (): AssetHealth => health.get(url) ?? "ok";
const serverHealth = (): AssetHealth => "ok";

export function useAssetHealth(url: string): AssetHealth {
  return useSyncExternalStore(subscribe, getHealth(url), serverHealth);
}

const getGone = () => goneSnapshot;
const serverGone = (): string[] => [];

/** URLs fal has confirmed it no longer has. Safe to remove. */
export function useExpiredUrls(): string[] {
  return useSyncExternalStore(subscribe, getGone, serverGone);
}
