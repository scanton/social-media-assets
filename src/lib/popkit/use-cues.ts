"use client";

import { useEffect, useSyncExternalStore } from "react";
import { registerCustomCue, unregisterCustomCue } from "./cues";
import {
  CUSTOM_PREFIX, customCues, customCueUrl, cuesHydrated, hydrateCues, subscribeCues,
  type StoredCue,
} from "./cue-store";

/**
 * The user's own cues, hydrated and registered into the shared table.
 *
 * Registration happens here rather than in the store because it is the bridge
 * between two things that should not know about each other: the store holds
 * blobs and knows nothing about the kit, and the table is the kit's. The hook
 * is where the app already is when both exist.
 *
 * Re-registered on every change, not just once. A reload mints fresh object
 * URLs for the same ids, and a table still holding yesterday's would leave
 * every custom cue silently unplayable — which looks exactly like a broken
 * upload and is nothing of the sort.
 */
export function useCustomCues(): StoredCue[] {
  const rows = useSyncExternalStore(subscribeCues, customCues, () => EMPTY);

  useEffect(() => {
    if (!cuesHydrated()) void hydrateCues();
  }, []);

  useEffect(() => {
    for (const row of rows) {
      const key = CUSTOM_PREFIX + row.id;
      const url = customCueUrl(key);
      if (url) registerCustomCue(key, { url, ms: row.ms, gain: row.gain, desc: row.name });
    }
  }, [rows]);

  return rows;
}

/** Drops a cue from the table when its row is gone. */
export function forgetCustomCue(key: string): void {
  unregisterCustomCue(key);
}

const EMPTY: StoredCue[] = [];
