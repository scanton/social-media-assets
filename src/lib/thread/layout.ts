"use client";

import type { Thread, ThreadMessage } from "./thread";

/**
 * Where every bubble sits, measured in canvas pixels.
 *
 * Laid out rather than styled, because the thread is painted to a canvas and
 * not built from DOM. That is a deliberate trade: no CSS means writing word
 * wrap by hand, and in exchange the editor preview and the exported video are
 * the same function, and the export can go through the deterministic encoder
 * instead of a screen recorder. The creator's demo took the other road and its
 * own README ends with "use OBS, browser recording has been unreliable".
 *
 * Everything scales off the canvas WIDTH. A thread is a column: how wide it is
 * decides the type size, the bubble width and the padding, and the height only
 * decides how much of it you can see at once.
 */

/* All as fractions of canvas width, tuned against a 1080px frame. */
const M = {
  /** Status bar, drawn by screen-chrome. */
  statusH: 0.137,
  /** The contact header under it. */
  headerH: 0.105,
  /** Side margin for the whole column. */
  pad: 0.037,
  /** Widest a bubble may get. */
  maxBubble: 0.72,
  font: 0.0405,
  lineH: 0.053,
  bubblePadX: 0.0315,
  bubblePadY: 0.0225,
  radius: 0.0345,
  /** Vertical space between consecutive bubbles from the same sender. */
  gapSame: 0.0111,
  /** …and from different senders. */
  gapOther: 0.0259,
  dividerH: 0.062,
  dividerFont: 0.0268,
  receiptH: 0.040,
  receiptFont: 0.0250,
  /** The link card that ends the thread. */
  cardW: 0.60,
  cardTextH: 0.093,
  /** Typing indicator bubble. */
  typingW: 0.148,
  typingH: 0.078,
  /** The compose bar pinned to the bottom. */
  composeH: 0.105,
  homeH: 0.052,
} as const;

export type Metrics = { -readonly [K in keyof typeof M]: number };

export function metrics(w: number): Metrics {
  const out = {} as Metrics;
  for (const [k, v] of Object.entries(M)) out[k as keyof Metrics] = v * w;
  return out;
}

export const bubbleFont = (m: Metrics) =>
  `${m.font}px -apple-system, system-ui, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`;

/**
 * Greedy word wrap.
 *
 * Greedy rather than balanced because that is what a message bubble does: it
 * fills each line and breaks at the last word that fits. A single word longer
 * than the line is broken mid-word rather than allowed to overflow, which is
 * rare in a text message and catastrophic when it happens — a URL, usually.
 */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) {
        // A lone word that still does not fit gets cut into pieces.
        if (!line && ctx.measureText(word).width > maxWidth) {
          let piece = "";
          for (const ch of word) {
            if (ctx.measureText(piece + ch).width > maxWidth && piece) {
              lines.push(piece);
              piece = ch;
            } else {
              piece += ch;
            }
          }
          line = piece;
          continue;
        }
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export interface LaidOut {
  message: ThreadMessage;
  index: number;
  /** Top of the item within the scrolling column, in canvas px. */
  y: number;
  h: number;
  /** Bubble box. Absent for dividers. */
  box?: { x: number; y: number; w: number; h: number };
  lines: string[];
  /** Set on the outgoing bubble that carries a receipt. */
  receiptY?: number;
}

/**
 * Lay the whole thread out as one tall column.
 *
 * The column is measured in full even though only a screen's worth is ever
 * visible, because scrolling is just an offset into it and the animation needs
 * to know where a message WILL be before it has arrived.
 */
export function layout(
  ctx: CanvasRenderingContext2D,
  thread: Thread,
  w: number,
  m: Metrics,
): { items: LaidOut[]; height: number } {
  ctx.font = bubbleFont(m);
  const maxText = m.maxBubble - m.bubblePadX * 2;
  const items: LaidOut[] = [];
  let y = 0;

  thread.messages.forEach((message, index) => {
    const previous = thread.messages[index - 1];
    if (index > 0) {
      y +=
        previous && previous.from === message.from && previous.kind === "bubble"
          ? m.gapSame
          : m.gapOther;
    }

    if (message.kind === "divider") {
      items.push({ message, index, y, h: m.dividerH, lines: [message.text] });
      y += m.dividerH;
      return;
    }

    if (message.kind === "link") {
      /*
       * A link preview is a thumbnail with a caption strip under it. The
       * thumbnail's height is a share of the card's own width, so the whole
       * thing scales with the column like everything else here.
       */
      const cardH = m.cardW * 0.56 + m.cardTextH;
      const x = message.from === "me" ? w - m.pad - m.cardW : m.pad;
      items.push({
        message,
        index,
        y,
        h: cardH,
        box: { x, y, w: m.cardW, h: cardH },
        lines: [],
        receiptY: message.receipt ? y + cardH + m.receiptH * 0.15 : undefined,
      });
      y += cardH + (message.receipt ? m.receiptH : 0);
      return;
    }

    const lines = wrap(ctx, message.text, maxText);
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
    const bw = Math.min(m.maxBubble, textW + m.bubblePadX * 2);
    const bh = lines.length * m.lineH + m.bubblePadY * 2;
    const x = message.from === "me" ? w - m.pad - bw : m.pad;
    items.push({
      message,
      index,
      y,
      h: bh,
      box: { x, y, w: bw, h: bh },
      lines,
      receiptY: message.receipt ? y + bh + m.receiptH * 0.15 : undefined,
    });
    y += bh + (message.receipt ? m.receiptH : 0);
  });

  return { items, height: y };
}

/** The scrolling viewport: between the header and the compose bar. */
export function viewport(h: number, m: Metrics) {
  const top = m.statusH + m.headerH;
  const bottom = h - m.composeH - m.homeH;
  return { top, bottom, height: bottom - top };
}
