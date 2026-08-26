"use client";

import dynamic from "next/dynamic";

/**
 * The bench reads the model catalogue and draws its controls from it, so there
 * is nothing to render on the server. Same boundary the nugget builder uses.
 */
const Freeform = dynamic(() => import("./Freeform").then((m) => m.Freeform), {
  ssr: false,
  loading: () => <div className="mx-auto max-w-[110rem] px-4 py-10 text-sm text-ink-faint sm:px-6">Loading…</div>,
});

export function FreeformClient() {
  return <Freeform />;
}
