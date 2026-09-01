/**
 * Every "?" in the app reads its copy from here.
 *
 * WHY ONE FILE
 * The explanations are the sweep; the components that show them are trivial.
 * Keeping the prose in one registry means a call site is one word — `help="…"`
 * — and it means the walkthrough videos get added in one place later rather
 * than hunted through eighty components.
 *
 * WHY THE TERM LISTS ARE DERIVED
 * A tooltip that lists options is a second copy of the options, and second
 * copies rot. The bullet lists are built from the same arrays the controls
 * render, with a note per option id supplied here. Add an option to the
 * taxonomy and it appears in its tooltip; rename one and nothing goes stale.
 * An option with neither a note here nor a `hint` of its own is left out
 * rather than padded with a restatement of its own label.
 */

import {
  ANGLES,
  ASPECTS,
  AUDIENCES,
  CARD_SIZES,
  DETAIL_CATEGORIES,
  ETHNICITIES,
  FRAMINGS,
  HANDWRITING_STYLES,
  IMAGE_RESOLUTIONS,
  imageSizeFor,
  INK_COLOURS,
  LIGHTING,
  LOOKS,
  MESSAGE_PLACEMENTS,
  PRESENCE,
  SUBJECT_AGES,
  SUBJECT_GENDERS,
} from "./options";
import { HINT_GROUPS } from "./freeform";

export interface HelpTerm {
  term: string;
  what: string;
}

export interface HelpEntry {
  /** Also the accessible name of the "?" — "What is <title>?". */
  title: string;
  /** One or two sentences on what the control is for. */
  body: string;
  /** The options, explained. Omitted where there is nothing to explain. */
  terms?: HelpTerm[];
  /** Filled in as the walkthroughs are recorded. */
  video?: { url: string; label?: string };
}

/* ------------------------------ builders ----------------------------- */

type Listish = { id: string; label: string; hint?: string };

/** Bullets from a taxonomy, glossed by option id, falling back to its hint. */
const gloss = (list: readonly Listish[], notes: Record<string, string> = {}): HelpTerm[] =>
  list
    .map((o) => ({ term: o.label, what: notes[o.id] ?? o.hint ?? "" }))
    .filter((t) => t.what);

/** Bullets from a kit catalogue, which is bare strings rather than objects. */
const fromNames = (names: readonly string[], notes: Record<string, string>): HelpTerm[] =>
  names.filter((n) => notes[n]).map((n) => ({ term: title(n), what: notes[n] }));

const title = (name: string) =>
  name.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

/**
 * What size a supplied background should be.
 *
 * Derived rather than written down. These numbers come from `imageSizeFor`,
 * which is what step 2 actually asks the model for, so they cannot drift from
 * the renders — and a tooltip quoting stale dimensions is worse than one that
 * says nothing, because someone will crop to them.
 *
 * Both ends of the range are given. The shape is the part that matters: a
 * photograph of the wrong ratio gets cropped to fit and the framing you chose
 * is not the framing you get. The pixels only decide how much detail survives.
 */
const BACKGROUND_SIZES: HelpTerm[] = ASPECTS.map((a) => {
  const small = imageSizeFor(a.id, "720p");
  const large = imageSizeFor(a.id, "4k");
  return {
    term: `${a.label} — ${a.channel}`,
    what: `${large.width} × ${large.height} at 4K, ${small.width} × ${small.height} at 720p.`,
  };
});

/* ------------------------- kit catalogue names ------------------------ */

/*
 * Written out rather than imported: `catalogue.ts` reaches into the vendored
 * kit's ESM, and this module is imported by the marketing-free client bundle
 * of every page including the two that have no PopKit in them. The notes below
 * are keyed by these same strings, so a name that leaves the kit simply stops
 * being glossed.
 */
const CAPTION_SHELLS = [
  "pill", "insetPill", "slab", "bevel", "sticker", "ticket",
  "stampEdge", "index", "ribbon", "bar", "brackets", "torn",
] as const;

const MEDALLION_FRAMES = [
  "circle", "oval", "capsule", "squircle", "square", "diamond", "heart",
  "triangle", "triangleDown", "shield", "hexagon", "rosette", "ticket",
  "pennant", "arch", "burst", "blob", "stamp",
] as const;

const BORDER_TREATMENTS = [
  "slab", "drop", "glow", "sticker", "gap", "key", "keyFat",
  "hair", "gold", "double", "stitch", "tick", "emboss",
] as const;

const COLOURWAYS = ["house", "loud", "night", "premium", "soft", "candy", "signal", "mono"] as const;

/** Shared: step 2 batches many angles, the one-pass page picks one. */
const ANGLE_TERMS: HelpTerm[] = gloss(ANGLES, {
  pov: "Looking down at your own hands, arms entering from the bottom of the frame.",
  "over-shoulder": "Just past someone's shoulder, the back of their head soft in the foreground.",
  flatlay: "Straight down at ninety degrees. The classic tabletop layout shot.",
  "three-quarter": "Off to one side by about twenty-five degrees, so the card is seen in gentle perspective.",
  "eye-level": "Square to the card, no perspective distortion. Clean and product-like.",
  "low-angle": "Slightly below, looking up. Makes the subject loom — heroic and a little dramatic.",
  "close-macro": "Right up against the surface, focus falling away fast. Texture and detail.",
  wide: "Pulled back to take in the whole room around the subject.",
  "handheld-tilt": "A few degrees of tilt, casual and imperfect, like a snapshot.",
});

/* ============================== registry ============================== */

export const HELP: Record<string, HelpEntry> = {
  /* ------------------------------ the steps --------------------------- */

  "step.card": {
    title: "Step 1",
    body:
      "Everything downstream is built from what you upload here. Nothing on this page is generated — it is your artwork, or your animation, going in as it is. The rest of the app never invents a card; it only ever places the one you supply.",
  },
  "step.scene": {
    title: "Step 2",
    body:
      "Stills first, video second. This step makes photographs of your card in a place, and step 3 animates whichever one you like best. Splitting it means you can look at eight framings for the price of eight images rather than eight videos.",
  },
  "step.motion": {
    title: "Step 3",
    body:
      "Turns a chosen still into a clip. The video model animates that exact frame, so this step decides what happens rather than what things look like — the look was settled in step 2.",
  },
  "step.oneShot": {
    title: "One pass",
    body:
      "Scene and motion in a single render, without stopping at a still. Faster and cheaper than the two-step route, with less control: you cannot check the framing before paying for the movement.",
  },
  "image.output": {
    title: "Output",
    body:
      "How many stills to make and how large. Every angle is multiplied by every orientation and then by the variation count, so these three numbers together decide the size of the batch — and the bill. The running total is shown on the render button.",
  },
  "video.output": {
    title: "Output",
    body:
      "The shape, size and length of the finished clip, plus the two things added after the model is done: the logo and the audio. Longer and larger both cost more, and neither improves what actually happens in the shot.",
  },

  /* ------------------------------ step 1 ----------------------------- */

  "card.front": {
    title: "Front panel",
    body:
      "The outside of the card — the face someone sees before they open it. This is the one required picture: every scene and every video is built around it, and the model is shown it directly rather than described it.",
  },
  "card.inside": {
    title: "Inside spread",
    body:
      "Both inside pages photographed open, as one wide image. Optional. Supplying it lets a scene show the card opened, and lets a handwritten message be placed on a real page instead of an invented one.",
  },
  "card.animation": {
    title: "The card animation",
    body:
      "The clip that plays on the device's screen in the finished video — your card doing whatever it does when someone opens it. Eight to thirteen seconds is the sweet spot: long enough to read as a whole thing, short enough to hold a viewer.",
  },

  /* ------------------------------ the card ---------------------------- */

  "card.size": {
    title: "Physical size",
    body:
      "The real-world dimensions of the printed card. It sets the proportions of the card in the scene and how big it reads against a hand, a table or an envelope — a 4×6 in someone's fingers looks nothing like an A5.",
    terms: gloss(CARD_SIZES),
  },

  /* ------------------------------ the scene --------------------------- */

  "scene.panel": {
    title: "The scene",
    body:
      "Where the shot happens and what it looks like: place, light, lens and who is in it. Everything here is compiled into one prompt — none of it reaches the model as a separate instruction, which is why the choices have to agree with each other to work.",
  },

  "scene.audience": {
    title: "Audience",
    body:
      "Who the finished post is aimed at. It filters the list of settings to ones that suit them, and steers wardrobe, props and styling. It never appears as words in the picture — it decides which words get used.",
    terms: gloss(AUDIENCES, {
      genz: "Late teens to mid-twenties. Dorms, thrifted layers, phone-first.",
      "millennial-mom": "Thirties, family home, warm and lived-in.",
      college: "Campus and shared housing, budget-friendly clutter.",
      pro: "Twenties to thirties, work-adjacent, tidier and more considered.",
    }),
  },
  "scene.device": {
    title: "Device",
    body:
      "What the card animation is playing on. The exact model matters more than it sounds — bezels, rails and the shape of the corners are the difference between a shot that reads as a real photograph and one that reads as a render.",
  },
  "scene.surface": {
    title: "Surface",
    body:
      "What the printed card is resting on, being held by, or propped against. It sets the whole physical situation of the shot before any lighting or framing is applied.",
  },
  "scene.setting": {
    title: "Setting",
    body:
      "Where the shot happens. This is the single biggest lever on the finished picture — more than lighting, more than lens. The list is filtered by the audience above, so change that first if nothing here fits.",
  },
  "scene.lighting": {
    title: "Lighting",
    body:
      "The quality and colour of the light. Soft light flatters and calms; hard light adds drama and texture. If a render looks flat or fake, this is usually the control to change.",
    terms: gloss(LIGHTING, {
      golden: "The hour after sunrise or before sunset. Warm, low, long soft shadows.",
      window: "Daylight through a big window. Soft, flattering, no harsh edges.",
      overcast: "Flat cloudy daylight. Even and neutral — nothing dramatic, nothing to hide.",
      flash: "Hard on-camera flash. Bright subject, dark background, crunchy and immediate.",
      neon: "Night with saturated magenta and cyan spill on wet surfaces.",
      "warm-lamp": "Indoor tungsten lamplight. Amber, cosy, deep soft shadows.",
      studio: "A big softbox and gentle fill on a seamless background. Clean and commercial.",
      stage: "Concert lighting — coloured beams, haze, a strong rim light on the subject.",
    }),
  },
  "scene.look": {
    title: "Film look",
    body:
      "What the picture was supposedly taken with. This is the finish rather than the content: the same scene shot as 35mm film and as a Y2K digicam are the same objects with completely different credibility.",
    terms: gloss(LOOKS, {
      iphone: "Modern phone photography. Clean, true-to-life, computational.",
      film35: "35mm film. Fine grain, lifted blacks, a glow in the highlights.",
      editorial: "Magazine campaign work. Medium-format sharp, deliberately composed.",
      digicam: "Early-2000s point-and-shoot. Noise, harsh flash, nostalgic colour.",
      ugc: "Raw user-generated content. Imperfect framing, un-styled, believable.",
    }),
  },
  "scene.presence": {
    title: "Who's in frame",
    body:
      "How much of a person appears. No option here shows a face — faces are the thing image models get uncannily wrong, and a wrong face sinks an otherwise good shot — so presence is carried by hands, shoulders and the backs of heads.",
    terms: gloss(PRESENCE, {
      none: "The card or device alone. Nothing to get wrong.",
      hands: "Hands and forearms only. The most reliable way to add a human.",
      "one-partial": "One person, cropped above the chin or framed from the shoulders down.",
      "one-back": "One person seen from behind, face turned away.",
      group: "A few friends leaning in, seen from behind or cropped at the shoulders.",
    }),
  },
  "scene.framing": {
    title: "How close",
    body:
      "How much of the frame the card takes up. Separate from camera angle: that says where the camera is, this says how close it gets.",
    terms: gloss(FRAMINGS, {
      hero: "The card is the whole point and fills most of the frame.",
      extreme: "Closer still — card edge to edge, almost no room for anything else.",
      balanced: "The card leads, the scene supports it. The safest default.",
      context: "The environment tells the story and the card sits inside it.",
    }),
  },
  "scene.angle": {
    title: "Camera angles",
    body:
      "Where the camera sits relative to the card. Pick as many as you like — each one is rendered separately, so this is the fastest way to get genuine variety rather than the same shot four times.",
    terms: ANGLE_TERMS,
  },
  "scene.angleOne": {
    title: "Camera angle",
    body:
      "Where the camera sits relative to the card. One per render here — this page makes a single clip rather than a batch, so pick the one that suits the moment.",
    terms: ANGLE_TERMS,
  },
  "scene.orientation": {
    title: "Orientations",
    body:
      "The shape of the finished frame. Pick as many as you need — each is rendered separately, which is how you get a vertical cut for Reels and a square for the feed without re-prompting.",
    terms: gloss(ASPECTS as unknown as Listish[], {
      "9:16": "Full-screen vertical. TikTok, Reels, Shorts, Stories.",
      "4:5": "Tall portrait. The largest shape a feed post can occupy.",
      "1:1": "Square. Safe everywhere, strong nowhere.",
      "16:9": "Landscape. YouTube, sites, anything on a desktop screen.",
      "2:3": "Tall, print-proportioned. Good for a card standing upright.",
      "3:4": "A gentler portrait than 4:5.",
    }),
  },
  "scene.extra": {
    title: "Extra direction",
    body:
      "Anything the controls above do not cover — a specific prop, a colour story, a piece of wardrobe, a thing to avoid. It is appended to the prompt the choices build, so it adds to them rather than replacing them. Optional, and usually best left empty until something specific is going wrong.",
  },
  "scene.background": {
    title: "Your own background",
    body:
      "Skip the generated scene and drop in a photograph you already have. The card gets composited into it. Choosing one locks the scene controls, because the picture now decides the setting, the lighting and the framing. What it does not decide is the shape: the orientations you tick below still set that, so a photograph of a different ratio is cropped to fit, and a wide shot picked for a 9:16 render loses its sides. Match the shape you are rendering and the framing you chose is the framing you get. These are the sizes each orientation is rendered at, largest quality to smallest — supply the shape, and at least the larger size if you have it.",
    terms: BACKGROUND_SIZES,
  },

  /* ------------------------------ styling ----------------------------- */

  "styling.subject": {
    title: "Primary subject",
    body:
      "Who the hands, wrists and shoulders in frame read as. Only meaningful when someone is actually in the shot — with \"No people\" selected above, none of the styling controls do anything.",
    terms: gloss(SUBJECT_GENDERS),
  },
  "styling.age": {
    title: "Age",
    body:
      "Roughly how old the person in frame reads. It carries through hands, nails and wardrobe rather than a face, so treat it as a nudge rather than a precise instruction.",
    terms: gloss(SUBJECT_AGES),
  },
  "styling.ethnicity": {
    title: "Ethnicity",
    body:
      "Since no option ever shows a face, this is carried by skin tone, hair texture, hands and forearms. Each is written as a range rather than one exact look — naming a single point produces a caricature.",
    terms: gloss(ETHNICITIES),
  },
  "styling.details": {
    title: "Styling details",
    body:
      "The small things right beside the card — nails, rings, a watch, a sleeve. They are the difference between a stock-looking hand and one that belongs to somebody. Everything here is optional; \"Any\" leaves the choice to the model.",
    terms: gloss(DETAIL_CATEGORIES as unknown as Listish[], {
      nails: "Right beside the card in almost every shot, so the most visible of these.",
      tattoos: "On the forearms and hands, where the frame can actually see them.",
      wrist: "Watches, bracelets, a scrunchie — whatever sits at the edge of the frame.",
      rings: "Stacked, statement, signet or none.",
      extras: "Necklaces, hoops, a cap, a tote — anything else that dresses the shot.",
    }),
  },

  "styling.detail.nails": {
    title: "Nails",
    body:
      "The most visible styling choice, because hands are right beside the card in almost every shot. A chrome or glitter manicure reads as deliberate; short and bare reads as ordinary. Both are useful — they just say different things about whose card this is.",
  },
  "styling.detail.tattoos": {
    title: "Tattoos",
    body:
      "On the forearms and hands, which is the part of a person the frame actually sees. The named styles are how tattooists describe their own work.",
    terms: [
      { term: "Fine-line", what: "Thin single-weight black lines. Small, delicate, modern." },
      { term: "Botanical", what: "Plants and flowers, usually fine-line." },
      { term: "American traditional", what: "Bold outlines, limited colour. Anchors, roses, swallows." },
      { term: "Blackwork / geometric", what: "Solid black shapes and repeated patterns." },
      { term: "Script lettering", what: "Words in a handwritten or gothic hand." },
      { term: "Full sleeve", what: "Dense coverage from shoulder to wrist." },
    ],
  },
  "styling.detail.wrist": {
    title: "Wrist",
    body:
      "What sits at the edge of the frame when a hand holds the card. Small, but it does a lot of the work of making a hand belong to a particular person.",
  },
  "styling.detail.rings": {
    title: "Rings",
    body:
      "Fingers are unavoidably in shot when someone holds a card. A wedding band or a signet says something specific; \"Any\" leaves it to the model.",
  },
  "styling.detail.extras": {
    title: "Other accessories",
    body:
      "Anything else that dresses the frame — a cap, sunglasses pushed up, a knit scarf, a tote. Use sparingly: each one is another thing the model has to render correctly.",
  },

  /* ------------------------- image output ----------------------------- */

  "image.variations": {
    title: "Variations per combo",
    body:
      "How many separate renders to make of each angle-and-orientation pair. GPT-Image-2 has no seed input, so re-rolling is the only way to get variety — two variations of four angles is eight images, and eight charges.",
  },
  "image.resolution": {
    title: "Resolution",
    body:
      "The short edge of each render. Bigger costs more and takes longer. These are stills that will be handed to a video model at 720p or 1080p, so the largest sizes rarely earn their price.",
    terms: gloss(IMAGE_RESOLUTIONS),
  },
  "image.quality": {
    title: "Quality",
    body:
      "How much work the image model puts in per render. Higher quality means better hands, cleaner text on the card and fewer obvious mistakes — and a longer wait and a larger bill. Worth raising once the scene is right, not while you are still exploring.",
  },

  /* ------------------------------ motion ------------------------------ */

  "motion.motion": {
    title: "Motion",
    body:
      "What actually happens in the video — how the camera moves, how the card is handled, what the moment is. Pick as many as you like; each is rendered as its own clip. This is the choice that decides whether the result feels like a video or like a photograph that drifts.",
  },
  "model.baseImage": {
    title: "Scene image model",
    body:
      "Which image model draws the still. With no artwork attached it works from the prompt alone. The list only shows models that accept the inputs this step sends, which is why it is shorter than fal's full catalogue — the open bench has the unfiltered list.",
  },
  "model.compositeImage": {
    title: "Scene image model",
    body:
      "Which image model draws the still with your artwork — and your background, if you added one — handed to it as references. Models differ most in how faithfully they reproduce artwork they are shown rather than in how pretty the scene is.",
  },
  "model.animate": {
    title: "Video model",
    body:
      "Which model animates the still into a clip. They differ in how long a clip they will make, how well they hold onto the card's artwork while it moves, and what they cost. Only models that accept the inputs this step sends are listed.",
  },
  "model.screenReplace": {
    title: "Reference video model",
    body:
      "This step hands the model both a picture and a video — your card clip playing on the surface, or a printed card opening to its inside spread. Very few models accept both, which is why this list is short.",
  },
  "video.resolution": {
    title: "Resolution",
    body:
      "The size of the finished video. 720p is the right default for social — it is what the platforms re-encode to anyway, it renders faster and it costs less. Go higher only when something will be seen full-screen on a desktop.",
    terms: [
      { term: "480p", what: "Draft quality. Good for checking a motion before paying for the real thing." },
      { term: "720p", what: "The social default. Sharp enough everywhere it will actually be watched." },
      { term: "1080p", what: "Full HD. Worth it for a desktop or a site hero, otherwise not." },
    ],
  },
  "video.duration": {
    title: "Duration",
    body:
      "How long the clip runs. Longer costs proportionally more and gives the model more room to drift away from your card. \"Auto\" lets the model pick what suits the motion.",
  },
  "video.aspect": {
    title: "Aspect",
    body:
      "The shape of the finished video. Match it to where it is going: vertical for Reels and TikTok, square for a feed, landscape for YouTube.",
    terms: gloss(ASPECTS as unknown as Listish[], {
      "9:16": "Full-screen vertical. TikTok, Reels, Shorts, Stories.",
      "4:5": "Tall portrait, the biggest a feed post gets.",
      "1:1": "Square. Safe everywhere.",
      "16:9": "Landscape. YouTube and desktop.",
    }),
  },
  "video.logo": {
    title: "The HeartStamp logo",
    body:
      "Stamps the wordmark onto the finished video after the model is done. It is added here rather than baked into the still, so the same scene can be used with and without it — and so the logo stays crisp instead of being re-imagined by a video model.",
  },
  "video.audio": {
    title: "Generated audio",
    body:
      "Asks the model to invent a soundtrack — room tone, paper, a bit of music. Useful for a quick draft. For anything you will actually post, expect to replace it: models are far better at pictures than at sound.",
  },
  "video.still": {
    title: "Source still",
    body:
      "Which rendered scene the video is built from. The model animates this exact frame, so whatever is wrong in the still will still be wrong — and moving — in the video. Pick the cleanest one, not the most interesting one.",
  },

  /* ------------------------ handwritten message ----------------------- */

  "hand.panel": {
    title: "Handwritten message",
    body:
      "Asks the image model to write a note on the card's inside pages, in a hand you choose. Everything here is optional, and none of it does anything without an inside spread uploaded — there is no page to write on otherwise.",
  },
  "hand.message": {
    title: "Message",
    body:
      "The words written inside the card. Keep it to what would genuinely fit on a page in someone's hand — a few lines. Long paragraphs come back cramped and illegible, because that is what they would really look like.",
  },
  "hand.signature": {
    title: "Signature",
    body:
      "The name at the end, written a little looser than the message — as a real signature is. Optional; leave it empty for an unsigned note.",
  },
  "hand.style": {
    title: "Handwriting",
    body:
      "Whose hand it looks like. Grouped by how the writing reads rather than by any font name, because the model is being asked to imitate a person, not to set type.",
    terms: gloss(HANDWRITING_STYLES),
  },
  "hand.ink": {
    title: "Pen",
    body:
      "What it was written with. Ballpoint blue is the most believable for a note actually written by hand; gold and red read as deliberate, which is sometimes the point.",
    terms: gloss(INK_COLOURS, {
      blue: "The most ordinary and so the most believable.",
      black: "Neutral and a little more formal.",
      graphite: "Pencil. Soft, grey, slightly smudged.",
      red: "Reads as emphatic or festive.",
      gold: "A metallic gel pen. Deliberate, celebratory.",
    }),
  },
  "hand.placement": {
    title: "Written",
    body:
      "Where on the inside spread the message sits. Lower right is where a card is normally signed, which is why it is the default.",
    terms: gloss(MESSAGE_PLACEMENTS),
  },

  /* ------------------------------ popkit ------------------------------ */

  "pop.canvas": {
    title: "Canvas",
    body:
      "The frame size the annotations are laid out for, and the safe zone inside it. It does not resize your video — it decides where the platform's own interface would cover things up, so nothing important lands under a caption bar or a row of buttons.",
    terms: [
      { term: "TikTok / Reels / Shorts", what: "1080×1920. Deep safe margins top and bottom for the platform's controls." },
      { term: "YouTube", what: "1920×1080. Landscape, with room for the player chrome." },
      { term: "Square", what: "1080×1080. Feed posts." },
    ],
  },
  "pop.logo": {
    title: "Stamp the HeartStamp logo",
    body:
      "Burns the wordmark into the bottom-right corner of the rendered clip, in the same place and at the same size the card pipelines put it — 28% of the short edge, 4% in. It is drawn over the nuggets rather than under them, so check nothing important is sitting in that corner. Off by default: a nugget deck is as often a working cut or an explainer as it is a finished HeartStamp asset. Note that the 4% margin puts it below the safe zone on every preset — on reels it lands where TikTok draws its action rail, so the mark may be partly covered on that platform. It comes in two colourways — white lettering for a dark corner, black for a light one — and which you get is read from the pixels the mark will cover, on the last frame of the background. The end is what a paused or looping player lingers on. The preview reads the same pixels, so what you see on the stage is the colourway you will get.",
  },
  "pop.safeZone": {
    title: "The safe zone",
    body:
      "An overlay showing where the platform's own interface sits over your video. Anything you put outside it may be covered by a caption, a username or a row of buttons on a real phone. It is a guide only — it never appears in the export.",
  },
  "pop.addRow": {
    title: "What you can add",
    body:
      "Six things, and the difference between them is what they are for rather than how they look. The first four become beats on the timeline; the last two act on what is already there.",
    terms: [
      {
        term: "Add beat",
        what: "A caption nugget — words in a shell, usually with a medallion and an arrow. The default thing, and the one with a reading-time floor: text needs about three and a half seconds to be read at all.",
      },
      {
        term: "Add well",
        what: "A framed window holding a picture or a clip — a screenshot, a reaction, a before-and-after. It has its own furniture: a caption lip, a kicker, a border. Ten named formats, or any of the eighteen frames with a hole in it.",
      },
      {
        term: "Add arrow",
        what: "A pointer on its own, with no caption attached. Answers to pointer lead rather than reading time, so it can be brief — it marks something for a moment rather than being read.",
      },
      {
        term: "Add screen",
        what: "A bare well with no frame at all, meant to pass for a surface already in the shot: the screen of a phone, a monitor, a billboard. Holds the whole timeline and does not pop in, and its corners can be dragged onto the real thing.",
      },
      {
        term: "Delete beat",
        what: "Removes the selected beat. Only offered while more than one exists, because a deck with nothing in it is not a state worth being able to reach by accident.",
      },
      {
        term: "Mark protected region",
        what: "Draws a box over something already in your footage that nothing should cover — a logo, a watermark, a burned-in caption. Then drag on the frame to place it. An arrow landing inside one is a blocking error rather than a warning, and it needs 16px of clearance. Give it a time window if the thing is only there for part of the clip.",
      },
    ],
  },
  "pop.region": {
    title: "Protected regions",
    body:
      "A rectangle nothing should be placed over — a logo, a watermark, a burned-in caption already in your footage. Mark it once and the builder warns you when a nugget lands on top of it.",
  },
  "pop.regionWindow": {
    title: "When it applies",
    body:
      "The stretch of the video this protected region covers, in seconds. Leave both blank if the thing is on screen for the whole clip — a watermark usually is, an end card usually is not.",
  },
  "pop.copy": {
    title: "Copy",
    body:
      "The words in the nugget. Short is not a style rule here — it is a legibility one. A viewer sees this for a couple of seconds at phone size, so a handful of words lands and a sentence does not.",
  },
  "pop.textSize": {
    title: "Text size",
    body:
      "How large the caption text is drawn, relative to the canvas. Everything else in the nugget is sized from it — the shell, the padding, the medallion — so this is the main lever on how much of the frame the whole cluster takes up.",
  },
  "pop.clusterWidth": {
    title: "Cluster width",
    body:
      "How wide the caption is allowed to run before it wraps to another line. Narrower gives you a taller, chunkier block; wider gives a long thin one. Useful for fitting a nugget beside something in the footage rather than over it.",
  },
  "pop.dwell": {
    title: "Dwell",
    body:
      "How long the nugget stays on screen, including its pop-in and pop-out. Text needs roughly three and a half seconds to be read at all; arrows and media wells have no such floor because there is nothing to read.",
  },
  "pop.sound": {
    title: "Sound cue",
    body:
      "A short sound played as the nugget appears. It is mixed into the exported video and previewed here when you pick one. \"None\" is a real choice — a deck where every beat clicks gets tiring fast.",
  },
  "pop.colourway": {
    title: "Colourway",
    body:
      "The palette the whole nugget is drawn in — shell, border, medallion and glyph together. Set per beat, so one deck can run a house look throughout and switch to a loud one for the moment that matters.",
    terms: fromNames(COLOURWAYS, {
      house: "The HeartStamp palette. The default, and the right answer most of the time.",
      loud: "High-saturation and high-contrast. For the one beat that has to be seen.",
      night: "Dark ground, light type. Sits better over bright footage.",
      premium: "Restrained, warm neutrals with metallic accents.",
      soft: "Low contrast and gentle. Quiet, and easy to lose over busy footage.",
      candy: "Bright pastels.",
      signal: "Warning colours — the visual language of an alert.",
      mono: "Black and white only. Never fights the footage.",
    }),
  },
  "pop.anchor": {
    title: "Anchor point",
    body:
      "Which part of the nugget sits on the spot you placed. Dragging positions a single point; this says whether that point is the cluster's centre, a corner or an edge — which is what keeps a nugget lined up with something in the footage as its text grows.",
  },
  "pop.side": {
    title: "Side",
    body:
      "Which side of the caption the medallion sits on. The arrow moves with it, so this flips the whole cluster rather than just the badge.",
  },
  "pop.medallionSides": {
    title: "Which ends",
    body:
      "A caption can carry a medallion on either end, both, or neither. Turning one off takes its glyph and its gap with it, and moves any arrow that was hanging off it to the end that still has one — an arrow whose host disappears silently reattaches itself to a caption edge instead.",
  },
  "pop.medallionTarget": {
    title: "Editing",
    body:
      "Which of the two the frame, border, glyph and media controls below are pointed at. Only appears when there are two, because with one there is nothing to choose between. The previews are the real medallions rather than the words — two circles that differ only by their glyph are otherwise impossible to tell apart. Clicking one on the frame selects it too.",
  },
  "pop.medallionSize": {
    title: "Medallion size",
    body:
      "How big the badge is next to the caption. As it shrinks it moves closer to the text so the cluster stays a single object rather than two things near each other.",
  },
  "pop.lap": {
    title: "Lap over the caption",
    body:
      "How far the medallion overlaps the caption shell. A little overlap reads as one designed object; none reads as two stickers placed next to each other.",
  },
  "pop.gap": {
    title: "Gap to the text",
    body:
      "The space between the arrow's tail and the caption. Enough that they read as separate parts, little enough that the arrow clearly belongs to this nugget and not another one.",
  },
  "pop.glyphSize": {
    title: "Glyph size",
    body:
      "How much of the medallion's safe box the artwork fills. Larger uses the space better; too large and a frame with corners — a diamond, a pennant — starts clipping the drawing.",
  },
  "pop.captionShell": {
    title: "Caption shell",
    body:
      "The container the words sit in. Twelve of them, and the choice is mostly tone: a pill is neutral and modern, a ticket or a torn edge is playful, a slab is loud.",
    terms: fromNames(CAPTION_SHELLS, {
      pill: "Fully rounded ends. Neutral, modern, the safe default.",
      insetPill: "A pill with an inner line, so it reads as a printed label.",
      slab: "A hard rectangle with a heavy offset. Loud and blocky.",
      bevel: "Cut corners — a plate rather than a sticker.",
      sticker: "A thick white keyline all the way round, like a die-cut vinyl sticker.",
      ticket: "Notched sides, as if torn from a roll.",
      stampEdge: "Perforated postage-stamp edges.",
      index: "A filing-card look, squared off and plain.",
      ribbon: "Tails at each end, as though the banner continues past the frame.",
      bar: "A flat full-width band. Utilitarian, good for a lower third.",
      brackets: "No fill — just marks at the corners holding the words.",
      torn: "A ragged edge, as if ripped from paper.",
    }),
  },
  "pop.frame": {
    title: "Medallion frame",
    body:
      "The shape of the badge beside the caption. Eighteen of them. Rounder shapes give a glyph the most usable room; pointed ones look sharper but crop the artwork harder, so check the glyph size after switching.",
    terms: fromNames(MEDALLION_FRAMES, {
      squircle: "Between a square and a circle — the shape of an app icon.",
      capsule: "A stretched circle. Good for a wide glyph.",
      rosette: "A scalloped edge, like an award seal.",
      pennant: "A tapering flag shape.",
      arch: "Flat bottom, domed top. Like a plaque or a doorway.",
      burst: "A jagged star — the shape of a price flash.",
      blob: "An irregular organic shape. Hand-drawn rather than geometric.",
      stamp: "Perforated edges, matching the stamp caption shell.",
      ticket: "Notched sides, matching the ticket shell.",
      shield: "A crest. Reads as official or as a badge of honour.",
      triangleDown: "A triangle pointing down — useful when the arrow comes from above.",
    }),
  },
  "pop.border": {
    title: "Border treatment",
    body:
      "How the medallion's edge is finished. It is what separates the badge from the footage behind it — over busy video a hairline disappears and a slab or a sticker survives. Leaving it on the register default is usually right.",
    terms: fromNames(BORDER_TREATMENTS, {
      slab: "A solid offset block behind the shape. The strongest separation there is.",
      drop: "A soft drop shadow. Lifts it off the footage without adding a line.",
      glow: "A soft halo. Works where a hard edge would look heavy.",
      sticker: "A thick white keyline, like a die-cut sticker.",
      gap: "A line held away from the edge, with clear space between.",
      key: "A plain keyline at the standard weight.",
      keyFat: "The same, much heavier.",
      hair: "A hairline. Delicate, and the first thing to vanish over busy video.",
      gold: "A metallic keyline. Reads as premium.",
      double: "Two concentric lines.",
      stitch: "A dashed line, like stitching round a patch.",
      tick: "Small marks around the edge, like a dial.",
      emboss: "A raised-and-pressed edge, as if stamped into card.",
    }),
  },
  "pop.arrow": {
    title: "Arrow",
    body:
      "A pointer running from the nugget to whatever it is talking about. Thirty-four of them, and they fall into families: cursors that look like a mouse or a tap, darts and blades that are plain and sharp, drawn ones that look hand-made, and leaders that are more line than arrow. Each medallion carries its own, so with two you get two — this edits whichever one the Editing selector is pointed at, and removing a medallion takes its arrow with it.",
    terms: [
      { term: "Cursors", what: "cursor, cursorFat, cursorDrag, cursorTap — an interface pointer. Best when you are showing something being clicked or tapped." },
      { term: "Darts and blades", what: "dart, wedge, tube, blade, nub, barb — plain, sharp and neutral. The default choice." },
      { term: "Drawn", what: "brush, scrawl, sketch, loop, pigtail — hand-made and informal, as if annotated by a person." },
      { term: "Leaders", what: "leader, elbow, dashLeader, underscore, bracketTick — mostly line, with a small tip. Quiet, for pointing without shouting." },
      { term: "Gestural", what: "swoop, arc, spiral, boomerang, lasso, speed, bolt — motion and energy. Loud by design." },
    ],
  },
  "pop.arrowAngle": {
    title: "Arrow angle",
    body:
      "Which way the arrow points, in degrees. Zero points right; the angle runs anticlockwise from there. Set it so the tip lands on the thing in the footage rather than merely gesturing in its direction.",
  },
  "pop.arrowLayer": {
    title: "Arrow layer",
    body:
      "Where the arrow is drawn in the stack. Under the caption it can be hidden by the shell's border; over the medallion it can cross the badge. Between the two is usually right, which is why it is the default.",
    terms: [
      { term: "Under everything", what: "Behind the caption and the medallion both. The arrow tucks in." },
      { term: "Between", what: "Over the caption, under the medallion. The default." },
      { term: "Over everything", what: "On top of the whole cluster. Use when the arrow has to cross the nugget itself." },
    ],
  },
  "pop.objectGlyph": {
    title: "Object glyphs",
    body:
      "Line drawings of things — a phone, an envelope, a heart. They sit inside the medallion. Use one when the badge should say what the nugget is about at a glance, rather than decorate it.",
  },
  "pop.occasionGlyph": {
    title: "Occasion glyphs",
    body:
      "Drawings for moments rather than objects — a birthday, a new home, a wedding, a thank-you. Same medallion, different vocabulary. Searchable, because there are forty-seven of them.",
  },
  "pop.customGlyph": {
    title: "Your own glyph",
    body:
      "Upload artwork of your own instead of using the catalogue. It is carried inside the deck itself rather than uploaded anywhere, so nothing needs a server and the deck stays portable. Stills are resized to 512px; SVGs are kept as they are.",
  },
  "pop.stampy": {
    title: "Stampy",
    body:
      "The HeartStamp character, in a range of expressions. These are drawn artwork rather than generated, and the head is matched across the set — so props spill outside the frame rather than shrinking the face to fit.",
  },
  "pop.well": {
    title: "Media wells",
    body:
      "A nugget that holds a picture or a clip instead of a medallion — a screenshot, a reaction, a before-and-after. It pops in like any other beat. Pick a named format for one with its own furniture, or a shape well for a plain hole in a frame.",
  },
  "pop.screen": {
    title: "Screen",
    body:
      "A media well with nothing around it: no frame, no keyline, no caption. It exists to sit inside the background rather than on top of it — the screen of a phone in a photo, a monitor, a billboard — so any furniture would give the game away. It holds the whole timeline and does not pop in, because a thing already in the scene does not arrive.",
  },
  "pop.screenGloss": {
    title: "Glass",
    body:
      "A soft diagonal sheen and a darkened edge, drawn on the screen's own surface so it foreshortens with the pin. A real screen is a mirror as well as an emitter, and the eye reads the total absence of a reflection as \"pasted on\" long before it can say why. Keep it low — this is meant to sell the illusion, not to look like a filter. Zero turns it off.",
  },
  "pop.screenPin": {
    title: "Perspective",
    body:
      "Lay the screen into the scene by dragging its four corners onto the real thing in the photograph. Four corners describe any flat surface under any camera exactly, which is why this is corners rather than tilt sliders: matching a photo by rotation would also need that photo's focal length, and for a screen off to one side no amount of rotating gets there. \"Pin to the scene\" looks for a bright screen-shaped rectangle first and gives you a plain one to drag if it cannot find it.",
  },
  "pop.screenAspect": {
    title: "Aspect",
    body:
      "The shape of the screen you are matching. It decides how the media is fitted — by default a 16:9 clip in a phone-shaped screen loses its sides rather than being squashed, and \"Stretch to fill\" below reverses that trade — and it gives the corner handles a sensible rectangle to start from.",
  },
  "pop.screenWidth": {
    title: "Width",
    body:
      "How wide the screen is drawn before any corner-pinning. Rough is fine: once you drag the corners onto the thing in the photo, they decide the shape and this only sets the starting rectangle.",
  },
  "pop.screenRadius": {
    title: "Corner radius",
    body:
      "How round the corners are, in canvas pixels. Zero is square, which is right for a billboard or an older monitor. Match it to the device in your photo — a modern phone is rounder than it looks.",
  },
  "pop.wellFormat": {
    title: "Format",
    body:
      "The ten named well formats. Each carries its own proportion and its own furniture — a caption lip, a kicker line, a border treatment — so the format is a whole design rather than just an aspect ratio. Switching format keeps whatever media is loaded.",
  },
  "pop.wellShape": {
    title: "Shape wells",
    body:
      "Any of the eighteen medallion frames with a hole cut in it and your media showing through. No caption lip and no furniture — the shape is the whole thing. Picking one replaces the named format above.",
  },
  "pop.wellMedia": {
    title: "Well media",
    body:
      "The picture or clip that sits in the shape. It rides inside the deck rather than being uploaded, so a still is resized to fit; a clip is kept as a file and plays in the preview and the export.",
  },
  "pop.wellShapeField": {
    title: "Shape",
    body:
      "The aspect the media is fitted to inside the well — cropped to it by default, or stretched to it with \"Stretch to fill\" below. Ignored when a shape well is chosen above, because the frame itself already decides it.",
  },
  "pop.wellSize": {
    title: "Well size",
    body:
      "How big the well is drawn, independently of any text size. A well has no words to stay legible, so it is sized to suit the frame rather than to suit reading.",
  },
  "pop.wellStretch": {
    title: "Stretch to fill",
    body:
      "Off, the media is cropped to cover the well: it keeps its proportions and whatever falls outside the shape is trimmed. On, it is stretched to fit exactly — nothing is lost and the picture is distorted instead. Worth turning on when what the crop was cutting off is the part that mattered, like a logo in the corner of a clip. A few percent of stretch is invisible; a lot is not.",
  },
  "pop.wellCaption": {
    title: "Well caption",
    body:
      "A line under the media, inside the frame — the well's own label rather than a separate nugget. Leave it empty for a well with no words at all.",
  },
  "pop.wellKicker": {
    title: "Kicker",
    body:
      "The small line above the caption, usually a category or a source — \"BEFORE\", \"STEP 2\", \"@handle\". Set in a smaller, quieter style than the caption below it.",
  },


  "pop.medallion": {
    title: "Medallion",
    body:
      "The badge that sits beside the caption — a shape, a border treatment and usually a glyph. It is what turns a line of text into something that reads as designed rather than typed over the footage. Optional on every beat.",
  },
  "pop.stillLength": {
    title: "Timeline length",
    body:
      "How long the deck runs when the background is a still. A clip brings its own length; a photograph has none, so this is it. Capped at a minute because the export records in real time — a minute of deck is a minute of watching it render.",
  },
  "pop.transport": {
    title: "Playing the deck",
    body:
      "Play, pause, and back to the start. They sit outside the video because a still background has no controls of its own — and because getting back to the top meant dragging the playhead to the left edge and hoping. Rewinding while it plays starts it over rather than stopping it.",
  },
  "pop.timeline": {
    title: "Timeline",
    body:
      "Every beat in the deck, laid over the length of the video. Click the bar to move the playhead, or drag it. Drag a beat to move it, drag its edges to change how long it holds. Beats may overlap — two nuggets on screen at once is a deliberate move, not a mistake.",
  },
  "pop.builder": {
    title: "PopKit",
    body:
      "Annotation over a finished clip: captions, medallions, arrows and media wells that pop in at chosen moments. It never changes your video — it draws on top of it, and the export re-encodes the two together in this browser.",
  },
  /* --------------------------- the open bench ------------------------- */

  "bench.category": {
    title: "What are you making",
    body:
      "Which kind of model to work with. It decides the catalogue below and what the page asks you for — the two \"from an image\" options start from a picture you supply, the two \"from a prompt\" options start from nothing.",
    terms: [
      { term: "Image from a prompt", what: "Words in, one still out. The usual starting point." },
      { term: "Image from an image", what: "Editing, restyling, extending or combining pictures you already have." },
      { term: "Video from a prompt", what: "Words in, a clip out. The model invents everything, including the first frame." },
      { term: "Video from an image", what: "Animates a still you supply. More control over how it looks, less over how it moves." },
    ],
  },
  "bench.model": {
    title: "Model",
    body:
      "Every image or video model fal currently offers in this category — hundreds of them, pulled live rather than from a list we maintain. The settings panel is read from whichever one you pick, so it changes when you change models.",
  },
  "bench.prompt": {
    title: "Prompt",
    body:
      "Your words, used exactly as written. Describe the thing you want to see rather than instructing the model — \"a hand setting a letterpressed card on a sunlit table\" works, \"make me a nice image of a card\" does not. The choices on the right are appended after this, never woven into it.",
  },
  "bench.startImage": {
    title: "Starting image",
    body:
      "The picture this kind of model works from. Drop a file and it goes straight to fal's storage — it never passes through our server — or paste a link to one that is already online.",
  },
  "bench.negative": {
    title: "Negative prompt",
    body:
      "What to keep out: extra fingers, watermarks, text, blur. Not every model supports it — this field only appears when the one you picked does. \"Use the usual\" fills in the common list.",
  },
  "bench.settings": {
    title: "Model settings",
    body:
      "These are read from the model's own published schema, not written by us, which is why they change completely when you switch models and why the wording is sometimes the vendor's rather than ours. Anything left alone uses that model's own default, with one or two exceptions where we open on something more sensible — GPT Image 2 starts at medium quality rather than high, because the difference is hard to see at social sizes and easy to see on the bill.",
  },
  "bench.compiled": {
    title: "What gets sent",
    body:
      "The exact prompt string the model receives: your words first, unchanged, then a clause for each choice you made on the right. Shown in full so nothing is added on your behalf without you seeing it.",
  },
};

/* -------------------- generated: the bench's taxonomies ---------------- */

/*
 * The nine prompt-helper groups already carry a blurb and per-option phrasing,
 * so their tooltips are built from the same data the chips are — no second copy
 * to keep in step.
 */
for (const g of HINT_GROUPS) {
  HELP[`bench.hint.${g.id}`] = {
    title: g.label,
    body: `${g.blurb} All optional, and off unless you pick one. Whatever you choose is added to your prompt as a clause after your own words.`,
    terms: g.options
      .map((o) => ({ term: o.label, what: o.hint ?? o.prompt }))
      .filter((t) => t.what),
  };
}
