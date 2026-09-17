import type { Metadata } from "next";
import { ChangelogView } from "@/components/ChangelogView";

export const metadata: Metadata = {
  title: "What's new · HeartStamp Asset Studio",
  robots: { index: false, follow: false },
};

export default function ChangelogPage() {
  return (
    <main id="main-content" className="min-h-dvh">
      <ChangelogView />
    </main>
  );
}
