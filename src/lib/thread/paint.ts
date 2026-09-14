"use client";

import { screenChromeSvg } from "@/lib/popkit/screen-chrome";
import { bubbleFont, layout, metrics, viewport, type LaidOut, type Metrics } from "./layout";
import { BEATS, cardStartsAt, schedule, type Scheduled, type Thread } from "./thread";

/**
 * One frame of the thread, at time t.
 *
 * The only place anything is drawn. The editor calls it into a visible canvas
 * and the export calls it into the encoder's canvas, so a thing that looks
 * right while editing cannot come out different in the file — which is the
 * failure mode the whole canvas-not-DOM decision exists to avoid.
 */

const INK = {
  bg: "#000000",
  bubbleThem: "#26262a",
  bubbleMe: "#0b84ff",
  text: "#ffffff",
  muted: "#8e8e93",
  headerLine: "#2c2c2e",
  compose: "#1c1c1e",
  sheet: "#1c1c1e",
  sheetBar: "#2c2c2e",
} as const;

const ease = (p: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
/** Overshoot, so a bubble lands rather than arriving. */
const pop = (p: number) => {
  const c = 1.70158 + 1;
  const x = Math.min(1, Math.max(0, p));
  return 1 + c * Math.pow(x - 1, 3) + 1.70158 * Math.pow(x - 1, 2);
};

function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

export interface ThreadFrame {
  thread: Thread;
  /** Canvas size. The screen fills the frame; there is no device body. */
  w: number;
  h: number;
  /** The card animation's current frame, once it is playing. */
  card?: CanvasImageSource | null;
  /** The link preview's thumbnail. */
  thumb?: CanvasImageSource | null;
  /** Rasterised status bar and home indicator, from screen-chrome. */
  chrome?: CanvasImageSource | null;
  /** How long the card animation runs, so the clip knows when it ends. */
  cardSeconds: number;
}

/** The chrome for this frame size — bands at the status bar and home indicator. */
export function chromeSvgFor(w: number, h: number, clock: string): string {
  const m = metrics(w);
  return screenChromeSvg({ w, h, top: m.statusH, bottom: m.homeH, clock });
}

/**
 * Where the thread has scrolled to at time t.
 *
 * Pinned to the bottom of whatever has arrived, and eased rather than jumped:
 * a list that snaps is the other tell that gives these videos away. Messages
 * that were already on screen at t=0 are included, which is what makes the
 * opening frame look like a conversation in progress rather than an empty one.
 */
function scrollAt(
  items: LaidOut[], sched: Scheduled[], t: number, view: number, m: Metrics,
  /** Bottom of the typing bubble, when one is showing. */
  typingBottom: number | null,
): number {
  let landed = -1;
  sched.forEach((s, i) => {
    if (s.at < 0 || t >= s.at) landed = i;
  });
  if (landed < 0) return -view;
  const item = items[landed];
  /*
   * Deliberately not clamped at zero.
   *
   * A short conversation is shorter than the screen, and a negative scroll is
   * what pushes it down so it rests on the compose bar and grows upward — which
   * is how a real thread sits. Clamped at zero it hangs from the header with
   * empty black beneath it, which was the first thing that looked wrong about
   * this and the reason the bottom anchor is not a separate special case.
   */
  /*
   * The three dots count as content.
   *
   * A phone scrolls up to make room for them, and not doing so put the typing
   * bubble just below the fold — the indicator was being painted every frame
   * and was never once visible.
   */
  const bottom = Math.max(item.y + item.h, typingBottom ?? 0);
  const want = bottom + m.gapOther - view;

  // Ease from where the previous message had it, over the beat after landing.
  const previous = landed > 0 ? items[landed - 1] : null;
  const from = previous ? previous.y + previous.h + m.gapOther - view : want;
  const at = sched[landed].at;
  if (at < 0) return want;
  const p = ease((t - at) / 0.42);
  return from + (want - from) * p;
}

/** Draw one bubble, with its tail. */
function bubble(ctx: CanvasRenderingContext2D, item: LaidOut, m: Metrics, alpha: number, rise: number) {
  const b = item.box;
  if (!b) return;
  const me = item.message.from === "me";
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, rise);
  ctx.fillStyle = me ? INK.bubbleMe : INK.bubbleThem;
  roundRect(ctx, b.x, b.y, b.w, b.h, m.radius);
  ctx.fill();

  /*
   * The tail. A small filled wedge at the bottom outer corner rather than a
   * separate stroked shape — at this size the difference is invisible and a
   * wedge cannot leave a seam where it meets the bubble.
   */
  const ty = b.y + b.h;
  const tw = m.radius * 0.62;
  ctx.beginPath();
  if (me) {
    ctx.moveTo(b.x + b.w - m.radius * 0.4, ty - m.radius * 0.5);
    ctx.quadraticCurveTo(b.x + b.w + tw * 0.5, ty, b.x + b.w + tw, ty - tw * 0.1);
    ctx.quadraticCurveTo(b.x + b.w - tw * 0.1, ty - tw * 0.2, b.x + b.w - m.radius, ty);
  } else {
    ctx.moveTo(b.x + m.radius * 0.4, ty - m.radius * 0.5);
    ctx.quadraticCurveTo(b.x - tw * 0.5, ty, b.x - tw, ty - tw * 0.1);
    ctx.quadraticCurveTo(b.x + tw * 0.1, ty - tw * 0.2, b.x + m.radius, ty);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = INK.text;
  ctx.font = bubbleFont(m);
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  item.lines.forEach((line, i) => {
    ctx.fillText(line, b.x + m.bubblePadX, b.y + m.bubblePadY + m.lineH * (i + 0.5));
  });
  ctx.restore();
}

/** The three dots, while somebody is typing. */
function typing(ctx: CanvasRenderingContext2D, x: number, y: number, m: Metrics, t: number) {
  ctx.save();
  ctx.fillStyle = INK.bubbleThem;
  roundRect(ctx, x, y, m.typingW, m.typingH, m.typingH / 2);
  ctx.fill();
  const r = m.typingH * 0.105;
  for (let i = 0; i < 3; i++) {
    // Each dot rises on its own phase, which is the whole character of it.
    const phase = (t * 1.6 - i * 0.18) % 1;
    const lift = Math.sin(Math.max(0, Math.min(1, phase * 2)) * Math.PI) * r * 0.9;
    ctx.globalAlpha = 0.45 + 0.55 * (lift / (r * 0.9));
    ctx.fillStyle = "#b4b4ba";
    ctx.beginPath();
    ctx.arc(x + m.typingW / 2 + (i - 1) * r * 2.9, y + m.typingH / 2 - lift, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The link preview that ends the thread. */
function linkCard(
  ctx: CanvasRenderingContext2D, item: LaidOut, thread: Thread, m: Metrics,
  thumb: CanvasImageSource | null | undefined, alpha: number, rise: number, press: number,
) {
  const b = item.box;
  if (!b) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, rise);
  // The press flash, as a scale about the card's own centre.
  if (press > 0) {
    const s = 1 - 0.035 * press;
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(s, s);
    ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
  }
  const imgH = b.w * 0.56;
  roundRect(ctx, b.x, b.y, b.w, b.h, m.radius);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "#2c2c2e";
  ctx.fillRect(b.x, b.y, b.w, b.h);
  if (thumb) {
    const tw = (thumb as HTMLImageElement).naturalWidth || (thumb as HTMLCanvasElement).width || 1;
    const th = (thumb as HTMLImageElement).naturalHeight || (thumb as HTMLCanvasElement).height || 1;
    const cover = Math.max(b.w / tw, imgH / th);
    ctx.drawImage(thumb, b.x + (b.w - tw * cover) / 2, b.y + (imgH - th * cover) / 2, tw * cover, th * cover);
  }
  ctx.fillStyle = "#1c1c1e";
  ctx.fillRect(b.x, b.y + imgH, b.w, b.h - imgH);
  ctx.fillStyle = INK.text;
  ctx.font = `600 ${m.font * 0.86}px -apple-system, system-ui, sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(thread.cardTitle, b.x + m.bubblePadX * 0.8, b.y + imgH + m.cardTextH * 0.42);
  ctx.fillStyle = INK.muted;
  ctx.font = `${m.font * 0.72}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(thread.cardDomain, b.x + m.bubblePadX * 0.8, b.y + imgH + m.cardTextH * 0.78);
  ctx.restore();
  ctx.restore();
}

/**
 * Paints the whole frame.
 *
 * The clip has two acts and the second one grows out of the first: the phone
 * is drawn, then — once the card is playing — the frame closes in on the sheet
 * until the card fills it. Doing the push as a transform over the same drawing
 * rather than as a cut keeps it continuous, which is what makes it read as a
 * camera move rather than an edit.
 */
export function paintThread(ctx: CanvasRenderingContext2D, f: ThreadFrame, t: number): void {
  const { thread, w, h } = f;
  const m = metrics(w);
  const { items } = layout(ctx, thread, w, m);
  const { items: sched, threadEnds } = schedule(thread);
  const view = viewport(h, m);

  const cardAt = cardStartsAt(threadEnds);
  const sheetAt = threadEnds + BEATS.dwell + BEATS.tap;
  const pushAt = cardAt + BEATS.inPhone;
  const pushP = ease((t - pushAt) / BEATS.push);

  /*
   * The push-in, expressed as a transform on everything below.
   *
   * The target is the sheet's own rectangle blown up to the full frame, so the
   * move ends exactly when the card is edge to edge. Worked out from the sheet
   * geometry rather than typed in, or the two would drift the moment any
   * margin changed.
   */
  const sheetTop = m.statusH;
  const cardBox = { x: 0, y: sheetTop + m.headerH * 0.62, w, h: h - sheetTop - m.headerH * 0.62 - m.homeH };
  const cardAspect = f.card
    ? ((f.card as HTMLVideoElement).videoWidth || (f.card as HTMLCanvasElement).width || 9) /
      ((f.card as HTMLVideoElement).videoHeight || (f.card as HTMLCanvasElement).height || 16)
    : 9 / 16;
  const fitted = (() => {
    const s = Math.min(cardBox.w / cardAspect, cardBox.h) ;
    return { w: s * cardAspect, h: s };
  })();
  const fitX = cardBox.x + (cardBox.w - fitted.w) / 2;
  const fitY = cardBox.y + (cardBox.h - fitted.h) / 2;

  ctx.save();
  if (pushP > 0) {
    const target = Math.min(w / fitted.w, h / fitted.h);
    const s = 1 + (target - 1) * pushP;
    const cx = fitX + fitted.w / 2;
    const cy = fitY + fitted.h / 2;
    ctx.translate(w / 2, h / 2);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
  }

  ctx.fillStyle = INK.bg;
  ctx.fillRect(-w, -h, w * 3, h * 3);

  /* ---- the thread column ---- */
  /* The three dots, wherever the next incoming message is about to land. */
  const pending = sched.find((s) => s.typingAt !== null && t >= s.typingAt && t < s.at);
  const typingBottom = pending ? items[pending.index].y + m.typingH : null;

  const scroll = scrollAt(items, sched, t, view.height, m, typingBottom);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, view.top, w, view.height);
  ctx.clip();
  ctx.translate(0, view.top - scroll);

  items.forEach((item, i) => {
    const s = sched[i];
    if (s.at >= 0 && t < s.at) return;
    // Landing: a short rise and fade, with a little overshoot on the scale.
    const age = s.at < 0 ? 1 : (t - s.at) / 0.28;
    const p = Math.min(1, Math.max(0, age));
    const alpha = p;
    const rise = (1 - pop(p)) * m.lineH * 1.1;

    if (item.message.kind === "divider") {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = INK.muted;
      ctx.font = `600 ${m.dividerFont}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.lines[0], w / 2, item.y + m.dividerH / 2 + rise);
      ctx.restore();
      return;
    }
    if (item.message.kind === "link") {
      const press = t >= threadEnds + BEATS.dwell && t < sheetAt ? 1 : 0;
      linkCard(ctx, item, thread, m, f.thumb, alpha, rise, press);
    } else {
      bubble(ctx, item, m, alpha, rise);
    }
    if (item.receiptY !== undefined) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = INK.muted;
      ctx.font = `${m.receiptFont}px -apple-system, system-ui, sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillText(
        item.message.receipt === "read" ? "Read" : "Delivered",
        w - m.pad, item.receiptY + m.receiptH * 0.35 + rise,
      );
      ctx.restore();
    }
  });

  if (pending) typing(ctx, m.pad, items[pending.index].y, m, t);
  ctx.restore();

  /* ---- header ---- */
  ctx.fillStyle = INK.bg;
  ctx.fillRect(0, 0, w, view.top);
  ctx.strokeStyle = INK.headerLine;
  ctx.lineWidth = Math.max(1, w * 0.0012);
  ctx.beginPath();
  ctx.moveTo(0, view.top);
  ctx.lineTo(w, view.top);
  ctx.stroke();

  const avatarR = m.headerH * 0.30;
  const avatarY = m.statusH + m.headerH * 0.40;
  ctx.fillStyle = "#3a3a3c";
  ctx.beginPath();
  ctx.arc(w / 2, avatarY, avatarR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK.text;
  ctx.font = `600 ${avatarR * 0.95}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((thread.contact.trim()[0] || "?").toUpperCase(), w / 2, avatarY + avatarR * 0.03);
  ctx.font = `${m.dividerFont * 1.05}px -apple-system, system-ui, sans-serif`;
  ctx.fillText(thread.contact, w / 2, m.statusH + m.headerH * 0.82);

  /* ---- compose bar ---- */
  const composeY = h - m.homeH - m.composeH;
  ctx.fillStyle = INK.bg;
  ctx.fillRect(0, composeY, w, m.composeH + m.homeH);
  ctx.fillStyle = INK.compose;
  roundRect(ctx, m.pad, composeY + m.composeH * 0.18, w - m.pad * 2, m.composeH * 0.6, m.composeH * 0.3);
  ctx.fill();
  ctx.fillStyle = INK.muted;
  ctx.font = `${m.font * 0.85}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("iMessage", m.pad + m.bubblePadX, composeY + m.composeH * 0.48);

  /* ---- the browser sheet, rising ---- */
  if (t >= sheetAt) {
    const up = ease((t - sheetAt) / BEATS.sheet);
    const top = h - (h - sheetTop) * up;
    ctx.save();
    ctx.fillStyle = INK.sheet;
    roundRect(ctx, 0, top, w, h - top, m.radius * 1.4);
    ctx.fill();
    ctx.save();
    roundRect(ctx, 0, top, w, h - top, m.radius * 1.4);
    ctx.clip();

    // Address bar.
    ctx.fillStyle = INK.sheetBar;
    roundRect(ctx, m.pad * 1.6, top + m.headerH * 0.18, w - m.pad * 3.2, m.headerH * 0.42, m.headerH * 0.21);
    ctx.fill();
    ctx.fillStyle = INK.muted;
    ctx.font = `${m.font * 0.78}px -apple-system, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(thread.cardDomain, w / 2, top + m.headerH * 0.40);

    const bodyTop = top + m.headerH * 0.62;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, bodyTop, w, h - bodyTop);

    if (t < cardAt) {
      // The spinner, while it "loads".
      const spin = (t - sheetAt) * 3.4;
      const r = w * 0.035;
      ctx.save();
      ctx.translate(w / 2, bodyTop + (h - bodyTop) / 2);
      ctx.rotate(spin * Math.PI * 2);
      for (let i = 0; i < 8; i++) {
        ctx.globalAlpha = 0.18 + (i / 8) * 0.62;
        ctx.fillStyle = "#fff";
        ctx.save();
        ctx.rotate((i / 8) * Math.PI * 2);
        roundRect(ctx, r * 0.55, -r * 0.09, r * 0.5, r * 0.18, r * 0.09);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    } else if (f.card) {
      ctx.drawImage(f.card, fitX, fitY, fitted.w, fitted.h);
    }
    ctx.restore();
    ctx.restore();
  }

  /* ---- status bar and home indicator, over everything ---- */
  if (f.chrome && pushP < 1) {
    ctx.save();
    ctx.globalAlpha = 1 - pushP;
    ctx.drawImage(f.chrome, 0, 0, w, h);
    ctx.restore();
  }

  ctx.restore();
}
