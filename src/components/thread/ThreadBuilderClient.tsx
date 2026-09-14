"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary, for the same reason NuggetBuilderClient exists.
 *
 * Everything here needs the browser before it can draw a thing: a canvas to
 * measure text against, a local object URL for the card animation, and
 * WebCodecs for the export. `ssr: false` is rejected inside a Server
 * Component, so the opt-out lives in a wrapper rather than in page.tsx.
 */
const ThreadBuilder = dynamic(
  () => import("./ThreadBuilder").then((m) => m.ThreadBuilder),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-[110rem] px-4 py-8 sm:px-6">
        <p className="text-sm text-ink-faint">Loading the thread tool…</p>
      </div>
    ),
  },
);

export function ThreadBuilderClient() {
  return <ThreadBuilder />;
}
