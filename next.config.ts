import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in the home directory makes Next guess the wrong workspace root.
  turbopack: { root: path.resolve(process.cwd()) },

  /**
   * The AI guide is meant to be read from elsewhere.
   *
   * `/llms-shared.txt` exists so another build of this product — the HeartStamp
   * admin app — can serve the same product knowledge instead of keeping a
   * parallel copy that drifts. That only works if fetching it from another
   * origin succeeds, so the three files are readable cross-origin. They are
   * public documentation with nothing user-specific in them; there is nothing
   * here for an allowlist to protect.
   *
   * `headers` matches before the filesystem, so these apply to the static files
   * in `public/` despite nothing routing them.
   */
  async headers() {
    return [
      {
        source: "/:file(llms|llms-full|llms-shared).txt",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          /*
           * Five minutes at the edge, and a day of serving the old copy while
           * the new one is fetched. A consumer pulling this at build time wants
           * it current; nobody wants a build to fail because the file was being
           * revalidated at that moment.
           */
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
