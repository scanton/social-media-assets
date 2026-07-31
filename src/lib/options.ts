/* ============================================================
   Scene taxonomy for BASE ASSET generation.
   Every dropdown / checkbox in the studio is defined here, and
   `buildBasePrompt` compiles a selection into a GPT-Image-2 prompt.
   ============================================================ */

export type Option = {
  id: string;
  label: string;
  /** Prompt fragment injected verbatim. */
  prompt: string;
  /** Short human hint shown under the control. */
  hint?: string;
  emoji?: string;
};

/* ---------------------------- SURFACE ---------------------------- */

export type SurfaceKind = "screen" | "print";

export const SURFACES: (Option & { kind: SurfaceKind })[] = [
  {
    id: "digital",
    kind: "screen",
    label: "Digital card",
    emoji: "📱",
    hint: "Card plays on a device screen",
    prompt: "",
  },
  {
    id: "print",
    kind: "print",
    label: "Printed card",
    emoji: "💌",
    hint: "Physical POD greeting card in the scene",
    prompt: "",
  },
];

/* ---------------------------- DEVICES ---------------------------- */

export const DEVICES: (Option & { surface: SurfaceKind; defaultAspect?: string })[] = [
  {
    id: "iphone-portrait",
    surface: "screen",
    label: "iPhone 16 Pro Max — portrait",
    emoji: "📱",
    defaultAspect: "9:16",
    prompt:
      "an iPhone 16 Pro Max held in portrait orientation, titanium frame, Dynamic Island visible at the top of the display, thin uniform bezels",
  },
  {
    id: "iphone-landscape",
    surface: "screen",
    label: "iPhone 16 Pro Max — landscape",
    emoji: "📱",
    defaultAspect: "16:9",
    prompt:
      "an iPhone 16 Pro Max held sideways in landscape orientation with two hands, titanium frame, Dynamic Island on the left edge of the display, thin uniform bezels",
  },
  {
    id: "galaxy",
    surface: "screen",
    label: "Samsung Galaxy S26 Ultra",
    emoji: "📱",
    defaultAspect: "9:16",
    prompt:
      "a Samsung Galaxy S26 Ultra in portrait orientation, flat matte aluminium rails, centred hole-punch selfie camera, very thin symmetrical bezels",
  },
  {
    id: "macbook-air",
    surface: "screen",
    label: "MacBook Air",
    emoji: "💻",
    defaultAspect: "16:9",
    prompt:
      "an open MacBook Air laptop, thin anodised aluminium chassis, backlit keyboard, screen tilted open at roughly 105 degrees",
  },
  {
    id: "pc-laptop",
    surface: "screen",
    label: "PC laptop",
    emoji: "💻",
    defaultAspect: "16:9",
    prompt:
      "an open Windows PC laptop with a dark plastic-and-metal chassis and a chunkier bottom bezel, clearly not a MacBook, screen tilted open",
  },
  {
    id: "curved-monitor",
    surface: "screen",
    label: "Curved PC monitor",
    emoji: "🖥️",
    defaultAspect: "16:9",
    prompt:
      "a wide curved PC desktop monitor on a stand, ultrawide gently curved panel, slim bezels, desktop setup",
  },
  {
    id: "ipad",
    surface: "screen",
    label: "iPad Pro",
    emoji: "📓",
    defaultAspect: "4:5",
    prompt:
      "an iPad Pro tablet, flat-edge aluminium body, even bezels on all four sides, held or propped up",
  },
  {
    id: "tv",
    surface: "screen",
    label: "Living-room TV",
    emoji: "📺",
    defaultAspect: "16:9",
    prompt:
      "a large flat-panel smart TV mounted or on a media console, near-bezel-less panel",
  },
  {
    id: "billboard",
    surface: "screen",
    label: "Outdoor billboard",
    emoji: "🛣️",
    defaultAspect: "16:9",
    prompt:
      "a large outdoor advertising billboard on a steel pole, seen from the road, clean rectangular display face",
  },
  {
    id: "signage",
    surface: "screen",
    label: "Digital signage panel",
    emoji: "🚉",
    defaultAspect: "2:3",
    prompt:
      "a vertical backlit digital advertising panel in a transit or mall environment, slim black frame, glossy front",
  },

  /* ---- print variants ---- */
  {
    id: "card-held-front",
    surface: "print",
    label: "Card held — front panel",
    emoji: "💌",
    defaultAspect: "4:5",
    prompt:
      "a printed A6 folded greeting card held upright in one hand, front panel facing the camera square-on, crisp paper edges, slight natural hand shadow",
  },
  {
    id: "card-held-open",
    surface: "print",
    label: "Card held — opened",
    emoji: "💌",
    defaultAspect: "4:5",
    prompt:
      "a printed folded greeting card held open with both hands revealing the inside spread, visible centre fold, soft paper curl",
  },
  {
    id: "card-table-standing",
    surface: "print",
    label: "Card standing on table",
    emoji: "🕯️",
    defaultAspect: "4:5",
    prompt:
      "a printed folded greeting card standing open on a table like a tent, front panel angled toward the camera, soft contact shadow on the surface",
  },
  {
    id: "card-flatlay",
    surface: "print",
    label: "Card flat-lay with envelope",
    emoji: "✉️",
    defaultAspect: "1:1",
    prompt:
      "a printed greeting card lying flat on a surface next to its kraft envelope, shot from directly overhead, tasteful props arranged around it",
  },
  {
    id: "card-mailbox",
    surface: "print",
    label: "Card at the mailbox",
    emoji: "📮",
    defaultAspect: "9:16",
    prompt:
      "a printed greeting card being pulled from a residential mailbox in its envelope, card front partially revealed",
  },
];

/* ---------------------------- SCENES ---------------------------- */

export const AUDIENCES: Option[] = [
  { id: "genz", label: "Gen Z", emoji: "🧃", prompt: "Gen Z" },
  { id: "millennial-mom", label: "Millennial moms", emoji: "🧺", prompt: "millennial mom" },
  { id: "college", label: "College / dorm", emoji: "🎓", prompt: "college student" },
  { id: "pro", label: "Young professional", emoji: "💼", prompt: "young professional" },
];

export const SCENES: (Option & { audience?: string[] })[] = [
  {
    id: "coffee-shop",
    label: "Third-wave coffee shop",
    emoji: "☕",
    audience: ["genz", "college", "pro"],
    prompt:
      "inside a warm third-wave coffee shop, reclaimed wood table, iced matcha in a plastic cup with condensation, blurred baristas in the background",
  },
  {
    id: "cafe-table",
    label: "Café table outside",
    emoji: "🥐",
    audience: ["genz", "pro"],
    prompt:
      "at a small marble bistro table on a sunny sidewalk terrace, croissant and espresso cup, blurred street life behind",
  },
  {
    id: "dog-park",
    label: "Dog park bench",
    emoji: "🐕",
    audience: ["genz", "millennial-mom", "pro"],
    prompt:
      "sitting on a wooden park bench at a dog park, leash draped over the knee, a golden retriever slightly out of focus in the mid-ground, green trees behind",
  },
  {
    id: "dorm",
    label: "Dorm room",
    emoji: "🛏️",
    audience: ["genz", "college"],
    prompt:
      "in a decorated dorm room, LED strip lights along the wall, polaroids and posters, unmade bed with a fuzzy throw",
  },
  {
    id: "aesthetic-bedroom",
    label: "Aesthetic bedroom",
    emoji: "🕯️",
    audience: ["genz"],
    prompt:
      "in a soft aesthetic bedroom, linen bedding, trailing pothos plant, warm lamp, curated clutter of books and candles",
  },
  {
    id: "mirror-selfie",
    label: "Mirror selfie moment",
    emoji: "🪞",
    audience: ["genz"],
    prompt:
      "a full-length mirror selfie set-up in a bedroom, outfit visible, mirror slightly smudged, natural daylight from a window",
  },
  {
    id: "concert",
    label: "Music festival (Coachella-style)",
    emoji: "🎪",
    audience: ["genz", "college"],
    prompt:
      "in a dense crowd at a desert music festival at dusk, stage lights and lasers behind, dust in the air, ferris wheel silhouette on the horizon",
  },
  {
    id: "subway",
    label: "Subway / transit",
    emoji: "🚇",
    audience: ["genz", "pro"],
    prompt:
      "inside a subway car, brushed steel doors and grab poles, seated passengers blurred, cool fluorescent light",
  },
  {
    id: "city-street",
    label: "City street walk",
    emoji: "🏙️",
    audience: ["genz", "pro"],
    prompt:
      "walking on a busy city street, storefronts and taxis compressed in the blurred background, sunlight bouncing off the pavement",
  },
  {
    id: "family-kitchen",
    label: "Family kitchen table",
    emoji: "🍽️",
    audience: ["millennial-mom"],
    prompt:
      "at a family kitchen table with a marble island behind, a couch and two family members visible out of focus in the background living room, warm domestic light",
  },
  {
    id: "home-office",
    label: "Home office desk",
    emoji: "🪴",
    audience: ["millennial-mom", "pro"],
    prompt:
      "at a tidy home office desk, ceramic mug, notebook, small trailing plant, morning light from a side window",
  },
  {
    id: "birthday",
    label: "Birthday party",
    emoji: "🎂",
    audience: ["millennial-mom"],
    prompt:
      "at a home birthday party, balloons and a frosted cake on the table, streamers softly out of focus, celebratory clutter",
  },
  {
    id: "gift-wrapping",
    label: "Gift wrapping session",
    emoji: "🎁",
    audience: ["millennial-mom"],
    prompt:
      "mid gift-wrapping on a living room floor, ribbon spools, scissors, kraft paper and tape scattered around",
  },
  {
    id: "picnic",
    label: "Picnic blanket",
    emoji: "🧺",
    audience: ["genz", "millennial-mom"],
    prompt:
      "on a gingham picnic blanket in a park, strawberries and a slice of cake on a ceramic plate, dappled sunlight through leaves",
  },
  {
    id: "car",
    label: "Passenger seat",
    emoji: "🚗",
    audience: ["genz", "college"],
    prompt:
      "in the passenger seat of a car, seatbelt across the frame, sun flare through the windshield, blurred road outside",
  },
  {
    id: "beach",
    label: "Golden-hour beach",
    emoji: "🌅",
    audience: ["genz", "pro"],
    prompt:
      "on a beach at golden hour, sand and a towel in frame, warm rim light, ocean softly out of focus behind",
  },
];

/* ------------------------- CAMERA ANGLES ------------------------- */

export const ANGLES: Option[] = [
  {
    id: "pov",
    label: "First-person POV",
    emoji: "👀",
    prompt:
      "shot from a first-person point of view looking down at the device held in the subject's own hands, arms entering frame from the bottom",
  },
  {
    id: "over-shoulder",
    label: "Over the shoulder",
    emoji: "🫥",
    prompt:
      "shot from just over the subject's shoulder, the back of their head softly out of focus in the near foreground",
  },
  {
    id: "flatlay",
    label: "Top-down flat lay",
    emoji: "🕹️",
    prompt:
      "shot from directly overhead at a perfect 90-degree top-down angle, the display surface flat and parallel to the sensor",
  },
  {
    id: "three-quarter",
    label: "Three-quarter angle",
    emoji: "📐",
    prompt:
      "shot from a three-quarter angle so the display surface is seen in gentle perspective, roughly 25 degrees off-axis",
  },
  {
    id: "eye-level",
    label: "Straight-on eye level",
    emoji: "🎯",
    prompt:
      "shot straight on at eye level, the display surface almost perfectly square to the camera with minimal keystone distortion",
  },
  {
    id: "low-angle",
    label: "Low hero angle",
    emoji: "🔺",
    prompt:
      "shot from a low angle looking slightly up at the subject, heroic and dramatic, sky or ceiling in the upper frame",
  },
  {
    id: "close-macro",
    label: "Macro close-up",
    emoji: "🔍",
    prompt:
      "an extreme close-up macro shot filling most of the frame with the display surface, shallow depth of field on the surrounding scene",
  },
  {
    id: "wide",
    label: "Wide establishing",
    emoji: "🌐",
    prompt:
      "a wide establishing shot showing the full environment with the device smaller in frame but still crisply legible",
  },
  {
    id: "handheld-tilt",
    label: "Handheld dutch tilt",
    emoji: "🌀",
    prompt:
      "a slightly tilted handheld snapshot framing, casual and imperfect, a few degrees of dutch angle",
  },
];

/* ------------------------- ORIENTATIONS -------------------------- */

export type AspectId = "9:16" | "4:5" | "1:1" | "16:9" | "2:3" | "3:4";

export const ASPECTS: {
  id: AspectId;
  label: string;
  channel: string;
  width: number;
  height: number;
}[] = [
  { id: "9:16", label: "9:16 Vertical", channel: "TikTok / Reels / Stories", width: 1536, height: 2736 },
  { id: "4:5", label: "4:5 Portrait", channel: "Instagram feed", width: 1920, height: 2400 },
  { id: "1:1", label: "1:1 Square", channel: "Feed / carousel", width: 2048, height: 2048 },
  { id: "16:9", label: "16:9 Landscape", channel: "YouTube / web hero", width: 2736, height: 1536 },
  { id: "2:3", label: "2:3 Tall", channel: "Pinterest", width: 1728, height: 2592 },
  { id: "3:4", label: "3:4 Portrait", channel: "Pinterest / ads", width: 1824, height: 2432 },
];

/* --------------------------- LIGHTING ---------------------------- */

export const LIGHTING: Option[] = [
  { id: "golden", label: "Golden hour", emoji: "🌇", prompt: "warm low golden-hour sunlight with long soft shadows and gentle lens flare" },
  { id: "window", label: "Soft window light", emoji: "🪟", prompt: "soft diffused daylight from a large window, gentle falloff, no harsh shadows" },
  { id: "overcast", label: "Overcast daylight", emoji: "☁️", prompt: "flat even overcast daylight, cool neutral white balance" },
  { id: "flash", label: "Direct flash", emoji: "⚡", prompt: "hard direct on-camera flash, bright falloff into a darker background, crunchy contrast" },
  { id: "neon", label: "Neon night", emoji: "🌃", prompt: "night-time with saturated magenta and cyan neon spill, wet reflective surfaces" },
  { id: "warm-lamp", label: "Warm indoor lamp", emoji: "🛋️", prompt: "cosy warm tungsten lamplight indoors, amber highlights, deep soft shadows" },
  { id: "studio", label: "Clean studio", emoji: "🎛️", prompt: "clean soft studio lighting with a large key softbox and subtle fill, seamless background" },
  { id: "stage", label: "Stage / concert", emoji: "🎆", prompt: "coloured concert stage lighting with beams and haze, strong rim light on the subject" },
];

/* -------------------------- FILM LOOK ---------------------------- */

export const LOOKS: Option[] = [
  { id: "iphone", label: "iPhone snapshot", emoji: "📸", prompt: "shot on an iPhone, natural computational-photography look, true-to-life colour" },
  { id: "film35", label: "35mm film", emoji: "🎞️", prompt: "shot on 35mm film, fine organic grain, slightly lifted blacks, halation in the highlights" },
  { id: "editorial", label: "Editorial / campaign", emoji: "📰", prompt: "high-end editorial campaign photography, medium format sharpness, considered composition" },
  { id: "digicam", label: "Y2K digicam", emoji: "💿", prompt: "early-2000s point-and-shoot digicam look, slight noise, harsh flash, nostalgic colour" },
  { id: "ugc", label: "Raw UGC", emoji: "🤳", prompt: "raw unpolished user-generated content look, imperfect framing, authentic and un-styled" },
];

/* --------------------------- PRESENCE ---------------------------- */

export const PRESENCE: Option[] = [
  { id: "none", label: "No people", emoji: "🚫", prompt: "no people visible in the frame at all, the object rests on its own" },
  { id: "hands", label: "Hands only", emoji: "🤲", prompt: "only the subject's hands and forearms are visible, tasteful manicure, no face in frame" },
  { id: "one-partial", label: "One person, partial", emoji: "🙋", prompt: "one person partially in frame, cropped at the chin or seen from behind, face not the focus" },
  { id: "one-full", label: "One person, full", emoji: "🧍", prompt: "one person clearly in frame and engaged with the device, natural candid expression" },
  { id: "group", label: "Friend group", emoji: "👯", prompt: "a small group of friends together, one holding the device while the others lean in" },
];

/* --------------------------- HELPERS ----------------------------- */

export const byId = <T extends { id: string }>(list: T[], id: string | undefined) =>
  list.find((o) => o.id === id);

const joinPrompts = (parts: (string | undefined)[]) =>
  parts.filter((p): p is string => Boolean(p && p.trim())).join(". ");

export type BaseSelection = {
  surface: SurfaceKind;
  deviceId: string;
  sceneId: string;
  angleId: string;
  lightingId: string;
  lookId: string;
  presenceId: string;
  audienceId: string;
  aspect: AspectId;
  blankScreen: boolean;
  extraNotes?: string;
};

/**
 * The non-negotiable part of the base-asset spec: the display surface must come
 * back perfectly empty so a HeartStamp card can be composited into it later.
 */
function blankSurfaceClause(surface: SurfaceKind): string {
  if (surface === "print") {
    return [
      "CRITICAL REQUIREMENT: the greeting card's printed panel must be COMPLETELY BLANK — pure flat white paper with absolutely no artwork, no text, no logo, no pattern and no printing of any kind",
      "the entire blank panel must be fully visible and unobstructed, never cropped by the frame edge and never covered by fingers, props or shadows",
      "all four corners of the blank panel must be inside the frame with clean sharp edges, so a design can be composited onto it afterwards",
      "keep the paper evenly lit with no blown-out highlights and no heavy shadow across the panel",
    ].join(". ");
  }
  return [
    "CRITICAL REQUIREMENT: the device screen must be COMPLETELY BLANK — a pure flat white rectangle with absolutely no user interface, no icons, no status bar, no wallpaper, no text and no imagery of any kind",
    "the entire screen area must be fully visible and unobstructed, never cropped by the frame edge and never covered by fingers, hair, props or glare",
    "all four corners of the screen must be inside the frame with clean sharp edges and correct perspective, so a video can be composited onto it afterwards",
    "keep the screen evenly lit and matte with no strong specular reflections, no hotspots and no moiré",
  ].join(". ");
}

/** Compile a base-image prompt for GPT-Image-2. */
export function buildBasePrompt(sel: BaseSelection): string {
  const device = byId(DEVICES, sel.deviceId);
  const scene = byId(SCENES, sel.sceneId);
  const angle = byId(ANGLES, sel.angleId);
  const light = byId(LIGHTING, sel.lightingId);
  const look = byId(LOOKS, sel.lookId);
  const presence = byId(PRESENCE, sel.presenceId);
  const audience = byId(AUDIENCES, sel.audienceId);
  const aspect = ASPECTS.find((a) => a.id === sel.aspect);

  const subjectLine =
    sel.surface === "print"
      ? `A photorealistic lifestyle photograph of ${device?.prompt ?? "a printed greeting card"}`
      : `A photorealistic lifestyle photograph of ${device?.prompt ?? "a smartphone"}`;

  return joinPrompts([
    subjectLine,
    scene?.prompt,
    presence?.prompt,
    angle?.prompt,
    light?.prompt,
    look?.prompt,
    audience ? `the styling, wardrobe and props should read as authentically ${audience.prompt}` : undefined,
    aspect ? `composed for a ${aspect.id} ${aspect.label.split(" ")[1].toLowerCase()} social crop` : undefined,
    sel.blankScreen ? blankSurfaceClause(sel.surface) : undefined,
    "Photorealistic, sharp, high dynamic range, believable real-world materials and physics",
    "Absolutely no watermarks, no captions, no brand logos and no readable text anywhere in the image",
    sel.extraNotes?.trim(),
  ]);
}

/** Compile the composite (screen/panel replacement) prompt for GPT-Image-2 edit. */
export function buildCompositePrompt(opts: {
  surface: SurfaceKind;
  hasBase: boolean;
  extraNotes?: string;
}): string {
  const target = opts.surface === "print" ? "printed card panel" : "device screen";
  const artwork = opts.surface === "print" ? "@Image2 artwork" : "@Image2 card frame";

  return joinPrompts([
    `Take the first image and place the second image onto the blank ${target}`,
    `The second image is HeartStamp greeting-card artwork. Replace the blank white ${target} in the first image with it`,
    "Match the exact perspective, keystone and corner geometry of the original surface so the artwork looks genuinely printed or displayed there",
    "Match the scene's brightness, contrast, colour temperature and white balance",
    "Preserve the original reflections, glare, screen curvature, paper texture, grain and depth of field so the composite is invisible",
    "Preserve every occlusion: fingers, hair, props or edges that overlapped the surface must still overlap the artwork",
    "Do not crop, letterbox or distort the artwork's own proportions any more than the surface geometry requires; fill the surface edge to edge",
    "Change absolutely nothing else in the photograph — same subject, same background, same lighting, same framing",
    `The ${artwork} must remain legible and un-warped`,
    opts.extraNotes?.trim(),
  ]);
}

/* ------------------------- VIDEO MOTION -------------------------- */

export const MOTIONS: (Option & { surface?: SurfaceKind })[] = [
  {
    id: "hold-steady",
    label: "Steady hold",
    emoji: "🫱",
    prompt:
      "the camera holds nearly still with only subtle handheld micro-movement and natural breathing; the subject holds their pose",
  },
  {
    id: "slow-push",
    label: "Slow push in",
    emoji: "🎥",
    prompt: "the camera slowly pushes in toward the display surface in one smooth continuous dolly move",
  },
  {
    id: "slow-pull",
    label: "Slow pull out",
    emoji: "↔️",
    prompt: "the camera slowly pulls back to reveal more of the surrounding environment in one smooth continuous move",
  },
  {
    id: "orbit",
    label: "Gentle orbit",
    emoji: "🛰️",
    prompt: "the camera arcs gently around the subject in a slow parallax orbit",
  },
  {
    id: "handheld-walk",
    label: "Handheld walk",
    emoji: "🚶",
    prompt: "handheld walking camera with natural bounce, the subject moves through the environment",
  },
  {
    id: "lift-to-camera",
    label: "Lift toward camera",
    emoji: "🙌",
    prompt: "the subject lifts the device up toward the camera, presenting the screen proudly to the viewer",
  },
  {
    id: "card-open",
    surface: "print",
    label: "Card opening",
    emoji: "💌",
    prompt:
      "hands slowly open the folded greeting card to reveal the inside, the paper flexing naturally with realistic weight",
  },
  {
    id: "card-zoom",
    surface: "print",
    label: "Stationary card zoom",
    emoji: "🔎",
    prompt:
      "the greeting card stays completely stationary while the camera slowly zooms in on it, no hands entering frame",
  },
  {
    id: "envelope-reveal",
    surface: "print",
    label: "Envelope reveal",
    emoji: "✉️",
    prompt: "hands slide the greeting card out of its envelope to reveal the front panel",
  },
];

export const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p", "4k"] as const;
export const VIDEO_DURATIONS = ["auto", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"] as const;

export function buildAnimatePrompt(opts: {
  motionId: string;
  surface: SurfaceKind;
  sceneId?: string;
  extraNotes?: string;
}): string {
  const motion = byId(MOTIONS, opts.motionId);
  const scene = byId(SCENES, opts.sceneId ?? "");
  const surfaceNoun = opts.surface === "print" ? "the printed greeting card" : "the device screen";

  return joinPrompts([
    "Bring this photograph to life as a short, natural-looking live-action clip",
    motion?.prompt,
    scene ? `Keep the environment consistent: ${scene.prompt}` : undefined,
    `Whatever artwork is already on ${surfaceNoun} must stay perfectly locked to that surface with correct perspective for the whole clip — it must never slide, flicker, warp or change`,
    "Preserve the exact identity, wardrobe, framing and lighting of the source photograph",
    "Realistic physics and motion blur. No text overlays, no captions, no watermarks, no logos, no scene cuts",
    opts.extraNotes?.trim(),
  ]);
}

export function buildScreenReplacePrompt(opts: {
  surface: SurfaceKind;
  motionId: string;
  extraNotes?: string;
}): string {
  const motion = byId(MOTIONS, opts.motionId);
  const surfaceNoun = opts.surface === "print" ? "the blank printed card panel" : "the blank device screen";

  return joinPrompts([
    `Recreate the scene in @Image1 as a live-action clip, and play the footage from @Video1 on ${surfaceNoun}`,
    `@Video1 is a HeartStamp greeting-card animation. It should appear to be genuinely playing on ${surfaceNoun} in @Image1, filling it edge to edge`,
    "Lock the played footage to the surface with correct perspective and keystone for the entire clip — it must never slide, drift or detach",
    "Match the scene's brightness, colour temperature and reflections so the footage looks natively displayed, not pasted on",
    motion?.prompt,
    "Preserve the exact subject, wardrobe, environment, framing and lighting of @Image1",
    "Realistic physics and motion blur. No text overlays, no captions, no watermarks, no scene cuts",
    opts.extraNotes?.trim(),
  ]);
}
