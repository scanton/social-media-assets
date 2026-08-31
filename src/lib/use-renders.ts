"use client";

import { useEffect, useSyncExternalStore } from "react";
import { hydrateRenders, rendersHydrated, subscribeRenders } from "@/lib/render-store";

/**
 * Makes stored renders available to whatever is drawing them.
 *
 * The object URLs are created once, asynchronously, from IndexedDB — but an
 * <img> cannot await, so `assetPreview` reads them from a synchronous map. This
 * is what fills that map and what tells React the map has changed, so a tile
 * mounted before hydration finishes paints when it does instead of staying
 * empty until something unrelated re-renders it.
 */
export function useRenders(): boolean {
  useEffect(() => {
    void hydrateRenders();
  }, []);
  return useSyncExternalStore(subscribeRenders, rendersHydrated, () => true);
}
