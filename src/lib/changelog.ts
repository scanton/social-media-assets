/**
 * What shipped, release by release — newest first.
 *
 * Written for the people using the studio, not for whoever reads the diff: what
 * changed for them, and what to do differently. The commit messages carry the
 * engineering story; this carries the "so what".
 *
 * To ship a release, add an entry to the TOP of the list. The page reads the
 * first entry as "the latest update", and the header link's dot compares its
 * `id` against what this browser last opened.
 */

export type ChangeKind = "new" | "improved" | "fixed";

export interface Change {
  kind: ChangeKind;
  /** Which part of the studio. Shown as a chip. */
  area: string;
  title: string;
  detail?: string;
}

export interface Release {
  /** Stable and unique. Changing it re-flags the release as unseen. */
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  title: string;
  summary?: string;
  changes: Change[];
}

export const CHANGELOG: Release[] = [
  {
    id: "2026-09-17",
    date: "2026-09-17",
    title: "Device Shots, OpenAI images, and sound everywhere",
    summary:
      "A new tool for closeup device plates, a choice of where your images and videos are rendered, and sound effects for the Thread tool and PopKit.",
    changes: [
      {
        kind: "new",
        area: "Device Shots",
        title: "A new tool for extreme closeups of a device with a blank white screen",
        detail:
          "Pick the device, whose hand is holding it, and the setting; render at any social aspect ratio. The screen is left clean and nothing is allowed to cross it, so card artwork can be dropped onto it afterwards. Opens on one render at a time.",
      },
      {
        kind: "new",
        area: "Providers",
        title: "Separate switches for where images and videos are rendered",
        detail:
          "Images can run on fal, Replicate or OpenAI; videos on fal or Replicate. Images now default to OpenAI and videos to Replicate. If you use two different providers, you'll need a key for each.",
      },
      {
        kind: "new",
        area: "Providers",
        title: "OpenAI as an image provider, using GPT Image 2.5 Flare",
        detail:
          "Renders go straight to OpenAI on your own key, everywhere the studio makes images.",
      },
      {
        kind: "new",
        area: "Thread",
        title: "Phone sounds",
        detail:
          "A chime as each message arrives or is sent, and a tap when the card link is pressed. On by default, with one switch to turn them all off.",
      },
      {
        kind: "new",
        area: "PopKit",
        title: "Upload your own sound cues",
        detail:
          "Add any audio file under the cue picker. Silence at the start is trimmed automatically so the sound lands exactly on the beat. Your sounds are kept on this browser.",
      },
      {
        kind: "improved",
        area: "PopKit",
        title: "Beats as short as 2 seconds no longer show a warning",
        detail: "New beats still open at a comfortable reading length; only going under 2 seconds is flagged.",
      },
      {
        kind: "improved",
        area: "Device Shots",
        title: "Much closer closeups",
        detail:
          "After each render the tool finds the blank screen and moves in on it, so Extreme closeup has the phone running nearly the full height of the frame, and Screen fills the frame lets the phone's body crop off the edges. Plates are rendered a size up so the crop stays sharp. Each plate shows the cropped and the original render side by side, and you pick which one to keep and download.",
      },
      {
        kind: "fixed",
        area: "Device Shots",
        title: "Renders on OpenAI no longer fail with \"can't run this step\"",
        detail:
          "Device Shots was asking OpenAI for fal's model. Model pickers and Make anything now also follow the image or video switch that applies to them, and Make anything opens on GPT Image 2.5 Flare when images are on OpenAI.",
      },
      {
        kind: "fixed",
        area: "Keys",
        title: "A key button for each provider you use",
        detail:
          "With images and video on different providers, the header shows a key button for each one, and a video render checks the video provider's key instead of the image one.",
      },
      {
        kind: "fixed",
        area: "Keys",
        title: "Clearer message when an OpenAI key is in the wrong format",
        detail: "It used to say the key didn't look like a Replicate token.",
      },
    ],
  },
  {
    id: "2026-09-15",
    date: "2026-09-15",
    title: "Your own background, without losing the people",
    changes: [
      {
        kind: "improved",
        area: "Printed & Digital Card",
        title: "A custom background no longer locks out the people and framing",
        detail:
          "Audience, device, who's in frame, their look, how close, and camera angles all stay available. Only setting, lighting and film look come from your photo.",
      },
      {
        kind: "fixed",
        area: "Digital Card",
        title: "Custom backgrounds now come alive in the video instead of sitting frozen",
      },
      {
        kind: "improved",
        area: "Printed Card",
        title: "Flat lay works with a custom background",
      },
      {
        kind: "improved",
        area: "Thread",
        title: "A link back to the studio",
      },
    ],
  },
  {
    id: "2026-09-14",
    date: "2026-09-14",
    title: "The Thread tool, handwriting, and GPT Image 2.5",
    changes: [
      {
        kind: "new",
        area: "Thread",
        title: "A new tool: a text conversation that opens a card",
        detail:
          "Type the messages, choose where the live part starts, add a card animation, and export a video.",
      },
      {
        kind: "new",
        area: "Printed Card",
        title: "Write the message in your own handwriting",
        detail: "Upload a photo of your writing and the message comes out in your hand.",
      },
      {
        kind: "new",
        area: "Printed Card",
        title: "Sign the card with your real signature",
      },
      {
        kind: "new",
        area: "PopKit",
        title: "Letterbox with phone chrome",
        detail:
          "A new fit for screen wells: the clip keeps its shape, with a status bar above and a home indicator below instead of being cropped or stretched.",
      },
      {
        kind: "new",
        area: "PopKit",
        title: "New sound cue: video-popup",
      },
      {
        kind: "improved",
        area: "All tools",
        title: "Images default to GPT Image 2.5 Flare",
      },
    ],
  },
  {
    id: "2026-09-01",
    date: "2026-09-01",
    title: "Exports that come out the right length",
    changes: [
      {
        kind: "fixed",
        area: "PopKit",
        title: "Exports on slower computers are no longer short or choppy",
        detail: "A slower machine now just takes longer; the video comes out full length.",
      },
      {
        kind: "fixed",
        area: "Digital & Printed Card",
        title: "Adding the logo to a video no longer drops frames",
      },
      {
        kind: "fixed",
        area: "Digital Card",
        title: "Large video uploads no longer fail with a 413 error",
      },
      {
        kind: "improved",
        area: "Digital & Printed Card",
        title: "No more extra hands, and tighter shots of phones",
      },
    ],
  },
];

export const LATEST_RELEASE = CHANGELOG[0];

/** Where this browser remembers the last release it opened. */
export const CHANGELOG_SEEN_KEY = "heartstamp-changelog-seen";
