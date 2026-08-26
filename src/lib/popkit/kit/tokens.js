/* ============================================================
   POP KIT v2 - TOKENS
   Sourced from HeartStamp Brand Guidelines (Figma HCmqdaMMBqJbDJQwPFw2WM)
   ============================================================ */

/* ---- BRAND COLOR, verbatim from the brand book ------------ */
export const BRAND = {
  /* Core palette */
  ink:    '#242423',
  cream:  '#F4EBE0',
  white:  '#FFFFFF',
  red:    '#BE1D2C',
  /* Premium palette */
  gold:   '#BDA360',
  grey:   '#AAABA6',
  /* Accent palette */
  blue:   '#1C69BE',
  orange: '#F26419',
  purple: '#52489C',
  coral:  '#EF6F6C',
  green:  '#2DA561',
  amber:  '#FFB627',
  /* Soft palette */
  sPurple:'#91889F',
  sPink:  '#D2B9C7',
  sSand:  '#DEBB85',
  sLemon: '#E8D86E',
  sSage:  '#A9B37F',
  sMist:  '#BFC7D0'
};

/* ---- TYPOGRAPHY -------------------------------------------
   Brand book: Core 01 Stack Sans, Core 02 DM Sans,
   header-only ITC Garamond Std (Book Narrow).
   Stack Sans ships in this repo. It is Stack Sans Text, released
   under OFL-1.1 by the Stack Sans Project Authors and available
   on Google Fonts, so it is free to embed in the package, the
   render worker, and the iOS bundle with attribution.
   Weights 200 to 700, variable. Nugget copy uses 700.
   ITC Garamond Std Book Narrow is licensed and is not here;
   EB Garamond stands in until the licensed file is dropped into
   kit/fonts/, at which point it takes over with no other change.
   ------------------------------------------------------------ */
export const TYPE = {
  display: "'PK Stack',sans-serif",               // Stack Sans Text 700, nugget copy
  body:    "'PK Sans',sans-serif",                // DM Sans, sub-lines, kickers, UI
  editorial: "'PK Serif',serif",                  // ITC Garamond stand-in, quote nuggets
  hierarchy: {
    h1:  { size: 56, line: 64, track: '0em',      weight: 700 },
    h2:  { size: 40, line: 48, track: '0em',      weight: 600 },
    h3:  { size: 36, line: 42, track: '-0.04em',  weight: 400 },
    sub: { size: 24, line: 32, track: '0em',      weight: 300 },
    body:{ size: 16, line: 20, track: '0em',      weight: 400 }
  }
};

/* ---- CANVAS PRESETS ----------------------------------------
   `base` is the nugget body font size on that canvas.
   `k` is the keyline weight. Everything else scales off base.
   Safe zones are in canvas px and keep nuggets clear of platform UI.
   ------------------------------------------------------------ */
export const CANVAS = {
  reels:    { w: 1080, h: 1920, base: 46, k: 7, safe: { t: 220, b: 420, l: 48, r: 48 },
              label: 'TikTok / Reels / Shorts, 9:16' },
  youtube:  { w: 1920, h: 1080, base: 42, k: 6, safe: { t: 70,  b: 150, l: 90, r: 90 },
              label: 'YouTube 16:9' },
  square:   { w: 1080, h: 1080, base: 44, k: 7, safe: { t: 90,  b: 130, l: 60, r: 60 },
              label: 'Feed square 1:1' },
  ios:      { w: 393,  h: 852,  base: 15, k: 2.5, safe: { t: 62, b: 96, l: 16, r: 16 },
              label: 'iOS app, 393x852 logical, export @3x', dpr: 3 },
  desktop:  { w: 1440, h: 900,  base: 16, k: 2.5, safe: { t: 72, b: 40, l: 32, r: 32 },
              label: 'Desktop web app, 1440x900', dpr: 2 }
};

/* ---- PALETTE ROLES ------------------------------------------
   Four running palettes, all built only from brand colors.
   ------------------------------------------------------------ */
export const PALETTES = {
  /* default for anything brand-forward, paid, or on-site */
  house:  { fill: BRAND.cream, ink: BRAND.ink, accent: BRAND.red,   pop: BRAND.gold,   sub: '#6E6B66' },
  /* loud, for chaotic UGC and TikTok */
  loud:   { fill: BRAND.white, ink: BRAND.ink, accent: BRAND.red,   pop: BRAND.amber,  sub: '#6E6B66' },
  /* premium, for investor, press, product film */
  premium:{ fill: BRAND.ink,   ink: BRAND.cream,accent: BRAND.gold, pop: BRAND.gold,   sub: '#6E6B66' },
  /* soft, for sincere beats and tutorial mode */
  soft:   { fill: BRAND.cream, ink: BRAND.ink, accent: BRAND.sPurple, pop: BRAND.sPink, sub: BRAND.grey }
};

/* accent color rotation for medallion discs, brand only */
export const DISC = [BRAND.red, BRAND.gold, BRAND.blue, BRAND.green, BRAND.orange,
                     BRAND.purple, BRAND.coral, BRAND.amber, BRAND.sSage, BRAND.sPink,
                     BRAND.sSand, BRAND.sMist];

/* ---- COLOURWAYS ---------------------------------------------
   A palette says which colours exist. A COLOURWAY says which part
   gets which one, for every part at once: caption fill, caption
   keyline, text, medallion, arrow, arrow second tone.

   This exists because "change the colours" is one decision made
   eight times, and making it eight times is how a set of
   annotations drifts out of alignment over a single edit session.
   Pass `colorway: 'night'` and everything moves together. Any
   individual prop you also pass still wins, so a colourway is a
   starting point rather than a cage.
   ------------------------------------------------------------ */
export const COLORWAYS = {
  /* the default. Cream shell, ink keyline, red arrow, gold medallion */
  house:   { captionFill: BRAND.cream, captionInk: BRAND.ink,  textColor: BRAND.ink,
             arrowFill: BRAND.red,   arrowFill2: BRAND.gold,  medallionFill: BRAND.gold,
             accent: BRAND.red,      cream: BRAND.cream },

  /* white and amber, for a busy feed. The loudest legal setting */
  /* medallion is amber, not red: the hand gestures are #ED2D3C and
     a red hand on a red disc disappears. Same reason candy uses
     sPink behind the glyph rather than coral. */
  loud:    { captionFill: BRAND.white, captionInk: BRAND.ink,  textColor: BRAND.ink,
             arrowFill: BRAND.red,   arrowFill2: BRAND.ink,   medallionFill: BRAND.amber,
             accent: BRAND.amber,    cream: BRAND.white },

  /* inverted. Ink shell, cream copy, gold everything else. Reads
     as premium on light footage and disappears on dark, so check */
  night:   { captionFill: BRAND.ink,   captionInk: BRAND.gold, textColor: BRAND.cream,
             arrowFill: BRAND.gold,  arrowFill2: BRAND.cream, medallionFill: BRAND.ink,
             accent: BRAND.gold,     cream: BRAND.cream },

  /* investor, press, product film. Nothing shouts */
  premium: { captionFill: BRAND.cream, captionInk: BRAND.ink,  textColor: BRAND.ink,
             arrowFill: BRAND.gold,  arrowFill2: BRAND.ink,   medallionFill: BRAND.cream,
             accent: BRAND.gold,     cream: BRAND.cream },

  /* the sincere register. Soft palette only */
  soft:    { captionFill: BRAND.cream, captionInk: BRAND.sPurple, textColor: BRAND.ink,
             arrowFill: BRAND.sPurple, arrowFill2: BRAND.sPink, medallionFill: BRAND.sPink,
             accent: BRAND.sPurple,  cream: BRAND.cream },

  /* pink and coral. Valentines, love, kids */
  candy:   { captionFill: BRAND.sPink, captionInk: BRAND.ink,  textColor: BRAND.ink,
             arrowFill: BRAND.coral, arrowFill2: BRAND.amber, medallionFill: BRAND.sPink,
             accent: BRAND.coral,    cream: BRAND.cream },

  /* brand red shell, cream copy. Sale, launch, urgency */
  signal:  { captionFill: BRAND.red,   captionInk: BRAND.ink,  textColor: BRAND.cream,
             arrowFill: BRAND.amber, arrowFill2: BRAND.cream, medallionFill: BRAND.amber,
             accent: BRAND.amber,    cream: BRAND.cream },

  /* no colour at all. For footage that is already loud */
  mono:    { captionFill: BRAND.cream, captionInk: BRAND.ink,  textColor: BRAND.ink,
             arrowFill: BRAND.ink,   arrowFill2: BRAND.grey,  medallionFill: BRAND.ink,
             accent: BRAND.ink,      cream: BRAND.cream }
};

/* ---- MOTION -------------------------------------------------
   30fps. Frame counts, not seconds, so editors can count them.
   ------------------------------------------------------------ */
export const MOTION = {
  in:  { frames: 7, from: 0.30, over: 1.06, to: 1.0, ease: 'cubic-bezier(.2,1.5,.4,1)' },
  out: { frames: 5, to: 0.85, fade: true },
  pointerLead: 15,          // arrow lands this many frames before its caption
  dwellBase: 2.5,           // seconds
  dwellPer10Chars: 0.35,
  cadence: [10, 15],        // seconds between nuggets
  copyCap: 120              // hard character cap
};
