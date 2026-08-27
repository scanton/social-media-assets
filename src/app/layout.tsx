import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "HeartStamp Asset Studio",
  description:
    "Generate lifestyle base images and social videos for HeartStamp printed and digital greeting cards.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#BE1E2E",
  width: "device-width",
  initialScale: 1,
};

/**
 * The id every one of our styles hangs off.
 *
 * Exported rather than written twice: postcss-scope-studio.mjs scopes the
 * whole stylesheet to it, and anything that portals has to land inside it or
 * it comes out unstyled. See STUDIO_ROOT_ID's uses.
 */
export const STUDIO_ROOT_ID = "heartstamp-studio";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/*
       * Only on our own page. Embedded, the host owns these elements and this
       * tag is simply not shipped — which is why it is here and not in
       * globals.css, where the scoper would rewrite `html` to our root and it
       * would quietly stop meaning anything.
       */}
      <style>{"html,body{height:100%}body{margin:0;background:#fff}"}</style>
      <body>
        {/*
         * Two elements on purpose.
         *
         * The outer one is the boundary and carries nothing but the id: every
         * rule we ship is scoped under it, so their CSS stops winning inside
         * and ours stops leaking out onto the rest of their page.
         *
         * The inner one carries the classes, because scoping makes every
         * utility a DESCENDANT of the root — `#heartstamp-studio .flex` does
         * not match the root itself. Putting the font variables here rather
         * than on <html> is what makes the type survive embedding: `var()` is
         * substituted against the element being styled, so anything inside
         * this div resolves them whatever the host's <html> looks like.
         */}
        <div
          id={STUDIO_ROOT_ID}
          /*
           * The two font variables, set inline on the root rather than through
           * next/font's `.variable` class.
           *
           * `--font-sans-stack: var(--font-inter), …` is declared ON this
           * element, and a custom property whose value contains an
           * unresolvable var() is invalid at computed-value time: it computes
           * to nothing, and nothing is what inherits to every element below.
           * So --font-inter has to exist at or above the element that names
           * it — which the class could not do, because scoping makes every
           * class a descendant of this root.
           *
           * Inline is the honest answer: it is on the right element, and it is
           * the one declaration on the page neither the scoper nor the host's
           * stylesheet can reach.
           */
          style={
            {
              "--font-inter": inter.style.fontFamily,
              "--font-outfit": outfit.style.fontFamily,
              /*
               * Where the inherited text properties start over.
               *
               * globals.css asks every element under here to `inherit` these,
               * which neutralises a host `* { letter-spacing: 4px }` — but a
               * chain of `inherit` has to terminate in a real value, and these
               * are all initial values, which the CSS minifier strips as
               * redundant. They survive here.
               */
              letterSpacing: "normal",
              wordSpacing: "normal",
              textTransform: "none",
              fontStyle: "normal",
              textIndent: 0,
            } as React.CSSProperties
          }
        >
          <div className="flex min-h-full flex-col antialiased">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
