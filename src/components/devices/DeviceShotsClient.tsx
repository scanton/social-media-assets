"use client";

import dynamic from "next/dynamic";

/** Client boundary, for the same reason the other builders have one. */
const DeviceShots = dynamic(() => import("./DeviceShots").then((m) => m.DeviceShots), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-[110rem] px-4 py-8 sm:px-6">
      <p className="text-sm text-ink-faint">Loading device shots…</p>
    </div>
  ),
});

export function DeviceShotsClient() {
  return <DeviceShots />;
}
