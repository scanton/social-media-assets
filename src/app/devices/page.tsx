import type { Metadata } from "next";
import { DeviceShotsClient } from "@/components/devices/DeviceShotsClient";

export const metadata: Metadata = {
  title: "Device Shots · HeartStamp Asset Studio",
  robots: { index: false, follow: false },
};

export default function DevicesPage() {
  return (
    <main id="main-content" className="min-h-dvh">
      <DeviceShotsClient />
    </main>
  );
}
