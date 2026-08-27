import type { MetadataRoute } from "next";

/**
 * Keeps the studio out of search, and points assistants at the guide.
 *
 * The app is already `noindex` in its metadata, but a meta tag only reaches a
 * crawler that has already fetched the page. This says the same thing at the
 * door.
 *
 * The two `allow` entries matter more than the disallow. An assistant that
 * respects robots.txt — which is most of them — would read `Disallow: /` as
 * covering the very file written for it, so the one document we actually want
 * fetched would be the one it refused. It is carved out explicitly.
 *
 * Paths rather than URLs on purpose: robots.txt is defined relative to the
 * origin serving it, so these are correct here in a way they would not be
 * inside the embedded page. See `lib/llms.ts` for that case.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
      allow: ["/llms.txt", "/llms-full.txt", "/llms-shared.txt"],
    },
  };
}
