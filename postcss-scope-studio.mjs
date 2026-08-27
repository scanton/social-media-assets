/**
 * Scopes every rule we emit under the app's root element.
 *
 * WHY THIS EXISTS
 * The studio is embedded in a HeartStamp page, sharing one document with that
 * site's stylesheets, and the two were fighting. Tailwind v4 puts everything it
 * emits inside `@layer theme, base, components, utilities`, and in the cascade
 * an UNLAYERED rule beats a layered one whatever its specificity — so the
 * host's ordinary CSS outranked every utility here, and no amount of
 * specificity on our side could have changed that. globals.css therefore
 * imports Tailwind's three parts without their `layer()` wrappers.
 *
 * That fixes the priority and creates a new problem: unlayered, Preflight's
 * resets on `*`, `img`, `button` would start winning against the host's own
 * reset across their entire page. We would have fixed our styling by breaking
 * theirs. So everything gets confined to our subtree here.
 *
 * ONE RULE ESCAPES, ON PURPOSE
 * lightningcss minifies after PostCSS, and it synthesises a Safari-only
 * `@supports { *, :before, :after, ::backdrop { --tw-*: initial } }` block out
 * of Tailwind's `@property` rules — after this plugin has already run, so it is
 * never offered to us. It is left alone because it paints nothing: every
 * declaration in it is one of Tailwind's own `--tw-` variables, so the worst it
 * does to a host page is define custom properties nobody reads.
 *
 * Written locally rather than pulled in: the interesting part is what happens
 * to `:root`, `html` and `*`, and a general-purpose prefixer gets those wrong
 * in ways that are quiet — theme tokens defined on a selector that never
 * matches, and a box-sizing reset that skips the root element itself.
 */

const ROOT = "#heartstamp-studio";

/* Selectors that mean "the document", which for us means our root element. */
const DOCUMENT_LEVEL = new Set([":root", "html", "body", ":host"]);

/* At-rules whose children are not selectors and must be left alone. */
const NOT_SELECTORS = /^(keyframes|property|font-face|counter-style|layer|theme)$/i;

function scopeOne(selector) {
  const s = selector.trim();
  if (!s || s.startsWith(ROOT)) return s;

  /*
   * The document itself collapses to our root rather than becoming a
   * descendant of it: `#studio html` matches nothing, which is how a prefixer
   * silently drops every design token and every base style at once.
   */
  if (DOCUMENT_LEVEL.has(s)) return ROOT;

  /*
   * The universal reset has to include the root, not just its descendants.
   * `#studio *` leaves the root itself with the host's box-sizing, which is
   * the kind of one-element bug that takes an afternoon to find.
   */
  if (s === "*") return `${ROOT}, ${ROOT} *`;

  // A bare pseudo-element (::selection, ::-webkit-scrollbar) applies to
  // everything inside us.
  if (s.startsWith("::")) return `${ROOT} ${s}`;

  // `html.dark &`-style compound selectors on the document: swap the document
  // half for our root and keep the rest.
  for (const doc of DOCUMENT_LEVEL) {
    if (s.startsWith(`${doc} `)) return `${ROOT} ${s.slice(doc.length + 1)}`;
    if (s.startsWith(`${doc}:`) || s.startsWith(`${doc}.`) || s.startsWith(`${doc}[`)) {
      return ROOT + s.slice(doc.length);
    }
  }

  return `${ROOT} ${s}`;
}

/** @type {import('postcss').PluginCreator} */
const plugin = () => ({
  postcssPlugin: "scope-to-studio",
  Rule(rule) {
    for (let p = rule.parent; p; p = p.parent) {
      if (p.type === "atrule" && NOT_SELECTORS.test(p.name)) return;
    }
    if (rule.selectors.every((s) => s.trim().startsWith(ROOT))) return;
    rule.selectors = rule.selectors.flatMap((s) => scopeOne(s).split(",").map((x) => x.trim()));
  },
});

plugin.postcss = true;
export default plugin;
