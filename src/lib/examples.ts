/**
 * Example pictures for the visual choices: one image per option, so people can
 * see what "Overcast daylight" or "35mm film" does before paying to find out.
 *
 * HOW THEY ARE MADE
 * `scripts/render-examples.mts` renders every image from the prompts built
 * here, through the same prompt builder the studio uses, into
 * `public/examples/<gallery>/<option>.webp`. Each gallery holds one base scene
 * still and changes only its own control, so the pictures differ in exactly
 * one way and the difference is the lesson.
 *
 * WHY THE ITEMS ARE DERIVED
 * Same reason as the help glossaries: a gallery is a second copy of the option
 * list, and second copies rot. Items come from the option arrays, so a new
 * option appears here at once — as a "no example yet" tile until the script is
 * re-run, which renders only what is missing.
 */

import {
  ANGLES,
  buildScenePrompt,
  FRAMINGS,
  HANDWRITING_STYLES,
  LIGHTING,
  LOOKS,
  PRESENCE,
  SCENES,
  type SceneSelection,
} from "./options";

export type ExampleItem = {
  id: string;
  label: string;
  emoji?: string;
  hint?: string;
  /** The words this option adds to the prompt — the plainest description of it. */
  asks?: string;
  /** Public path of the picture. */
  src: string;
};

export type ExampleGallery = {
  id: string;
  title: string;
  /** What is held still, so the reader knows what they are comparing. */
  constant: string;
  items: ExampleItem[];
};

/** Rendered at 4:5 — the shape the gallery tiles are — and stored smaller. */
export const EXAMPLE_RENDER_SIZE = { width: 1024, height: 1280 };
export const EXAMPLE_STORED_WIDTH = 640;

type Listish = { id: string; label: string; emoji?: string; hint?: string; prompt?: string };

/**
 * The scene every scene gallery starts from. Wider and more peopled than the
 * studio default on purpose: a hero close-up of a phone hides the setting and
 * the light, which are the things these galleries exist to show. The phone's
 * blank screen then gets a sample card, the way the studio finishes a scene.
 */
const BASE: SceneSelection = {
  surface: "screen",
  deviceId: "iphone-portrait",
  sceneId: "coffee-shop",
  angleId: "three-quarter",
  lightingId: "window",
  lookId: "iphone",
  presenceId: "one-partial",
  ethnicityId: "unspecified",
  genderId: "unspecified",
  ageId: "adult",
  details: {},
  audienceId: "genz",
  framingId: "context",
  aspect: "4:5",
  hasCard: false,
};

type Spec = {
  title: string;
  constant: string;
  /** Scene renders get the sample card warped onto their blank screen. */
  composite: boolean;
  options: readonly Listish[];
  /** The prompt for one option. */
  prompt: (optionId: string) => string;
};

const scene = (patch: (id: string) => Partial<SceneSelection>) => (id: string) =>
  buildScenePrompt({ ...BASE, ...patch(id) });

const HANDWRITTEN_MESSAGE =
  "Happy birthday, Sam! Hope this year brings you all the good surprises. Love, Jo";

const SPECS: Record<string, Spec> = {
  setting: {
    title: "Setting",
    constant: "Same person, phone, light and camera — only the place changes.",
    composite: true,
    options: SCENES,
    prompt: scene((sceneId) => ({ sceneId })),
  },
  lighting: {
    title: "Lighting",
    constant: "Same coffee shop, person and camera — only the light changes.",
    composite: true,
    options: LIGHTING,
    prompt: scene((lightingId) => ({ lightingId })),
  },
  look: {
    title: "Film look",
    constant: "Same coffee shop, person and light — only the camera's finish changes.",
    composite: true,
    options: LOOKS,
    prompt: scene((lookId) => ({ lookId })),
  },
  angle: {
    title: "Camera angle",
    constant: "Same coffee shop, person and light — only where the camera sits changes.",
    composite: true,
    options: ANGLES,
    // Closer than the others: "close macro" at the widest framing contradicts itself.
    prompt: scene((angleId) => ({ angleId, framingId: "balanced" })),
  },
  framing: {
    title: "How close",
    constant: "Same coffee shop, person, light and angle — only the distance changes.",
    composite: true,
    options: FRAMINGS,
    prompt: scene((framingId) => ({ framingId })),
  },
  presence: {
    title: "Who's in frame",
    constant: "Same coffee shop, light and camera — only how much of a person shows changes.",
    composite: true,
    options: PRESENCE,
    prompt: scene((presenceId) => ({ presenceId })),
  },
  handwriting: {
    title: "Handwriting style",
    constant: "The same message in blue ink on the same card — only the hand changes.",
    composite: false,
    options: HANDWRITING_STYLES,
    prompt: (id) => {
      const style = HANDWRITING_STYLES.find((s) => s.id === id);
      return [
        "A photorealistic close-up photograph looking straight down at the open inside page of a plain cream greeting card lying on a light wooden table, soft daylight",
        `Handwritten on the card in blue ballpoint ink, in ${style?.prompt ?? "everyday handwriting"}, exactly this message and nothing else: "${HANDWRITTEN_MESSAGE}"`,
        "The writing is real ink on paper, with natural pressure variation, and fills the middle of the page. Spell every word exactly as given",
        "No printed text, no logos, no watermarks, no other objects on the card",
      ].join(". ");
    },
  },
};

export const EXAMPLE_GALLERY_IDS = Object.keys(SPECS);

export const exampleSrc = (galleryId: string, optionId: string) =>
  `/examples/${galleryId}/${optionId}.webp`;

export function exampleGallery(galleryId: string): ExampleGallery | null {
  const spec = SPECS[galleryId];
  if (!spec) return null;
  return {
    id: galleryId,
    title: spec.title,
    constant: spec.constant,
    items: spec.options.map((o) => ({
      id: o.id,
      label: o.label,
      emoji: o.emoji,
      hint: o.hint,
      asks: o.prompt || undefined,
      src: exampleSrc(galleryId, o.id),
    })),
  };
}

/** For the render script: every picture a gallery should have, with its prompt. */
export function examplePrompts(
  galleryId: string,
): { optionId: string; prompt: string; composite: boolean }[] {
  const spec = SPECS[galleryId];
  return spec
    ? spec.options.map((o) => ({ optionId: o.id, prompt: spec.prompt(o.id), composite: spec.composite }))
    : [];
}
