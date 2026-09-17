"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  CHANGELOG, CHANGELOG_SEEN_KEY, LATEST_RELEASE, type ChangeKind, type Release,
} from "@/lib/changelog";
import { cx } from "./ui";

/**
 * What shipped. The latest release leads; earlier ones sit underneath.
 *
 * A client component only so it can mark the latest release as seen, which is
 * what clears the dot on the header link.
 */

const KIND: Record<ChangeKind, { label: string; className: string }> = {
  new: { label: "New", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  improved: { label: "Improved", className: "bg-sky-50 text-sky-800 border-sky-200" },
  fixed: { label: "Fixed", className: "bg-amber-50 text-amber-900 border-amber-200" },
};

const ORDER: ChangeKind[] = ["new", "improved", "fixed"];

function formatDate(iso: string) {
  // Noon UTC, so the date cannot slip a day in a western timezone.
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
}

function ReleaseBody({ release }: { release: Release }) {
  const sorted = [...release.changes].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  return (
    <ul className="space-y-3">
      {sorted.map((c, i) => (
        <li key={i} className="flex gap-3">
          <span
            className={cx(
              "mt-0.5 h-fit shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]",
              KIND[c.kind].className,
            )}
          >
            {KIND[c.kind].label}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug text-ink">
              <span className="mr-1.5 text-ink-faint">{c.area} ·</span>
              {c.title}
            </p>
            {c.detail && <p className="mt-1 text-sm leading-relaxed text-ink-soft">{c.detail}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ChangelogView() {
  useEffect(() => {
    try {
      localStorage.setItem(CHANGELOG_SEEN_KEY, LATEST_RELEASE.id);
      // Let an open studio tab clear its dot too.
      window.dispatchEvent(new StorageEvent("storage", { key: CHANGELOG_SEEN_KEY }));
    } catch {
      /* private window or blocked storage — the dot just stays */
    }
  }, []);

  const [latest, ...earlier] = CHANGELOG;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="focus-stamp mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-ink-faint transition-colors hover:text-stamp-600"
      >
        <span aria-hidden>←</span> Asset Studio
      </Link>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stamp-600">WHAT&apos;S NEW</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        {latest.title}
      </h1>
      <p className="mt-2 text-sm text-ink-faint">Latest update · {formatDate(latest.date)}</p>
      {latest.summary && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{latest.summary}</p>
      )}

      <section className="card-surface mt-6 p-5 sm:p-6">
        <ReleaseBody release={latest} />
      </section>

      {earlier.length > 0 && (
        <>
          <h2 className="mt-10 font-display text-lg font-bold text-ink">Earlier updates</h2>
          <div className="mt-3 space-y-3">
            {earlier.map((r) => (
              <details key={r.id} className="card-surface group p-5">
                <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3">
                  <span className="font-semibold text-ink">{r.title}</span>
                  <span className="shrink-0 text-xs text-ink-faint">
                    {formatDate(r.date)}
                    <span aria-hidden className="ml-2 inline-block transition-transform group-open:rotate-90">›</span>
                  </span>
                </summary>
                <div className="mt-4">
                  <ReleaseBody release={r} />
                </div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
