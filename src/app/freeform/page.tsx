import type { Metadata } from "next";
import { FreeformClient } from "@/components/freeform/FreeformClient";

export const metadata: Metadata = {
  title: "Make anything · HeartStamp Asset Studio",
  robots: { index: false, follow: false },
};

export default function FreeformPage() {
  return (
    <main id="main-content" className="min-h-dvh">
      <FreeformClient />
    </main>
  );
}
