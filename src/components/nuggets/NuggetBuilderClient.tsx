"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary so the builder can opt out of server rendering.
 *
 * compose() mints element ids from a module-level counter, so a server render
 * and the browser produce different-but-equivalent SVG for the same nugget and
 * React reports it as a hydration mismatch. Nothing here gains from SSR anyway:
 * the page needs a local video object URL, a ResizeObserver, and the kit running
 * in the browser before it can draw at all.
 *
 * `ssr: false` is rejected inside a Server Component, which is why this wrapper
 * exists rather than the import living in page.tsx.
 */
const NuggetBuilder = dynamic(
  () => import("./NuggetBuilder").then((m) => m.NuggetBuilder),
  {
    ssr: false,
    loading: () => (
      <div className="mx-auto max-w-[110rem] px-4 py-8 sm:px-6">
        <p className="text-sm text-ink-faint">Loading the POP KIT catalogue…</p>
      </div>
    ),
  },
);

export function NuggetBuilderClient() {
  return <NuggetBuilder />;
}
