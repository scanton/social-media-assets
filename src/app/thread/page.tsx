import type { Metadata } from "next";
import { ThreadBuilderClient } from "@/components/thread/ThreadBuilderClient";

export const metadata: Metadata = {
  title: "Thread Tool · HeartStamp Asset Studio",
  robots: { index: false, follow: false },
};

export default function ThreadPage() {
  return (
    <main id="main-content" className="min-h-dvh">
      <ThreadBuilderClient />
    </main>
  );
}
