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
  {
    id: "boba-shop",
    label: "Boba tea shop",
    emoji: "🧋",
    audience: ["genz", "college"],
    prompt:
      "at the counter of a bright boba tea shop, a sweating cup of brown-sugar milk tea with a fat straw, pastel tiled wall, menu boards glowing softly out of focus",
  },
  {
    id: "bookstore",
    label: "Bookstore nook",
    emoji: "📚",
    audience: ["genz", "college", "pro"],
    prompt:
      "tucked into a corner of an independent bookstore, warm shelves of spines receding behind, a stack of paperbacks and a takeaway cup on the arm of a worn reading chair",
  },
  {
    id: "record-shop",
    label: "Record shop",
    emoji: "🎧",
    audience: ["genz", "college"],
    prompt:
      "flipping through crates in a record shop, sleeves fanned out under the fingers, band posters and neon on the wall behind, dust in a shaft of window light",
  },
  {
    id: "thrift-store",
    label: "Thrift store",
    emoji: "🧥",
    audience: ["genz", "college"],
    prompt:
      "between packed racks in a vintage thrift store, denim and printed shirts crowding the frame, hand-lettered signs and fluorescent light overhead",
  },
  {
    id: "nail-salon",
    label: "Nail salon",
    emoji: "💅",
    audience: ["genz", "pro"],
    prompt:
      "at a nail salon station, fresh glossy manicure catching the light, polish bottles lined up on white marble, soft pink interior blurred behind",
  },
  {
    id: "pilates-studio",
    label: "Pilates / gym",
    emoji: "🧘",
    audience: ["genz", "pro"],
    prompt:
      "sitting on a reformer bed in a bright pilates studio, water bottle and folded towel beside, blonde wood and big windows, other equipment softly out of focus",
  },
  {
    id: "farmers-market",
    label: "Farmers market",
    emoji: "🥕",
    audience: ["genz", "millennial-mom", "pro"],
    prompt:
      "walking a farmers market on a bright morning, canvas tote of produce on the shoulder, stall awnings and crates of flowers and fruit crowding the background",
  },
  {
    id: "rooftop-bar",
    label: "Rooftop bar",
    emoji: "🍸",
    audience: ["genz", "pro"],
    prompt:
      "at a rooftop bar as the sun drops, spritz glass sweating on the rail, string lights just coming on, hazy city skyline stretching out behind",
  },
  {
    id: "diner-booth",
    label: "Diner booth",
    emoji: "🍟",
    audience: ["genz", "college"],
    prompt:
      "in a vinyl diner booth, chrome edging and a laminate table, milkshake and a basket of fries, warm pendant light overhead, window reflections behind",
  },
  {
    id: "brunch-table",
    label: "Brunch table",
    emoji: "🥞",
    audience: ["genz", "millennial-mom", "pro"],
    prompt:
      "at a busy brunch table from above the plates, pancakes and a mimosa, linen napkins, friends' hands and cutlery moving at the edges of frame",
  },
  {
    id: "train-window",
    label: "Train window seat",
    emoji: "🚆",
    audience: ["genz", "pro"],
    prompt:
      "in a train window seat, landscape streaking past the glass, tray table down with a coffee cup, cool daylight raking across the seat fabric",
  },
  {
    id: "airport-gate",
    label: "Airport gate",
    emoji: "✈️",
    audience: ["genz", "pro"],
    prompt:
      "waiting at an airport gate, carry-on at the feet, huge window with a plane on the apron behind, rows of empty seats receding out of focus",
  },
  {
    id: "rainy-window",
    label: "Rainy window at home",
    emoji: "🌧️",
    audience: ["genz", "millennial-mom"],
    prompt:
      "curled up by a rain-streaked window at home, blanket over the knees, mug of tea on the sill, grey soft light and bokeh raindrops on the glass",
  },
  {
    id: "movie-night",
    label: "Couch movie night",
    emoji: "🍿",
    audience: ["genz", "millennial-mom"],
    prompt:
      "on the couch under a heavy throw at night, bowl of popcorn, TV glow flickering cool across the room, warm lamp in the corner",
  },
  {
    id: "bathtub-selfcare",
    label: "Self-care evening",
    emoji: "🛁",
    audience: ["genz", "millennial-mom"],
    prompt:
      "a candlelit self-care evening, bath tray with a candle and a glass, steam and warm low light, tiled wall softly out of focus",
  },
  {
    id: "school-pickup",
    label: "School pickup line",
    emoji: "🎒",
    audience: ["millennial-mom"],
    prompt:
      "in the driver's seat waiting in the school pickup line, backpack on the passenger seat, windshield light, other cars queued blurry ahead",
  },
  {
    id: "soccer-sideline",
    label: "Sideline at practice",
    emoji: "⚽",
    audience: ["millennial-mom"],
    prompt:
      "on a folding chair at the sideline of a kids' sports practice, travel mug in hand, green field and small figures running out of focus behind",
  },
  {
    id: "nursery",
    label: "Nursery / new baby",
    emoji: "🍼",
    audience: ["millennial-mom"],
    prompt:
      "in a soft pastel nursery, rocking chair and muslin blankets, mobile turning slowly, gentle daylight through sheer curtains",
  },
  {
    id: "craft-table",
    label: "Craft table",
    emoji: "✂️",
    audience: ["millennial-mom", "genz"],
    prompt:
      "at a craft table mid-project, washi tape, stickers and paper offcuts spread out, warm task lamp, scissors and glue within reach",
  },
  {
    id: "plant-repotting",
    label: "Plant corner",
    emoji: "🪴",
    audience: ["genz", "millennial-mom"],
    prompt:
      "in a sunny plant corner surrounded by monstera and trailing pothos, terracotta pots and scattered soil on newspaper, bright dappled light",
  },
  {
    id: "wedding-reception",
    label: "Wedding reception",
    emoji: "💒",
    audience: ["genz", "millennial-mom", "pro"],
    prompt:
      "at a wedding reception table after dark, candles and florals down the centre, champagne flutes, warm bistro lights strung above the dance floor behind",
  },
  {
    id: "game-day",
    label: "Game day / tailgate",
    emoji: "🏟️",
    audience: ["genz", "college"],
    prompt:
      "at a tailgate before a game, team colours everywhere, cooler and folding chairs, stadium lights rising over the parking lot in the background",
  },
  {
    id: "coworking",
    label: "Coworking space",
    emoji: "🖇️",
    audience: ["pro", "genz"],
    prompt:
      "at a shared desk in a bright coworking space, laptop and notebook, plants and glass partitions, people moving softly out of focus behind",
  },
  {
    id: "campfire",
    label: "Campfire at dusk",
    emoji: "🔥",
    audience: ["genz", "college", "millennial-mom"],
    prompt:
      "beside a campfire at dusk, camp chairs and a blanket, warm orange firelight flickering on the subject, deep blue treeline behind",
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
    label: "Macro lens",
    emoji: "🔍",
    prompt:
      "a macro-lens viewpoint right up against the surface, depth of field falling off fast into the surrounding scene",
  },
  {
    id: "wide",
    label: "Wide establishing",
    emoji: "🌐",
    prompt:
      "an establishing viewpoint that takes in the surrounding environment around the subject",
  },
  {
    id: "handheld-tilt",
    label: "Handheld dutch tilt",
    emoji: "🌀",
    prompt:
      "a slightly tilted handheld snapshot framing, casual and imperfect, a few degrees of dutch angle",
  },
];

/* --------------------------- FRAMING ----------------------------- */

/**
 * How much of the frame the product takes up. Kept separate from ANGLES: those
 * say where the camera is, this says how close it is.
 */
export const FRAMINGS: Option[] = [
  {
    id: "hero",
    label: "Hero close-up",
    emoji: "🎯",
    hint: "Card is the whole point",
    prompt: "hero",
  },
  {
    id: "extreme",
    label: "Fills the frame",
    emoji: "🔍",
    hint: "Maximum card real estate",
    prompt: "extreme",
  },
  {
    id: "balanced",
    label: "Balanced",
    emoji: "⚖️",
    hint: "Card leads, scene supports",
    prompt: "balanced",
  },
  {
    id: "context",
    label: "Environmental",
    emoji: "🌐",
    hint: "Scene tells the story",
    prompt: "context",
  },
];

/** Concrete area targets read better than adjectives like "close" or "tight". */
function framingClause(framingId: string, surface: SurfaceKind): string {
  const subject = surface === "print" ? "greeting card" : "device";
  const face = surface === "print" ? "printed front panel" : "screen";

  const spec: Record<string, { area: string; tail: string }> = {
    extreme: {
      area: "65-80%",
      tail:
        "Fill the frame with it. The surrounding environment survives only as soft, blurred context at the very edges",
    },
    hero: {
      area: "45-60%",
      tail:
        "Crop in tight and let the environment read only around the edges of frame and in the background",
    },
    balanced: {
      area: "25-35%",
      tail: "The environment is clearly visible around it but never competes with it for attention",
    },
    context: {
      area: "12-20%",
      tail: "The environment does the storytelling, but the artwork must still be sharp and readable",
    },
  };
  const { area, tail } = spec[framingId] ?? spec.hero;

  return [
    `FRAMING — this matters as much as anything else: get in close on the ${subject}. It is unmistakably the hero of the shot, positioned near the centre of frame`,
    `its ${face} alone must occupy roughly ${area} of the total image area`,
    `the artwork on that ${face} has to be large, sharp and completely legible at a glance while someone is scrolling — that artwork is the entire point of the photograph`,
    tail,
    `do not shoot this from across the room and do not let the ${subject} become a small detail in a wider scene`,
  ].join(". ");
}

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

export type SceneSelection = {
  surface: SurfaceKind;
  deviceId: string;
  sceneId: string;
  angleId: string;
  lightingId: string;
  lookId: string;
  presenceId: string;
  audienceId: string;
  framingId: string;
  aspect: AspectId;
  /** True when card artwork is supplied as a reference image. */
  hasCard: boolean;
  extraNotes?: string;
};

/**
 * Fallback for when no card artwork is selected: leave the display surface empty
 * and fully in frame so artwork can still be dropped in later.
 */
function blankSurfaceClause(surface: SurfaceKind): string {
  if (surface === "print") {
    return [
      "The greeting card's printed panel must be COMPLETELY BLANK — pure flat white paper with no artwork, no text, no logo and no printing of any kind",
      "the entire blank panel must be fully visible and unobstructed, never cropped by the frame edge and never covered by fingers, props or shadows",
      "all four corners of the blank panel must be inside the frame with clean sharp edges",
      "keep the paper evenly lit with no blown-out highlights and no heavy shadow across the panel",
    ].join(". ");
  }
  return [
    "CRITICAL REQUIREMENT: the device screen must be COMPLETELY BLANK — one pure flat white rectangle with no user interface, no icons, no status bar, no wallpaper, no text and no imagery of any kind",
    "it must read as a single clean quadrilateral of uniform white with sharp unambiguous corners and edges, clearly separated from the rest of the scene by the device's dark bezel",
    "the entire screen area must be fully visible and unobstructed, never cropped by the frame edge and never covered by fingers, hair, props or glare",
    "all four corners of the screen must be inside the frame with correct perspective",
    "keep the screen evenly lit and matte with no gradient, no strong specular reflections, no hotspots and no moiré",
    "nothing else in the photograph may be a large flat white rectangle — keep tables, plates, paper and walls clearly off-white, textured or shadowed so the screen is the only clean white panel",
  ].join(". ");
}

/**
 * The card is now placed during scene generation rather than in a second pass,
 * so this clause carries the whole burden of making it look genuinely displayed.
 */
function cardOnSurfaceClause(surface: SurfaceKind): string {
  if (surface === "print") {
    return [
      "CRITICAL REQUIREMENT: the artwork in the supplied reference image is printed on the front panel of the greeting card in the scene",
      "reproduce that artwork exactly as provided — same composition, same colours, same typography; do not redesign it, recolour it, restyle it, add text to it or invent new elements",
      "fit it to the card panel edge to edge with the correct perspective and keystone for the card's angle, following any curl or fold in the paper",
      "let the scene's lighting fall across it naturally — matching brightness, colour temperature, paper texture and grain — so it reads as genuinely printed rather than pasted on",
      "the whole printed panel must be inside the frame, in focus and legible; fingers or props may overlap its edges naturally but must not cover the artwork",
    ].join(". ");
  }
  return [
    "CRITICAL REQUIREMENT: the artwork in the supplied reference image is displayed full-screen on the device in the scene",
    "reproduce that artwork exactly as provided — same composition, same colours, same typography; do not redesign it, recolour it, restyle it, add text to it or invent new elements",
    "fit it to the screen edge to edge with the correct perspective and keystone for the device's angle, with no status bar, no browser chrome, no app UI and no letterboxing",
    "give it believable emissive screen brightness plus the scene's own reflections and glare, so it reads as genuinely displayed rather than pasted on",
    "the whole screen must be inside the frame, in focus and legible; fingers may grip the device's outer edges but no finger, thumb or hand ever rests on, touches or covers any part of the screen itself",
  ].join(". ");
}

/** Compile the scene prompt for GPT-Image-2 (text-to-image or edit). */
export function buildScenePrompt(sel: SceneSelection): string {
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
    framingClause(sel.framingId, sel.surface),
    light?.prompt,
    look?.prompt,
    audience ? `the styling, wardrobe and props should read as authentically ${audience.prompt}` : undefined,
    aspect ? `composed for a ${aspect.id} ${aspect.label.split(" ")[1].toLowerCase()} social crop` : undefined,
    sel.hasCard ? cardOnSurfaceClause(sel.surface) : blankSurfaceClause(sel.surface),
    "Photorealistic, sharp, high dynamic range, believable real-world materials and physics",
    // The HeartStamp mark is composited on afterwards in the browser, so the
    // model must not try to draw one of its own.
    sel.hasCard
      ? "No watermarks, no captions, no brand logos and no readable text anywhere except the supplied card artwork itself"
      : "Absolutely no watermarks, no captions, no brand logos and no readable text anywhere in the image",
    sel.extraNotes?.trim(),
  ]);
}

/* ------------------------- VIDEO MOTION -------------------------- */

export type MotionKind = "camera" | "action";

/**
 * "camera" moves the lens across an otherwise still scene.
 * "action" makes the world move — people do things, the background lives.
 */
export const MOTIONS: (Option & { surface?: SurfaceKind; kind: MotionKind })[] = [
  /* ------------------------------ camera ----------------------------- */
  {
    id: "hold-steady",
    kind: "camera",
    label: "Steady hold",
    emoji: "🫱",
    prompt:
      "the camera holds nearly still with only subtle handheld micro-movement and natural breathing; the subject holds their pose",
  },
  {
    id: "slow-push",
    kind: "camera",
    label: "Slow push in",
    emoji: "🎥",
    prompt: "the camera slowly pushes in toward the display surface in one smooth continuous dolly move",
  },
  {
    id: "slow-pull",
    kind: "camera",
    label: "Slow pull out",
    emoji: "↔️",
    prompt: "the camera slowly pulls back to reveal more of the surrounding environment in one smooth continuous move",
  },
  {
    id: "orbit",
    kind: "camera",
    label: "Gentle orbit",
    emoji: "🛰️",
    prompt: "the camera arcs gently around the subject in a slow parallax orbit",
  },
  {
    id: "handheld-walk",
    kind: "camera",
    label: "Handheld walk",
    emoji: "🚶",
    prompt:
      "handheld walking camera with natural bounce, the subject moves through the environment, the background slides past with real parallax",
  },
  {
    id: "lift-to-camera",
    kind: "camera",
    label: "Lift toward camera",
    emoji: "🙌",
    prompt: "the subject lifts the device up toward the camera, presenting the screen proudly to the viewer",
  },

  /* ------------------------------ action ----------------------------- */
  {
    id: "open-and-react",
    kind: "action",
    label: "Open & react",
    emoji: "🥹",
    prompt:
      "the subject looks down at the card and reacts in real time — eyebrows lift, a grin spreads, a hand comes up to their mouth, they let out a small laugh and shake their head. Shoulders and chest move with the breath and the laugh. Genuine, unforced, caught-in-the-moment energy",
  },
  {
    id: "show-a-friend",
    kind: "action",
    label: "Show a friend",
    emoji: "👯",
    prompt:
      "the subject turns and tilts the card toward a friend beside them; the friend leans into frame, eyes widen, they both start laughing and the friend grabs their arm. Two people genuinely reacting to each other, natural overlapping movement",
  },
  {
    id: "lean-in-together",
    kind: "action",
    label: "Lean in together",
    emoji: "🫂",
    prompt:
      "a second person leans in from the side until their heads are almost touching, both watching the screen; they exchange a glance, one of them laughs and nudges the other. Warm, close, unposed",
  },
  {
    id: "read-and-linger",
    kind: "action",
    label: "Read & linger",
    emoji: "🥰",
    prompt:
      "the subject's eyes track slowly across the card, they go completely still for a beat, a smile creeps in, then they look up and away off-camera as if remembering the person who sent it. Small, honest, unhurried",
  },
  {
    id: "prop-and-watch",
    kind: "action",
    label: "Prop it up & watch",
    emoji: "🪑",
    prompt:
      "the subject props the device up against something on the table, lets go, sits back and folds their arms to watch it from a comfortable distance, sipping their drink. Hands leave the device entirely",
  },
  {
    id: "double-take",
    kind: "action",
    label: "Double take",
    emoji: "😳",
    prompt:
      "the subject glances away, starts to turn from the device, then snaps their head straight back to it with wide eyes and an open-mouthed grin. A proper caught-off-guard double take",
  },
  {
    id: "pass-it-over",
    kind: "action",
    label: "Pass it over",
    emoji: "🤝",
    prompt:
      "the subject hands the card across to another person, who takes it, looks down at it and breaks into a smile. Hands cross in frame, the exchange has real weight and timing",
  },
  {
    id: "busy-world",
    kind: "action",
    label: "Busy world",
    emoji: "🌆",
    prompt:
      "the world around the subject is alive — people cross behind them in both directions, traffic and bicycles pass, a door swings, steam rises, leaves and fabric stir in the breeze. The subject stays with the card while life keeps moving around them",
  },
  {
    id: "celebrate",
    kind: "action",
    label: "Celebration",
    emoji: "🎉",
    prompt:
      "party energy erupts around the subject — friends cheer and clap, arms go up, confetti or streamers drift down through the frame, glasses clink just off-centre, everyone is laughing and moving at once",
  },
  {
    id: "walk-and-talk",
    kind: "action",
    label: "Walk & talk",
    emoji: "🗣️",
    prompt:
      "the subject walks toward camera talking animatedly and gesturing with their free hand, the environment sliding past behind them with strong parallax, hair and clothing bouncing with each step",
  },
  {
    id: "settle-in",
    kind: "action",
    label: "Settle in",
    emoji: "🛋️",
    prompt:
      "the subject sets a drink down, drops into a seat and gets comfortable, pulls one knee up, then finally settles their eyes on the card and softens into a smile. Unhurried, lived-in domestic motion",
  },
  {
    id: "wind-and-light",
    kind: "action",
    label: "Wind & light",
    emoji: "🍃",
    prompt:
      "a breeze moves through the shot — hair lifts and falls, loose fabric ripples, leaves and dappled sunlight shift across the subject and the surface, dust motes drift through the light. The subject breathes, blinks and shifts their weight naturally",
  },

  /* --------------------------- print-only ---------------------------- */
  {
    id: "card-open",
    kind: "action",
    surface: "print",
    label: "Card opening",
    emoji: "💌",
    prompt:
      "hands slowly open the folded greeting card to reveal the inside, the paper flexing naturally with realistic weight, then the subject's eyes track across it",
  },
  {
    id: "card-zoom",
    kind: "camera",
    surface: "print",
    label: "Stationary card zoom",
    emoji: "🔎",
    prompt:
      "the greeting card stays completely stationary while the camera slowly zooms in on it, no hands entering frame",
  },
  {
    id: "envelope-reveal",
    kind: "action",
    surface: "print",
    label: "Envelope reveal",
    emoji: "✉️",
    prompt:
      "hands tear open the envelope, slide the greeting card out and turn it to face the camera, paper and flap moving with believable stiffness",
  },
];

export const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p", "4k"] as const;
export const VIDEO_DURATIONS = ["auto", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"] as const;

/**
 * The HeartStamp emblem is burned into the still before it reaches Seedance, so
 * the model must treat it as a fixed overlay rather than an object in the scene.
 */
/**
 * Seedance will happily let a person poke at the screen while a card animation
 * plays, which instantly breaks the illusion — the taps never line up with what
 * is on screen.
 */
const NO_TOUCH_CLAUSE = [
  "CRITICAL: nobody touches, taps, swipes, pinches, scrolls, points at or otherwise interacts with the screen at any moment",
  "hands only support the device from its outer edges, back or frame and stay settled there",
  "no finger, thumb or stylus ever enters, hovers over or passes across the screen area",
  "the person watches what is playing — they never operate the device",
].join(". ");

/**
 * The screen is a window, not a portal. Without this, objects that exit the
 * bottom of a card animation get rendered as though they fall out of the phone
 * and into the room.
 */
const SCREEN_CONTAINMENT_CLAUSE = [
  "ABSOLUTE RULE — the edges of the screen are a hard clipping boundary",
  "everything shown on the screen exists only inside that rectangle and is flat imagery displayed on a panel, not physical objects in the room",
  "no element, object, character, hand, card, envelope, particle, confetti or effect from the on-screen content may ever cross, overflow, spill past or extend beyond the screen's edges",
  "if something moves out of the on-screen frame it simply disappears at the screen edge — it must never fall out of the device, land on a surface, drift into the room, overlap the device's bezel or become a physical object in the scene",
  "nothing on screen casts a shadow, reflection, light spill or depth into the real environment",
].join(". ");

/** Print equivalent: ink stays ink. */
const PRINT_CONTAINMENT_CLAUSE = [
  "The artwork on the card is flat printed ink and stays completely within the card's printed panel",
  "no element of the design may lift off the paper, extend past the card's edges, gain depth or become a physical object in the scene",
].join(". ");

const LOGO_LOCK_CLAUSE = [
  "There is a small HeartStamp heart logo in the bottom-right corner of the frame",
  "it is a flat 2D overlay burned onto the footage, not an object inside the scene",
  "keep it perfectly static, sharp, fully opaque and identical in every single frame — exactly the same size, the same position and the same colours",
  "it must never move, drift, rotate, scale, fade, blur, catch the scene lighting, gain a shadow or reflection, or be occluded by anything in the scene",
].join(". ");

export function buildAnimatePrompt(opts: {
  motionId: string;
  surface: SurfaceKind;
  sceneId?: string;
  hasLogo?: boolean;
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
    opts.surface === "print" ? PRINT_CONTAINMENT_CLAUSE : SCREEN_CONTAINMENT_CLAUSE,
    opts.surface === "print" ? undefined : NO_TOUCH_CLAUSE,
    "Preserve the exact identity, wardrobe, framing and lighting of the source photograph",
    opts.hasLogo ? LOGO_LOCK_CLAUSE : undefined,
    opts.hasLogo
      ? "Realistic physics and motion blur. No scene cuts, and no text overlays, captions or watermarks beyond the corner logo already present"
      : "Realistic physics and motion blur. No text overlays, no captions, no watermarks, no logos, no scene cuts",
    opts.extraNotes?.trim(),
  ]);
}

export function buildScreenReplacePrompt(opts: {
  surface: SurfaceKind;
  motionId: string;
  hasLogo?: boolean;
  extraNotes?: string;
}): string {
  const motion = byId(MOTIONS, opts.motionId);
  const surfaceNoun = opts.surface === "print" ? "the printed card panel" : "the device screen";

  return joinPrompts([
    `Recreate the scene in @Image1 as a live-action clip, and play the footage from @Video1 on ${surfaceNoun}`,
    `@Video1 is a HeartStamp greeting-card animation. It should appear to be genuinely playing on ${surfaceNoun} in @Image1, filling it edge to edge`,
    `@Image1 already shows the exact opening frame of @Video1 on ${surfaceNoun} — it is a pixel-accurate composite, not an approximation. Continue straight on from precisely that frame: no cut, no flash, no white or blank screen, no fade in, no restart, no re-framing. Frame one of this clip must be identical to @Image1`,
    `@Video1 is screen content, not a scene to stage. Never recreate, re-enact or reposition its subjects in the physical environment — its imagery exists only as pixels inside ${surfaceNoun} and nowhere else in the shot`,
    "Lock the played footage to the surface with correct perspective and keystone for the entire clip — it must never slide, drift or detach",
    "Match the scene's brightness, colour temperature and reflections so the footage looks natively displayed, not pasted on",
    opts.surface === "print" ? PRINT_CONTAINMENT_CLAUSE : SCREEN_CONTAINMENT_CLAUSE,
    opts.surface === "print" ? undefined : NO_TOUCH_CLAUSE,
    motion?.prompt,
    "Preserve the exact subject, wardrobe, environment, framing and lighting of @Image1",
    opts.hasLogo ? LOGO_LOCK_CLAUSE : undefined,
    opts.hasLogo
      ? "Realistic physics and motion blur. No scene cuts, and no text overlays, captions or watermarks beyond the corner logo already present"
      : "Realistic physics and motion blur. No text overlays, no captions, no watermarks, no scene cuts",
    opts.extraNotes?.trim(),
  ]);
}
