"use client";

/**
 * Phone chrome for a letterboxed screen well.
 *
 * A 9:16 clip going into a phone screen has the wrong shape: a modern iPhone
 * screen is about 9:19.5, so something has to give. Cover crops the top and
 * bottom off, and `stretch` distorts — which is tolerable on scenery and
 * obvious on a face or a logo.
 *
 * The third answer is the one a real phone gives: letterbox it, and fill the
 * bands with the phone's own furniture. Black bars on a phone screen read as a
 * rendering fault; black bars with a clock above them and a home indicator
 * below read as a phone playing a video, which is what the shot is of. Nothing
 * is cropped and nothing is distorted.
 *
 * Drawn as an SVG rather than twice — once in CSS for the editor and once in
 * canvas for the export — because those two drifting apart is how a preview
 * stops being a preview. The editor puts this in an <img> and the export
 * rasterises the same string, so there is one description of what the chrome
 * looks like.
 */

/* ---------------------------------------------------------------------------
 * Proportions, as fractions of the screen's WIDTH.
 *
 * Width rather than height because a phone's furniture scales with how wide
 * the screen is, not how tall — the clock is the same size on a 19.5:9 phone
 * as on a 16:9 one. Measured off an iPhone 15's 393 × 852pt screen:
 * a 54pt status bar, a 139 × 5pt home indicator sitting 8pt off the bottom.
 * ------------------------------------------------------------------------ */

/** Status bar height. 54/393. */
const STATUS_H = 0.137;
/** Clock size. 17pt semibold at 393. */
const CLOCK_SIZE = 0.0433;
/** Home indicator: 139 × 5pt, 8pt off the bottom. */
const HOME_W = 0.354;
const HOME_H = 0.0127;
const HOME_INSET = 0.020;

/**
 * The face Apple puts in every screenshot, and so the one that reads as "a
 * phone" rather than "someone's actual phone at 3pm".
 */
export const DEFAULT_CLOCK = "9:41";

/**
 * How the media sits inside the screen when it is letterboxed.
 *
 * `contain`, in other words — but it also hands back the band heights, which
 * is what decides whether there is room for any chrome at all.
 */
export function letterbox(
  screenW: number,
  screenH: number,
  mediaW: number,
  mediaH: number,
): { x: number; y: number; w: number; h: number; top: number; bottom: number } {
  const safeW = Math.max(1, mediaW);
  const safeH = Math.max(1, mediaH);
  const scale = Math.min(screenW / safeW, screenH / safeH);
  const w = safeW * scale;
  const h = safeH * scale;
  const x = (screenW - w) / 2;
  const y = (screenH - h) / 2;
  return { x, y, w, h, top: y, bottom: screenH - (y + h) };
}

/**
 * Whether the bands are deep enough to hold the furniture.
 *
 * A clip whose shape already matches the screen letterboxes to nothing, and
 * painting a status bar over the picture would be worse than painting no status
 * bar at all. The mode then degenerates to a plain contain, which for matching
 * shapes is identical to cover — so nothing looks broken, there is simply
 * nothing to add.
 */
export function chromeFits(screenW: number, top: number, bottom: number): boolean {
  return top >= screenW * STATUS_H && bottom >= screenW * (HOME_H + HOME_INSET * 2);
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The chrome layer, covering the whole screen with a transparent middle.
 *
 * Opaque bands rather than a bare overlay: they guarantee the letterbox area
 * is properly black even if the media beneath is a hair larger than its box, or
 * the surface under the well is not black to begin with.
 *
 * The glyphs are drawn from primitives — no icon font, no external reference.
 * An SVG rasterised through <img> may not fetch anything at all, which is
 * written up on inlineExternalRefs in render-video.ts and which a webfont for
 * the clock would walk straight into. The clock uses a system stack, so it is
 * SF on the Macs this is built on and something sane everywhere else.
 */
export function screenChromeSvg(opts: {
  /** Screen size in whatever units the caller is drawing in. */
  w: number;
  h: number;
  /** Band depths from `letterbox`. */
  top: number;
  bottom: number;
  clock?: string;
}): string {
  const { w, h, top, bottom } = opts;
  const clock = esc(opts.clock?.trim() || DEFAULT_CLOCK);

  const statusH = w * STATUS_H;
  const cy = statusH / 2;
  const fs = w * CLOCK_SIZE;

  /* The clock sits centred in the left third, where a phone puts it. */
  const clockX = w * 0.168;

  /*
   * The icon cluster, laid out right to left from the screen edge.
   *
   * Right to left because that is how the real thing is anchored, and because
   * placing each icon by its own left edge — which the first attempt did — let
   * the cellular bars run into the wifi arcs as soon as the proportions moved.
   * Every number below is iPhone 15 furniture over its 393pt screen: an 18pt
   * margin, a 24.3 × 11.7pt battery, a 15.3pt wifi, 17pt of cellular bars, and
   * 5pt between each.
   */
  const EDGE = 0.0458;
  const GAP = 0.0127;
  const ICON_H = 0.0280;
  const iconH = w * ICON_H;

  const batW = w * 0.0618;
  const batH = w * 0.0298;
  const batRight = w * (1 - EDGE);
  const batX = batRight - batW;
  const batY = cy - batH / 2;
  const stroke = w * 0.0035;

  const battery =
    `<rect x="${batX.toFixed(2)}" y="${batY.toFixed(2)}" width="${batW.toFixed(2)}" height="${batH.toFixed(2)}" rx="${(batH * 0.32).toFixed(2)}" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="${stroke.toFixed(2)}"/>` +
    `<rect x="${(batX + stroke * 1.4).toFixed(2)}" y="${(batY + stroke * 1.4).toFixed(2)}" width="${((batW - stroke * 2.8) * 0.72).toFixed(2)}" height="${(batH - stroke * 2.8).toFixed(2)}" rx="${(batH * 0.18).toFixed(2)}" fill="#fff"/>` +
    `<path d="M ${(batRight + stroke * 0.6).toFixed(2)} ${(cy - batH * 0.17).toFixed(2)} a ${(batH * 0.17).toFixed(2)} ${(batH * 0.17).toFixed(2)} 0 0 1 0 ${(batH * 0.34).toFixed(2)} z" fill="#fff" fill-opacity="0.45"/>`;

  /*
   * Wifi: three arcs about a common centre, plus the dot.
   *
   * The sweep is the whole character of this glyph. Drawn as a half circle —
   * which is what an A command from (cx-r) to (cx+r) gives you — it reads as a
   * rainbow, not a signal. The real mark is a narrow fan, so the arcs span
   * about 55 degrees either side of vertical and the ends are cut well above
   * the baseline.
   */
  const wifiW = w * 0.0389;
  const wifiRight = batX - w * GAP;
  const wx = wifiRight - wifiW / 2;
  const wy = cy + iconH / 2;
  const wifiStroke = w * 0.0040;
  const SWEEP = (55 * Math.PI) / 180;
  const sinS = Math.sin(SWEEP);
  const cosS = Math.cos(SWEEP);
  let wifi = "";
  for (let i = 0; i < 3; i++) {
    const r = (wifiW / 2) * (1 - i * 0.31);
    const x0 = wx - r * sinS;
    const x1 = wx + r * sinS;
    const y0 = wy - r * cosS;
    wifi += `<path d="M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x1.toFixed(2)} ${y0.toFixed(2)}" fill="none" stroke="#fff" stroke-width="${wifiStroke.toFixed(2)}" stroke-linecap="round"/>`;
  }
  wifi += `<circle cx="${wx.toFixed(2)}" cy="${(wy - wifiStroke * 0.4).toFixed(2)}" r="${(wifiStroke * 0.78).toFixed(2)}" fill="#fff"/>`;

  /* Cellular: four bars on a common baseline, growing left to right. */
  const cellW = w * 0.0433;
  const cellRight = wifiRight - wifiW - w * GAP;
  const barW = cellW / 5.8;
  const barGap = (cellW - barW * 4) / 3;
  const barBase = cy + iconH / 2;
  let cellular = "";
  for (let i = 0; i < 4; i++) {
    const bh = iconH * (0.34 + i * 0.22);
    const bx = cellRight - cellW + i * (barW + barGap);
    cellular += `<rect x="${bx.toFixed(2)}" y="${(barBase - bh).toFixed(2)}" width="${barW.toFixed(2)}" height="${bh.toFixed(2)}" rx="${(barW * 0.34).toFixed(2)}" fill="#fff"/>`;
  }

  const homeW = w * HOME_W;
  const homeH = w * HOME_H;
  const homeY = h - w * HOME_INSET - homeH;

  /*
   * Bands only. The middle stays transparent so whatever is drawn underneath —
   * the clip — shows through untouched.
   */
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<rect x="0" y="0" width="${w}" height="${Math.max(0, top).toFixed(2)}" fill="#000"/>`,
    `<rect x="0" y="${(h - Math.max(0, bottom)).toFixed(2)}" width="${w}" height="${Math.max(0, bottom).toFixed(2)}" fill="#000"/>`,
    `<text x="${clockX.toFixed(2)}" y="${cy.toFixed(2)}" fill="#fff" font-size="${fs.toFixed(2)}"`,
    ` font-family="-apple-system, system-ui, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif"`,
    ` font-weight="600" text-anchor="middle" dominant-baseline="central">${clock}</text>`,
    cellular,
    wifi,
    battery,
    `<rect x="${((w - homeW) / 2).toFixed(2)}" y="${homeY.toFixed(2)}" width="${homeW.toFixed(2)}" height="${homeH.toFixed(2)}" rx="${(homeH / 2).toFixed(2)}" fill="#fff"/>`,
    `</svg>`,
  ].join("");
}

/** The same string as a data URI, for an <img> or a canvas rasterise. */
export function screenChromeUri(opts: Parameters<typeof screenChromeSvg>[0]): string {
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(screenChromeSvg(opts))));
}
