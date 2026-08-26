import type { Metadata } from "next";
import { NuggetBuilderClient } from "@/components/nuggets/NuggetBuilderClient";

export const metadata: Metadata = {
  title: "Nugget Builder · HeartStamp Asset Studio",
  robots: { index: false, follow: false },
};

export default function NuggetsPage() {
  return (
    <main id="main-content" className="min-h-dvh">
      <NuggetBuilderClient />
    </main>
  );
}
