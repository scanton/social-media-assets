"use client";

/**
 * A text-message thread that ends in a card.
 *
 * The shape of the content, and the schedule derived from it. Nothing here
 * draws; see paint.ts.
 *
 * WHY THE SCHEDULE IS DERIVED RATHER THAN AUTHORED
 * The creator's demo scrolled a finished thread, which reads as somebody
 * scrolling back through an old conversation — not as a conversation
 * happening. What sells "live" is the gaps: a pause, three dots, a bubble, a
 * beat, a reply. Those are a function of what each message IS — who sent it and
 * how long it is — so they are computed, and the editor exposes only the two
 * knobs worth touching (where live starts, and how fast it all runs).
 */

export type Sender = "me" | "them";

export interface ThreadMessage {
  id: string;
  /** A bubble, a centred time divider, or the card link that ends the thread. */
  kind: "bubble" | "divider" | "link";
  from: Sender;
  text: string;
  /** Under an outgoing bubble. Ignored on incoming ones, which never carry it. */
  receipt?: "delivered" | "read";
  /** Overrides the derived pause before this message, in seconds. */
  gap?: number;
}

export interface Thread {
  /** Who the conversation is with — the header name, and the avatar initials. */
  contact: string;
  /** The status-bar clock. 9:41 is the one that reads as "a phone". */
  clock: string;
  messages: ThreadMessage[];
  /**
   * Index of the first message that animates in.
   *
   * Everything before it is already on screen when the clip starts, which is
   * the whole point: a thread that begins empty reads as a demo, and one that
   * begins mid-conversation reads as a real phone somebody just picked up.
   */
  liveFrom: number;
  /** Multiplier on every derived pause. Below 1 is brisker. */
  pace: number;
  /**
   * Phone sounds: a chime per message, and a tap on the link.
   *
   * One switch for the whole thread rather than a flag per message. A
   * conversation where some messages are audible and others are not does not
   * describe anything real, and the per-message control would be four more
   * clicks to arrive back where this started.
   */
  sound: boolean;
  /** The card link's preview: title, domain, and the thumbnail. */
  cardTitle: string;
  cardDomain: string;
}

export const DEFAULT_THREAD: Thread = {
  contact: "Mom",
  clock: "9:41",
  liveFrom: 3,
  pace: 1,
  sound: true,
  cardTitle: "A card for you 💌",
  cardDomain: "heartstamp.com",
  messages: [
    { id: "m1", kind: "divider", from: "them", text: "Today 9:38 AM" },
    { id: "m2", kind: "bubble", from: "them", text: "Are we still on for Sunday?" },
    { id: "m3", kind: "bubble", from: "me", text: "Wouldn't miss it" },
    { id: "m4", kind: "bubble", from: "them", text: "Good! I've been looking forward to it all week" },
    { id: "m5", kind: "bubble", from: "me", text: "Same. I actually made you something" },
    { id: "m6", kind: "bubble", from: "them", text: "You did what" },
    { id: "m7", kind: "link", from: "me", text: "", receipt: "read" },
  ],
};

/* ------------------------------ the schedule ------------------------------ */

/** Reading speed, in characters per second, for the pause a reply implies. */
const READ_CPS = 28;
/** Typing speed, for how long the three dots run before an incoming bubble. */
const TYPE_CPS = 18;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export interface Scheduled {
  message: ThreadMessage;
  index: number;
  /** When the bubble lands. Negative means it was already on screen. */
  at: number;
  /** When the typing indicator appears, for incoming bubbles that get one. */
  typingAt: number | null;
}

/**
 * When each message arrives.
 *
 * Incoming messages get three dots first, for about as long as the message
 * would take to type — a long message that appears after half a second is the
 * tell that gives these away. Outgoing ones do not: you know what you wrote, so
 * they land as soon as the pause before them is up.
 *
 * The pause before a message is how long the PREVIOUS one takes to read, which
 * is why it scales with that message's length rather than being a constant.
 * Floors and ceilings on both, because neither a two-character reply nor a
 * paragraph should set the rhythm on its own.
 */
export function schedule(thread: Thread): { items: Scheduled[]; threadEnds: number } {
  const live = clamp(thread.liveFrom, 0, thread.messages.length);
  const pace = thread.pace > 0 ? thread.pace : 1;
  let t = 0;
  const items: Scheduled[] = [];

  thread.messages.forEach((message, index) => {
    if (index < live) {
      items.push({ message, index, at: -1, typingAt: null });
      return;
    }

    const previous = thread.messages[index - 1];
    const readPause =
      previous && previous.kind !== "divider"
        ? clamp(previous.text.length / READ_CPS, 0.55, 2.6)
        : 0.5;
    const gap = (message.gap ?? readPause) * pace;
    t += gap;

    let typingAt: number | null = null;
    if (message.from === "them" && message.kind === "bubble") {
      const typeFor = clamp(message.text.length / TYPE_CPS, 0.9, 3.2) * pace;
      typingAt = t;
      t += typeFor;
    }
    items.push({ message, index, at: t, typingAt });
    // The beat the bubble itself takes to settle before anything else moves.
    t += 0.32 * pace;
  });

  return { items, threadEnds: t };
}

/* ------------------------- the act after the thread ----------------------- */

/**
 * What happens once the last message has landed, in seconds from `threadEnds`.
 *
 * A tap, a browser sheet, a moment of loading, then the card — and then the
 * frame closes in on the card until it fills the video, because a card
 * animation playing at phone size inside a phone inside a social post is
 * three levels of small.
 */
export const BEATS = {
  /** Looking at the link before tapping it. */
  dwell: 0.9,
  /** The press flash. */
  tap: 0.18,
  /** The sheet rising from the bottom. */
  sheet: 0.42,
  /** Spinner, before the card appears. */
  loading: 0.55,
  /** How long the card plays inside the phone before the push-in starts. */
  inPhone: 1.6,
  /** The push from phone-sized to full-frame. */
  push: 1.1,
} as const;

/** When the card video starts playing, relative to the start of the clip. */
export const cardStartsAt = (threadEnds: number) =>
  threadEnds + BEATS.dwell + BEATS.tap + BEATS.sheet + BEATS.loading;

/** Total clip length, given how long the card animation runs. */
export function clipLength(threadEnds: number, cardSeconds: number): number {
  return cardStartsAt(threadEnds) + Math.max(0.5, cardSeconds);
}
