"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { CHANGELOG_SEEN_KEY, LATEST_RELEASE } from "@/lib/changelog";

/**
 * "What's new", with a dot until this browser has opened the latest release.
 *
 * Read through useSyncExternalStore so the server render (no dot) and the first
 * client render agree, and so opening the changelog in another tab clears the
 * dot here too.
 */

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function unseen(): boolean {
  try {
    return localStorage.getItem(CHANGELOG_SEEN_KEY) !== LATEST_RELEASE.id;
  } catch {
    return false;
  }
}

export function ChangelogLink() {
  const fresh = useSyncExternalStore(subscribe, unseen, () => false);

  return (
    <Link
      href="/changelog"
      title={`What's new — ${LATEST_RELEASE.title}`}
      className="focus-stamp relative inline-flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1.5 text-[11px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-stamp-300"
    >
      {fresh && (
        <span className="h-1.5 w-1.5 rounded-full bg-stamp-600" aria-hidden />
      )}
      What&apos;s new
      {fresh && <span className="sr-only">(unread update)</span>}
    </Link>
  );
}
