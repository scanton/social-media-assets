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
    label: "Digital Card",
    emoji: "📱",
    hint: "Your card animation playing on a device — straight to video",
    prompt: "",
  },
  {
    id: "print",
    kind: "print",
    label: "Printed Card",
    emoji: "💌",
    hint: "Your printed card artwork in a scene — straight to video",
    prompt: "",
  },
];

/* ---------------------------- DEVICES ---------------------------- */

export const DEVICES: (Option & {
  surface: SurfaceKind;
  defaultAspect?: string;
  /** This framing genuinely includes an envelope, so the prompt may mention one. */
  involvesEnvelope?: boolean;
  /**
   * Somebody's hand is on it. Turns on the hand-count rules — see handsClause.
   * A TV or a billboard cannot grow a third hand; a held phone can.
   */
  heldInHand?: boolean;
  /**
   * Small enough that the camera has to come to it.
   *
   * A phone screen is about 6 inches tall, so a shot framed at any sane
   * distance from a person makes it a postage stamp. Models default to
   * "portrait of somebody holding a phone" and the artwork — the entire point
   * of the picture — ends up unreadable at scrolling size. Marked devices get
   * much tighter framing targets; see framingClause.
   */
  pocketSized?: boolean;
})[] = [
  {
    id: "iphone-portrait",
    surface: "screen",
    label: "iPhone 16 Pro Max — portrait",
    emoji: "📱",
    defaultAspect: "9:16",
    heldInHand: true,
    pocketSized: true,
    prompt:
      "an iPhone 16 Pro Max held in portrait orientation, titanium frame, Dynamic Island visible at the top of the display, thin uniform bezels",
  },
  {
    id: "iphone-landscape",
    surface: "screen",
    label: "iPhone 16 Pro Max — landscape",
    emoji: "📱",
    defaultAspect: "16:9",
    heldInHand: true,
    pocketSized: true,
    /*
     * It used to say "with two hands", which is where a good part of the
     * third-hand problem came from: both hands are committed to the device, so
     * the moment a motion calls for a gesture the model grows another one. The
     * hold is one-handed now, stated by handsClause rather than here, so the
     * rule lives in one place across every device.
     */
    prompt:
      "an iPhone 16 Pro Max held sideways in landscape orientation, titanium frame, Dynamic Island on the left edge of the display, thin uniform bezels",
  },
  {
    id: "galaxy",
    surface: "screen",
    label: "Samsung Galaxy S26 Ultra",
    emoji: "📱",
    defaultAspect: "9:16",
    heldInHand: true,
    pocketSized: true,
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
    heldInHand: true,
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
    // No size in here on purpose — the physical dimensions are stated once, by
    // cardScaleClause, from the card size the user actually picked. This used
    // to say "A6", which is 4.1 × 5.8in and contradicted a 5 × 7in card.
    heldInHand: true,
    prompt:
      "a printed folded greeting card held upright in one hand, front panel facing the camera square-on, crisp paper edges, slight natural hand shadow",
  },
  {
    id: "card-table-standing",
    surface: "print",
    label: "Card standing on table",
    emoji: "🕯️",
    defaultAspect: "4:5",
    prompt:
      "a printed folded greeting card standing upright on a table, closed and leaning back against a small prop so it stays shut, front panel angled toward the camera, soft contact shadow on the surface",
  },
  {
    id: "card-flatlay",
    surface: "print",
    involvesEnvelope: true,
    label: "Card flat-lay with envelope",
    emoji: "✉️",
    defaultAspect: "1:1",
    prompt:
      "a printed greeting card lying flat on a surface next to its kraft envelope, shot from directly overhead, tasteful props arranged around it",
  },
  {
    id: "card-mailbox",
    surface: "print",
    involvesEnvelope: true,
    label: "Card at the mailbox",
    emoji: "📮",
    defaultAspect: "9:16",
    heldInHand: true,
    prompt:
      "a printed greeting card being pulled from a residential mailbox in its envelope, card front partially revealed",
  },
];

/* -------------------------- CARD SIZE ---------------------------- */

/**
 * The card's real-world dimensions.
 *
 * Image models have no inherent sense of how big a greeting card is, so left
 * unstated the same prompt yields anything from a postcard to a poster. Stating
 * the size in inches *and* giving it everyday objects to measure against is what
 * makes the scale hold.
 */
export type CardSize = {
  id: string;
  label: string;
  hint: string;
  emoji: string;
  /** Folded, front panel showing: [width, height] in inches. */
  closed: [number, number];
  /** Opened flat across both inside panels: [width, height] in inches. */
  open: [number, number];
};

export const CARD_SIZES: CardSize[] = [
  {
    id: "5x7",
    label: '5" × 7" folded',
    hint: '10" × 7" open — the HeartStamp standard',
    emoji: "💌",
    closed: [5, 7],
    open: [10, 7],
  },
  {
    id: "4x6",
    label: '4" × 6" folded',
    hint: '8" × 6" open',
    emoji: "✉️",
    closed: [4, 6],
    open: [8, 6],
  },
  {
    id: "square-5.5",
    label: '5.5" square folded',
    hint: '11" × 5.5" open',
    emoji: "🔲",
    closed: [5.5, 5.5],
    open: [11, 5.5],
  },
  {
    id: "a6",
    label: "A6 folded",
    hint: "105 × 148 mm closed",
    emoji: "📇",
    closed: [4.13, 5.83],
    open: [8.27, 5.83],
  },
  {
    id: "a5",
    label: "A5 folded",
    hint: "148 × 210 mm closed",
    emoji: "📄",
    closed: [5.83, 8.27],
    open: [11.69, 8.27],
  },
];

const inchesToMm = (n: number) => Math.round(n * 25.4);
const trimNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, ""));

/**
 * Everyday objects with sizes the model already knows, so it can triangulate
 * rather than take "5 inches" on faith. Naming what the card must *not* be
 * mistaken for is doing as much work here as the measurements.
 */
function cardScaleClause(sizeId: string, openInFrame: boolean): string {
  const size = CARD_SIZES.find((c) => c.id === sizeId) ?? CARD_SIZES[0];
  const [cw, ch] = size.closed;
  const [ow, oh] = size.open;
  const dims = (w: number, h: number) =>
    `${trimNum(w)} × ${trimNum(h)} inches (${inchesToMm(w)} × ${inchesToMm(h)} mm)`;

  return [
    "SCALE — the card is a real physical object and must be sized like one",
    `folded, with the front panel showing, it measures ${dims(cw, ch)}; opened flat across both inside panels it measures ${dims(ow, oh)}`,
    openInFrame
      ? `it is open in this shot, so judge it against the ${dims(ow, oh)} figure`
      : `it is folded in this shot, so judge it against the ${dims(cw, ch)} figure`,
    "size it against the things around it — an adult hand is about 7.5 inches from wrist to fingertip, a coffee mug about 3.7 inches tall, a smartphone about 6 inches tall, a dinner plate about 10.5 inches across, a paperback about 7 inches tall",
    "it must not read as a business card, a postcard, a sheet of A4 or a poster: check it against the hands, mugs, tables and books in frame and hold it at its true size",
  ].join(". ");
}

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
      "a full-length mirror selfie set-up in a bedroom, framed so the mirror shows the outfit from the chin down and no face is reflected, mirror slightly smudged, natural daylight from a window",
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
      "walking along the sidewalk of a busy city street, safely up on the kerb with storefronts close behind and traffic further off in the blurred background — never standing or walking in the road itself, sunlight bouncing off the paving",
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
      "walking down the pedestrian aisle between stalls at a farmers market on a bright morning, canvas tote of produce on the shoulder, stall awnings and crates of flowers and fruit crowding the background",
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
      "a candlelit self-care evening styled around the edge of a bath, bath tray with a candle and a glass, steam and warm low light, tiled wall softly out of focus; nobody is in the water and anyone in frame is fully dressed in a robe, sitting on the edge or on a stool beside it",
  },
  {
    id: "school-pickup",
    label: "School pickup line",
    emoji: "🎒",
    audience: ["millennial-mom"],
    prompt:
      "in the driver's seat of a car that is parked and completely stationary in the school pickup line, both hands free and away from the wheel, backpack on the passenger seat, windshield light, other cars queued blurry ahead",
  },
  {
    id: "soccer-sideline",
    label: "Sideline at practice",
    emoji: "⚽",
    audience: ["millennial-mom"],
    prompt:
      "on a folding chair at the sideline of a kids' sports practice, travel mug in hand, green field behind with distant players far downfield, small and heavily out of focus with no child's face discernible",
  },
  {
    id: "nursery",
    label: "Nursery / new baby",
    emoji: "🍼",
    audience: ["millennial-mom"],
    prompt:
      "in a soft pastel nursery, rocking chair and muslin blankets, mobile turning slowly, gentle daylight through sheer curtains; the room is empty of any baby or child, styled props only",
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
      "shot from a first-person point of view looking down at the device held in one of the subject's own hands, that forearm entering frame from the bottom",
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

/**
 * Concrete area targets read better than adjectives like "close" or "tight".
 *
 * `deviceId` is here for one reason: a phone is small. Six inches of screen
 * photographed at any distance that flatters a person is a postage stamp, and
 * the model's default reading of these scenes — a portrait of somebody holding
 * a phone — puts the artwork well below the size it has to be to survive a
 * scroll. Even "hero" came back too wide in practice. So a pocket-sized device
 * gets its own, much tighter, set of targets and is told outright that the
 * phone is the subject and the person is not.
 */
function framingClause(framingId: string, surface: SurfaceKind, deviceId?: string): string {
  const subject = surface === "print" ? "greeting card" : "device";
  const face = surface === "print" ? "printed front panel" : "screen";
  const tight = Boolean(deviceId && byId(DEVICES, deviceId)?.pocketSized);

  const spec: Record<string, { area: string; tail: string }> = tight
    ? {
        extreme: {
          area: "80-92%",
          tail:
            "This is a macro shot of the phone. Almost nothing else is in frame — the holding hand and a sliver of blurred surroundings at the very edges, nothing more",
        },
        hero: {
          area: "62-78%",
          tail:
            "Push right in on the phone. The camera is close enough that the phone and the hand holding it are essentially the whole picture, with the setting reduced to soft blurred colour behind them",
        },
        balanced: {
          area: "40-55%",
          tail:
            "The setting is readable around the phone but the phone still dominates the frame outright",
        },
        context: {
          area: "22-32%",
          tail:
            "The environment does the storytelling, but the phone is still large enough that the artwork on it is sharp and readable at a glance",
        },
      }
    : {
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
    ...(tight
      ? [
          "This is a photograph OF THE PHONE, not a portrait of a person who happens to be holding one — the camera is pushed right in on the device and the person is present only as the hand holding it and whatever the crop happens to include",
          "a phone screen is only about six inches tall, so the camera has to come to it: shoot it the way a product photographer would, close and deliberate, not from conversational distance",
        ]
      : []),
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

/* ----------------------- IMAGE RESOLUTION ------------------------ */

export type ImageResolutionId = "720p" | "1080p" | "1440p" | "4k";

/** Short edge of the render. The long edge follows from the orientation. */
export const IMAGE_RESOLUTIONS: (Option & { id: ImageResolutionId; shortEdge: number })[] = [
  { id: "720p", label: "720p", emoji: "\u26a1", hint: "Fastest and cheapest", prompt: "", shortEdge: 720 },
  { id: "1080p", label: "1080p", emoji: "\u2696\ufe0f", hint: "Balanced", prompt: "", shortEdge: 1080 },
  { id: "1440p", label: "1440p", emoji: "\ud83d\udd0d", hint: "Sharper detail", prompt: "", shortEdge: 1440 },
  { id: "4k", label: "4K", emoji: "\ud83d\udc8e", hint: "Slowest, most expensive", prompt: "", shortEdge: 2160 },
];

/*
 * GPT-Image-2 rejects sizes outside these bounds outright, and the floor is the
 * one that bites: a 720p square is 518k pixels, comfortably under it. So the
 * tier is a target rather than a promise, and the result is nudged into range.
 */
const MIN_IMAGE_PIXELS = 655_360;
const MAX_IMAGE_PIXELS = 8_294_400;
const MAX_IMAGE_EDGE = 3840;

/**
 * Concrete pixel dimensions for an orientation at a given tier.
 *
 * ASPECTS carries the ratio; the tier decides the scale. Rounding is always
 * upward to the next multiple of 16 (which the model also requires) so it can
 * only ever push away from the pixel floor, never back under it.
 */
export function imageSizeFor(
  aspectId: AspectId,
  tier: ImageResolutionId,
): { width: number; height: number } {
  const aspect = ASPECTS.find((a) => a.id === aspectId) ?? ASPECTS[0];
  const ratio = aspect.width / aspect.height;
  const shortEdge = IMAGE_RESOLUTIONS.find((r) => r.id === tier)?.shortEdge ?? 1080;

  let w = ratio >= 1 ? shortEdge * ratio : shortEdge;
  let h = ratio >= 1 ? shortEdge : shortEdge / ratio;

  const scale = (by: number) => {
    w *= by;
    h *= by;
  };
  if (w * h < MIN_IMAGE_PIXELS) scale(Math.sqrt(MIN_IMAGE_PIXELS / (w * h)));
  if (w * h > MAX_IMAGE_PIXELS) scale(Math.sqrt(MAX_IMAGE_PIXELS / (w * h)));
  const longest = Math.max(w, h);
  if (longest > MAX_IMAGE_EDGE) scale(MAX_IMAGE_EDGE / longest);

  const to16 = (n: number) => Math.min(MAX_IMAGE_EDGE, Math.ceil(n / 16) * 16);
  return { width: to16(w), height: to16(h) };
}

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
  { id: "hands", label: "Hands only", emoji: "🤲", prompt: "only hands and forearms are visible, tasteful manicure, no face and no head in frame" },
  {
    id: "one-partial",
    label: "One person, cropped",
    emoji: "🙋",
    prompt:
      "one person in frame but framed from the shoulders down, or cropped above the chin, so no face is visible",
  },
  {
    id: "one-back",
    label: "One person, from behind",
    emoji: "🧍",
    prompt:
      "one person seen from behind or over their shoulder, the back of their head and hair toward the camera, face turned away and never visible",
  },
  {
    id: "group",
    label: "Friend group",
    emoji: "👯",
    prompt:
      "a small group of friends together, seen from behind or cropped at the shoulders, leaning in around the card; heads turned away or out of frame so no faces are visible",
  },
];

/* -------------------------- ETHNICITY ---------------------------- */

/**
 * Who the people in the scene read as.
 *
 * The awkward constraint: no PRESENCE option ever shows a face, and printed
 * cards forbid faces outright. So none of this can lean on facial features — it
 * has to carry through the skin tone, hands, forearms, hair and shoulders that
 * are actually in frame, and each fragment is written to do that.
 *
 * Skin tones are given as ranges rather than single values. Any of these groups
 * spans a wide range in reality, and naming one point produces a caricature.
 */
export const ETHNICITIES: Option[] = [
  {
    id: "unspecified",
    label: "Any / unspecified",
    emoji: "🌍",
    hint: "Let the model decide",
    prompt: "",
  },
  {
    id: "diverse",
    label: "Mixed group",
    emoji: "🤝",
    hint: "Several ethnicities in one shot",
    prompt:
      "the people in frame are visibly a mix of ethnicities, with genuinely different skin tones and hair textures between them rather than one look repeated",
  },
  {
    id: "black",
    label: "Black / African",
    emoji: "🧑🏿",
    prompt:
      "the people in frame are Black, of African or African-diaspora descent, with skin tones from warm brown through to deep brown and natural coiled, curly, locd or braided hair",
  },
  {
    id: "east-asian",
    label: "East Asian",
    emoji: "🧑🏻",
    prompt:
      "the people in frame are East Asian, with fair to light-tan skin tones and straight dark hair",
  },
  {
    id: "south-asian",
    label: "South Asian",
    emoji: "🧑🏽",
    prompt:
      "the people in frame are South Asian, with light brown through to deep brown skin tones and thick dark hair, straight or wavy",
  },
  {
    id: "southeast-asian",
    label: "Southeast Asian",
    emoji: "🧑🏽",
    prompt:
      "the people in frame are Southeast Asian, with light tan through to warm brown skin tones and dark hair",
  },
  {
    id: "hispanic",
    label: "Hispanic / Latino",
    emoji: "🧑🏽",
    prompt:
      "the people in frame are Hispanic or Latino, with olive through to warm brown skin tones and dark hair, straight, wavy or curly",
  },
  {
    id: "middle-eastern",
    label: "Middle Eastern / North African",
    emoji: "🧑🏽",
    prompt:
      "the people in frame are Middle Eastern or North African, with olive through to warm brown skin tones and dark hair",
  },
  {
    id: "indigenous",
    label: "Indigenous American",
    emoji: "🧑🏽",
    prompt:
      "the people in frame are Indigenous American, with warm brown skin tones and straight dark hair",
  },
  {
    id: "pacific-islander",
    label: "Pacific Islander",
    emoji: "🧑🏾",
    prompt:
      "the people in frame are Pacific Islander, with warm brown through to deep brown skin tones and thick dark hair",
  },
  {
    id: "white",
    label: "White / European",
    emoji: "🧑🏼",
    prompt:
      "the people in frame are White, of European descent, with fair through to light olive skin tones",
  },
  {
    id: "mixed-heritage",
    label: "Mixed heritage",
    emoji: "🧑🏽",
    prompt:
      "the people in frame are of mixed heritage, with medium brown skin tones and hair that is neither straight nor tightly coiled",
  },
];

/* ------------------------ GENDER AND AGE ------------------------- */

export type SubjectGenderId = "unspecified" | "female" | "male";
export type SubjectAgeId = "adult" | "teen" | "child";

export const SUBJECT_GENDERS: (Option & { id: SubjectGenderId })[] = [
  { id: "unspecified", label: "Any", emoji: "✴️", hint: "Let the model decide", prompt: "" },
  {
    id: "female",
    label: "Female",
    emoji: "👩",
    prompt:
      "the primary subject is female, reading as such through the shape of the hands and wrists, the wardrobe, the jewellery and the styling rather than through any facial feature",
  },
  {
    id: "male",
    label: "Male",
    emoji: "👨",
    prompt:
      "the primary subject is male, with visibly larger hands, broader wrists and forearms, and menswear styling and grooming",
  },
];

export const SUBJECT_AGES: (Option & { id: SubjectAgeId })[] = [
  { id: "adult", label: "Adult", emoji: "🧑", prompt: "" },
  {
    id: "teen",
    label: "Teen",
    emoji: "🎒",
    prompt:
      "the subject is a teenager — slighter hands and wrists than an adult's, dressed in ordinary age-appropriate everyday clothing",
  },
  {
    id: "child",
    label: "Child",
    emoji: "🧸",
    /*
     * Written defensively on purpose. This is a greeting-card product, so a
     * child holding a card is an ordinary shot to want — but "child" plus a
     * scene list that includes a bathroom and a bedroom is exactly the
     * combination worth being explicit about rather than leaving to chance.
     */
    prompt:
      "the subject is a young child — small hands and short arms, at a child's height relative to the furniture around them. The child is fully and modestly dressed in ordinary everyday clothing throughout: no swimwear, no underwear, no bath, bed or bathroom setting, and nothing suggestive in the framing or posing. This is a wholesome family greeting-card photograph",
  },
];

/* ------------------------ STYLING DETAILS ------------------------ */

export type DetailOption = Option & {
  /** Subject genders this suits. Omitted means all of them. */
  gender?: SubjectGenderId[];
  /** Subject ages this suits. Omitted means all of them. */
  age?: SubjectAgeId[];
};

export type DetailCategory = {
  id: string;
  label: string;
  emoji: string;
  hint?: string;
  options: DetailOption[];
};

/**
 * The small stuff that makes a scene look art-directed rather than generated.
 *
 * Everything here is deliberately on the hands, wrists and forearms, because
 * that is the part of a person these shots actually show — a necklace is wasted
 * on a frame cropped at the shoulders, but a manicure is right in the middle of
 * it, next to the card.
 *
 * Options carry `gender` and `age` filters so the picker can't offer a French
 * manicure to a man or a tattoo sleeve to a five-year-old. Every category leads
 * with an "unspecified" entry that emits nothing.
 */
export const DETAIL_CATEGORIES: DetailCategory[] = [
  {
    id: "nails",
    label: "Nails",
    emoji: "💅",
    hint: "Right beside the card in almost every shot.",
    options: [
      { id: "unspecified", label: "Any", prompt: "" },
      {
        id: "bare",
        label: "Short and bare",
        prompt: "short, neat, unpainted nails with a natural finish",
      },
      {
        id: "french",
        label: "French tips",
        gender: ["unspecified", "female"],
        age: ["adult", "teen"],
        prompt: "a classic French manicure — clean bright white tips over a soft pink bed",
      },
      {
        id: "glitter",
        label: "Glitter",
        gender: ["unspecified", "female"],
        age: ["adult", "teen"],
        prompt: "glitter nail polish that catches the light, with visible sparkle in the highlights",
      },
      {
        id: "chrome",
        label: "Chrome / glazed",
        gender: ["unspecified", "female"],
        age: ["adult", "teen"],
        prompt: "chrome glazed-doughnut nails with a pearlescent mirror finish",
      },
      {
        id: "red",
        label: "Glossy red",
        gender: ["unspecified", "female"],
        age: ["adult", "teen"],
        prompt: "glossy cherry-red nails with a wet-looking high-shine finish",
      },
      {
        id: "almond-nude",
        label: "Long almond nude",
        gender: ["unspecified", "female"],
        age: ["adult", "teen"],
        prompt: "long almond-shaped nails in a warm nude tone",
      },
      {
        id: "airbrush",
        label: "Airbrushed art",
        gender: ["unspecified", "female"],
        age: ["adult", "teen"],
        prompt:
          "airbrushed nail art with a soft colour gradient and fine hand-painted detail on a couple of accent nails",
      },
      {
        id: "dark",
        label: "Dark polish",
        age: ["adult", "teen"],
        prompt: "short nails in a deep near-black polish",
      },
    ],
  },
  {
    id: "tattoos",
    label: "Tattoos",
    emoji: "🏴",
    hint: "On the forearms and hands, where the frame can see them.",
    options: [
      { id: "unspecified", label: "Any", prompt: "" },
      { id: "none", label: "None", prompt: "no tattoos on any visible skin" },
      {
        id: "fine-line",
        label: "Fine-line",
        age: ["adult", "teen"],
        prompt: "delicate fine-line tattoos in thin black linework on the forearm and the back of the hand",
      },
      {
        id: "floral",
        label: "Botanical",
        age: ["adult", "teen"],
        prompt: "botanical floral tattoo work trailing up the forearm",
      },
      {
        id: "traditional",
        label: "American traditional",
        age: ["adult"],
        prompt: "bold American-traditional tattoos with heavy black outlines and a limited red-and-green palette",
      },
      {
        id: "blackwork",
        label: "Blackwork / geometric",
        age: ["adult"],
        prompt: "blackwork geometric tattoos in solid black with sharp negative space",
      },
      {
        id: "script",
        label: "Script lettering",
        age: ["adult"],
        prompt: "a small script lettering tattoo on the inner forearm",
      },
      {
        id: "sleeve",
        label: "Full sleeve",
        age: ["adult"],
        prompt: "a dense full tattoo sleeve running the length of the forearm",
      },
    ],
  },
  {
    id: "wrist",
    label: "Wrist",
    emoji: "⌚",
    options: [
      { id: "unspecified", label: "Any", prompt: "" },
      { id: "none", label: "Bare wrist", prompt: "bare wrists with nothing worn on them" },
      {
        id: "beaded",
        label: "Beaded friendship stack",
        prompt: "a stack of colourful beaded friendship bracelets",
      },
      {
        id: "gold-chain",
        label: "Fine gold chain",
        gender: ["unspecified", "female"],
        prompt: "a fine gold chain bracelet",
      },
      {
        id: "charm",
        label: "Charm bracelet",
        gender: ["unspecified", "female"],
        prompt: "a charm bracelet with small dangling charms",
      },
      {
        id: "tennis",
        label: "Tennis bracelet",
        gender: ["unspecified", "female"],
        age: ["adult"],
        prompt: "a slim diamond tennis bracelet",
      },
      {
        id: "cuff",
        label: "Metal cuff",
        prompt: "a chunky brushed-metal cuff",
      },
      {
        id: "watch-leather",
        label: "Leather watch",
        age: ["adult", "teen"],
        prompt: "a leather-strap wristwatch",
      },
      {
        id: "watch-smart",
        label: "Smartwatch",
        prompt: "a smartwatch on a woven sport band",
      },
      {
        id: "scrunchie",
        label: "Scrunchie",
        gender: ["unspecified", "female"],
        prompt: "a fabric scrunchie worn around the wrist",
      },
      {
        id: "friendship-thread",
        label: "Woven thread",
        age: ["teen", "child"],
        prompt: "a hand-woven embroidery-thread friendship bracelet",
      },
    ],
  },
  {
    id: "rings",
    label: "Rings",
    emoji: "💍",
    options: [
      { id: "unspecified", label: "Any", prompt: "" },
      { id: "none", label: "No rings", age: ["adult", "teen", "child"], prompt: "no rings on any finger" },
      {
        id: "stacked",
        label: "Stacked delicate",
        gender: ["unspecified", "female"],
        age: ["adult", "teen"],
        prompt: "several delicate stacked rings across two or three fingers",
      },
      {
        id: "statement",
        label: "Statement ring",
        age: ["adult", "teen"],
        prompt: "one bold statement ring with a large stone",
      },
      {
        id: "signet",
        label: "Signet ring",
        age: ["adult"],
        prompt: "a heavy signet ring on the little finger",
      },
      {
        id: "band",
        label: "Wedding band",
        age: ["adult"],
        prompt: "a plain metal wedding band",
      },
    ],
  },
  {
    id: "extras",
    label: "Other accessories",
    emoji: "🧣",
    hint: "Anything else that dresses the frame.",
    options: [
      { id: "unspecified", label: "Any", prompt: "" },
      {
        id: "layered-necklaces",
        label: "Layered necklaces",
        gender: ["unspecified", "female"],
        age: ["adult", "teen"],
        prompt: "layered fine gold necklaces at the collarbone",
      },
      {
        id: "hoops",
        label: "Gold hoops",
        gender: ["unspecified", "female"],
        age: ["adult", "teen"],
        prompt: "gold hoop earrings",
      },
      {
        id: "cap",
        label: "Baseball cap",
        prompt: "a baseball cap worn low",
      },
      {
        id: "sunglasses",
        label: "Sunglasses up top",
        age: ["adult", "teen"],
        prompt: "sunglasses pushed up on top of the head",
      },
      {
        id: "scarf",
        label: "Knit scarf",
        prompt: "a chunky knit scarf looped at the neck",
      },
      {
        id: "tote",
        label: "Canvas tote",
        age: ["adult", "teen"],
        prompt: "a canvas tote bag over the shoulder",
      },
      {
        id: "cardigan",
        label: "Oversized cardigan",
        prompt: "an oversized knit cardigan with the sleeves pushed up the forearms",
      },
      {
        id: "friendship-pins",
        label: "Enamel pins",
        age: ["teen", "child"],
        prompt: "a scatter of enamel pins on a denim jacket or bag strap",
      },
    ],
  },
];

const fitsSubject = (o: DetailOption, gender: SubjectGenderId, age: SubjectAgeId) =>
  (!o.gender || o.gender.includes(gender)) && (!o.age || o.age.includes(age));

/** The options a category can offer for this subject. Never returns an empty list. */
export function detailOptionsFor(
  category: DetailCategory,
  gender: SubjectGenderId,
  age: SubjectAgeId,
): DetailOption[] {
  return category.options.filter((o) => o.id === "unspecified" || fitsSubject(o, gender, age));
}

/**
 * The stored pick for a category, or "unspecified" when it no longer fits.
 *
 * Gender and age can change after a detail was chosen, so a stored id has to be
 * re-checked rather than trusted — otherwise switching the subject to a child
 * would quietly keep a tattoo sleeve on them.
 */
export function resolveDetail(
  category: DetailCategory,
  details: Record<string, string> | undefined,
  gender: SubjectGenderId,
  age: SubjectAgeId,
): string {
  const stored = details?.[category.id];
  if (!stored) return "unspecified";
  const option = category.options.find((o) => o.id === stored);
  if (!option || !fitsSubject(option, gender, age)) return "unspecified";
  return option.id;
}

/* ----------------------- HANDWRITING ----------------------------- */

/**
 * Handwriting styles for a message written inside a printed card.
 *
 * These are prompt descriptions, not fonts. GPT-Image-2 renders legible,
 * correctly-spelled text, so the message is generated as part of the image
 * rather than drawn on a canvas and pasted on — which keeps the ink sitting on
 * the stock with the paper's own texture, lighting and slight imperfection
 * instead of looking like a flat overlay.
 *
 * Each `prompt` describes how the hand *moves*, not just how it looks: pressure,
 * slant, letter spacing and consistency are what separate a convincing hand from
 * a font pretending to be one.
 */
export type HandwritingStyle = Option & {
  /** Who the hand reads as, for grouping the picker. */
  gender: "any" | "feminine" | "masculine";
};

export const HANDWRITING_STYLES: HandwritingStyle[] = [
  {
    id: "neat",
    label: "Neat everyday",
    hint: "Tidy, legible, unfussy",
    emoji: "🖊️",
    gender: "any",
    prompt:
      "neat, tidy everyday handwriting with consistent letter height and even spacing, upright to very slightly slanted, written at a comfortable unhurried pace",
  },
  {
    id: "chicken-scratch",
    label: "Chicken scratch",
    hint: "Hurried, cramped, barely legible",
    emoji: "🐔",
    gender: "any",
    prompt:
      "hurried chicken-scratch handwriting — cramped, spiky, uneven letter heights, inconsistent spacing and letters that trail off at the end of words, clearly written in a rush, but still readable",
  },
  {
    id: "scrawl",
    label: "Messy scrawl",
    hint: "Heavy, jagged, pressed hard",
    emoji: "✍️",
    gender: "masculine",
    prompt:
      "a heavy messy scrawl pressed hard into the paper, jagged angular strokes, letters varying in size and baseline wandering noticeably, mostly disconnected letters",
  },
  {
    id: "marker",
    label: "Bold marker",
    hint: "Thick felt-tip strokes",
    emoji: "🖍️",
    gender: "masculine",
    prompt:
      "bold confident handwriting in thick felt-tip marker, chunky strokes of even weight with blunt stroke ends, generously sized letters",
  },
  {
    id: "architect",
    label: "Architect's block",
    hint: "Even, drafted capitals",
    emoji: "📐",
    gender: "any",
    prompt:
      "precise architect's hand-lettering in neat block capitals, remarkably even letter heights and spacing, drafted and deliberate, thin consistent stroke weight",
  },
  {
    id: "girly",
    label: "Girly script",
    hint: "Round, looping, bouncy",
    emoji: "🎀",
    gender: "feminine",
    prompt:
      "round bubbly feminine handwriting with wide generous loops, a bouncy baseline, slight forward lean and little circles used to dot the letter i",
  },
  {
    id: "breezy",
    label: "Breezy print",
    hint: "Light, airy, upright",
    emoji: "🌤️",
    gender: "feminine",
    prompt:
      "light airy printed handwriting, upright and unjoined, delicate thin strokes with generous space between letters and words",
  },
  {
    id: "elegant",
    label: "Elegant calligraphy",
    hint: "Formal copperplate",
    emoji: "🕊️",
    gender: "feminine",
    prompt:
      "elegant formal copperplate calligraphy with a pronounced slant, flowing joined letters, and clear thick-and-thin stroke contrast between downstrokes and upstrokes",
  },
  {
    id: "classic",
    label: "Classic cursive",
    hint: "Old-fashioned joined hand",
    emoji: "📜",
    gender: "any",
    prompt:
      "old-fashioned joined cursive of the kind taught in school decades ago, every letter connected, steady rhythm and a gentle consistent slant",
  },
  {
    id: "playful",
    label: "Playful",
    hint: "Bubbly and childlike",
    emoji: "🧸",
    gender: "any",
    prompt:
      "playful childlike handwriting, oversized rounded letters, wobbly baseline, cheerfully inconsistent sizing as though written quickly and happily",
  },
];

export const INK_COLOURS: Option[] = [
  { id: "blue", label: "Ballpoint blue", emoji: "🔵", prompt: "ordinary blue ballpoint pen ink" },
  { id: "black", label: "Black ink", emoji: "⚫", prompt: "black ink from a fine liner pen" },
  { id: "graphite", label: "Pencil", emoji: "✏️", prompt: "soft grey graphite pencil" },
  { id: "red", label: "Red ink", emoji: "🔴", prompt: "red ballpoint pen ink" },
  { id: "gold", label: "Gold pen", emoji: "🟡", prompt: "metallic gold gel pen that catches the light" },
];

/** Where on the open spread the message is written. */
export const MESSAGE_PLACEMENTS: Option[] = [
  {
    id: "lower-right",
    label: "Lower right",
    hint: "Where a card is normally signed",
    emoji: "↘️",
    prompt:
      "in the open, unprinted area on the LOWER RIGHT of the open card — the lower half of the right-hand inside panel",
  },
  {
    id: "right",
    label: "Right page",
    emoji: "➡️",
    prompt: "filling the open, unprinted area of the right-hand inside panel",
  },
  {
    id: "left",
    label: "Left page",
    emoji: "⬅️",
    prompt: "filling the open, unprinted area of the left-hand inside panel",
  },
  {
    id: "spread",
    label: "Across both pages",
    emoji: "↔️",
    prompt:
      "spread across both inside panels, flowing over the centre fold without any words being lost in the crease",
  },
];

export type InsideMessageSelection = {
  message: string;
  signature: string;
  styleId: string;
  inkId: string;
  placementId: string;
  /** False when there is no uploaded spread and the interior is made from scratch. */
  hasSpread: boolean;
  cardSizeId?: string;
  extraNotes?: string;
};

/**
 * Compiles the prompt that writes a message inside the card.
 *
 * Three things carry the whole result, and each is stated in its own paragraph
 * rather than buried in a list:
 *
 *   1. The exact words. Quoted verbatim, one line per block, with an explicit
 *      instruction not to correct, rephrase or re-punctuate them. Left loose,
 *      models paraphrase — and a paraphrased signature is worse than no message.
 *   2. That it is handwriting, not type. Named as pen-on-paper and described by
 *      how the hand moves, because "handwritten font" is what produces the
 *      even, mechanical lettering that gives the game away.
 *   3. Where it goes, and what must not be touched. The artwork already printed
 *      on the spread has to survive untouched, which is the same guarantee the
 *      card-artwork rules make everywhere else in this file.
 */
export function buildInsideMessagePrompt(sel: InsideMessageSelection): string {
  const style = byId(HANDWRITING_STYLES, sel.styleId) ?? HANDWRITING_STYLES[0];
  const ink = byId(INK_COLOURS, sel.inkId) ?? INK_COLOURS[0];
  const placement = byId(MESSAGE_PLACEMENTS, sel.placementId) ?? MESSAGE_PLACEMENTS[0];
  const card = CARD_SIZES.find((c) => c.id === sel.cardSizeId) ?? CARD_SIZES[0];

  const quoted = (label: string, text: string) =>
    text.trim() ? `${label}: "${text.trim().replace(/\s*\n\s*/g, " / ")}"` : undefined;

  const lines = [
    quoted("MESSAGE", sel.message),
    quoted("SIGN-OFF", sel.signature),
  ].filter(Boolean) as string[];

  return joinPrompts([
    sel.hasSpread
      ? "The supplied image is the printed inside spread of a folded greeting card, lying open and flat, photographed square-on"
      : `A folded greeting card lying open and flat, photographed square-on, showing both blank inside panels of a ${card.open[0]} × ${card.open[1]} inch open spread on warm off-white card stock with a soft centre crease`,

    "TASK: write a personal handwritten message onto this open card. Change nothing else about the image",

    // 1. The words, verbatim.
    `Write exactly these words, spelled and punctuated exactly as given, on separate lines in this order — ${lines.join(" | ")}`,
    "Reproduce that text character for character. Do not correct it, rephrase it, translate it, abbreviate it, re-punctuate it, add words of your own or leave any word out. Every letter must be clearly legible and correctly spelled",
    "A forward slash in the text above marks a line break, not a character to draw",

    // 2. Handwriting, not type.
    `CRITICAL: this must read as genuine handwriting put on the paper by a human hand with a pen — not as a typeface, not as a "handwriting font", and not as digital text pasted onto the photograph`,
    `The hand is ${style.prompt}`,
    `It is written in ${ink.prompt}, with the natural variation of real pen on paper: stroke weight that thickens and thins with pressure, tiny wobbles in the line, letters that are never twice identical, and a baseline that drifts very slightly rather than sitting perfectly level`,
    "The ink sits into the paper's surface and takes the same lighting, focus and grain as the rest of the photograph",

    // 3. Placement, and what must survive.
    `Place the writing ${placement.prompt}`,
    "Keep it inside the card's edges with a comfortable margin, and never let it run over the centre fold in a way that hides a word",
    "Size the writing so the whole message fits comfortably in that area without crowding, shrinking to a cramped block, or running off the card",
    sel.hasSpread
      ? "ABSOLUTE RULE — everything already printed on this spread stays exactly as it is: same artwork, same colours, same typography, same layout, same position. Do not redraw, recolour, restyle, move, crop, re-typeset or cover any of it. The handwritten message is the only thing added to the image, and it goes in empty space that is already free of artwork"
      : "Both inside panels are otherwise completely blank — no printed artwork, no borders, no decorative elements, no lines or grid",

    "No watermarks, no captions, no logos, and no text anywhere in the image other than what is specified above",
    sel.extraNotes?.trim(),
  ]);
}


/* ------------------------ THE PEOPLE CLAUSE ---------------------- */

export type SubjectSelection = {
  presenceId: string;
  ethnicityId?: string;
  genderId?: SubjectGenderId;
  ageId?: SubjectAgeId;
  details?: Record<string, string>;
};

/**
 * Everything about the people in the shot, as one block.
 *
 * Emits nothing when the shot has no people in it — describing the manicure of
 * an empty room is how a prompt talks itself into inventing someone to wear it.
 */
function subjectClause(sel: SubjectSelection): string | undefined {
  if (sel.presenceId === "none") return undefined;

  const gender = sel.genderId ?? "unspecified";
  const age = sel.ageId ?? "adult";

  const ethnicity = byId(ETHNICITIES, sel.ethnicityId ?? "");
  const hasEthnicity = Boolean(ethnicity?.prompt);

  const details = DETAIL_CATEGORIES.map((category) => {
    const id = resolveDetail(category, sel.details, gender, age);
    return category.options.find((o) => o.id === id)?.prompt;
  }).filter((p): p is string => Boolean(p));

  const parts = [
    byId(SUBJECT_GENDERS, gender)?.prompt,
    byId(SUBJECT_AGES, age)?.prompt,
    ethnicity?.prompt,
    ...details,
  ].filter((p): p is string => Boolean(p && p.trim()));

  if (!parts.length) return undefined;

  return joinPrompts([
    ...parts,
    // Without this the model reaches for a face to carry the description, and
    // every PRESENCE option has already ruled that out.
    "no face is shown in this shot, so all of this has to read through the hands, wrists, forearms, shoulders, wardrobe and any visible hair",
    hasEthnicity
      ? ethnicity!.id === "diverse"
        ? "keep the difference between the people obvious at a glance"
        : "keep it consistent for every person in the shot"
      : undefined,
  ]);
}

/** Catch-all for the class of error the city-street scene exposed. */
const PLAUSIBLE_PLACEMENT_CLAUSE =
  "Everyone and everything sits where it plausibly and safely would in that setting — people on footpaths rather than in traffic, seated where there is seating, standing where there is room to stand";

/* --------------------------- FACES ------------------------------- */

/**
 * Printed-card scenes keep faces out of frame entirely.
 *
 * Generated faces animate badly — that was the original reason for trying a
 * one-shot printed flow at all — but bodies, hands and shoulders sell the scene
 * just fine, and cropping them out is cheaper than losing the people.
 */
/* --------------------------- HANDS -------------------------------- */

/**
 * How many hands the people in this shot are allowed to have.
 *
 * The failure it exists to stop: a subject holds the card or the phone in two
 * hands, then the motion asks them to react, and the reaction needs a hand — so
 * the model grows a third one rather than letting go. It turns up most often on
 * the "React to it" motions, because those are the ones that call for a gesture
 * while something is already being held, but it is not limited to them.
 *
 * Two rules, and the first is the load-bearing one. The anatomy is stated
 * outright, because a model will happily draw an extra arm without ever having
 * been told it cannot. Then the hold is pinned to ONE hand, which is what
 * leaves a hand free for the gesture and removes the model's reason to invent
 * one. Motions that genuinely need both hands — opening a folded card, working
 * an envelope — say so and get the second wording instead, because ordering a
 * one-handed hold there would contradict the action and the contradiction is
 * resolved with, again, an extra arm.
 *
 * Scoped to the person holding rather than to the frame at large: several
 * scenes legitimately have other people's hands at the edges — the brunch table
 * has "friends' hands and cutlery moving at the edges of frame" — and banning
 * hands outright would fight those.
 */
function handsClause(noun: string, mode: "one" | "both" = "one"): string {
  return [
    "HANDS AND ARMS — every person in this shot has exactly two hands and two arms and never more",
    `the person holding the ${noun} never grows a third: no extra arm, no spare hand steadying it while both of theirs are busy elsewhere, no second pair of hands, and no unattached hand reaching in to take the weight`,
    mode === "both"
      ? `both of that person's hands may work the ${noun} while it is being opened or handled, but they are those same two hands throughout — when one comes away to gesture, the other keeps hold of it and the ${noun} stays supported`
      : `they hold the ${noun} in ONE hand and keep it in that same hand for the whole shot; their other hand is the only free one, and every gesture — a hand to the mouth, covering a laugh, waving, reaching, touching their chest, pushing back their hair — is made with that one free hand and with no other`,
    `the ${noun} is never held by a hand that belongs to nobody, and never floats unsupported`,
    "count the hands before you finish: if the number of hands in frame is more than two per person, the shot is wrong",
  ].join(". ");
}

const NO_FACES_CLAUSE = [
  "CRITICAL: no human face is visible anywhere in this frame",
  "people may appear, but only as hands, arms, shoulders, a lap, the back of a head, or a figure turned away or cropped above the chin",
  "no eyes, nose or mouth are ever in shot, no face is reflected in any surface, and no photograph or poster in the background shows a face",
].join(". ");

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
  /** Who the people in the scene read as — see ETHNICITIES. */
  ethnicityId?: string;
  genderId?: SubjectGenderId;
  ageId?: SubjectAgeId;
  /** Category id → option id, from DETAIL_CATEGORIES. */
  details?: Record<string, string>;
  audienceId: string;
  framingId: string;
  aspect: AspectId;
  /** True when card artwork is supplied as a reference image. */
  hasCard: boolean;
  /**
   * True when the user supplied their own location photograph. It replaces
   * every scene control, so most of this selection goes unused.
   */
  hasBackground?: boolean;
  /** Which CARD_SIZES entry the card is, so the render can be scaled to it. */
  cardSizeId?: string;
  /**
   * Ordered description of every reference image being sent, matching the
   * `image_urls` array exactly. The prompt names them by position, so these two
   * must be built from one list or the model is told the wrong thing.
   */
  references?: string[];
  extraNotes?: string;
};

const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth"];

/**
 * Tells the model what each reference image is, by position.
 *
 * GPT-Image-2's edit endpoint accepts up to 16 images but gives them no names,
 * so position is the only handle the prompt has on them.
 */
function referenceKeyClause(refs: string[]): string | undefined {
  if (refs.length < 2) return undefined;
  const listed = refs
    .map((r, i) => `the ${ORDINALS[i] ?? `image ${i + 1}`} is ${r}`)
    .join(", ");
  return `${refs.length} reference images are supplied, in this order: ${listed}`;
}

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
      // Named rather than "the supplied reference image": a user-supplied
      // background makes that phrase ambiguous between two images.
      "CRITICAL REQUIREMENT: the artwork in the supplied card-artwork reference image is printed on the front panel of the greeting card in the scene",
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

/**
 * A supplied location photograph replaces the whole scene taxonomy, so the job
 * stops being "imagine a setting" and becomes "composite into this one".
 *
 * Framing still has to be stated even though the control is locked: the photo
 * fixes where the camera is, but nothing in it says how big the card should be,
 * and left unsaid the card comes back as a detail in the corner.
 */
function backgroundSceneClause(surface: SurfaceKind): string {
  const subject = surface === "print" ? "printed greeting card" : "device";
  const payload = surface === "print" ? "its printed artwork is" : "what is playing on its screen is";
  return [
    "CRITICAL REQUIREMENT: the supplied location photograph is the scene, and it is already finished",
    "keep it exactly as it is — same framing, same crop, same camera position and perspective, same lighting direction and colour, same depth of field, same surfaces, props and people",
    `do not re-stage it, re-light it, re-shoot it from another angle, extend its edges, or add or remove anything from it beyond the ${subject} itself`,
    `place the ${subject} into that photograph as a real physical object, resting on, standing on or held against something that is genuinely there`,
    "match its scale, perspective and contact shadows to the surfaces already in the photograph, and let the photograph's own light fall across it, so it reads as having been there when the shutter fired",
    `the ${subject} picks up that photograph's grain, white balance, exposure and depth of field`,
    `the ${subject} is still the subject: place it near the centre of frame and large enough that ${payload} sharp and legible at a glance while someone is scrolling, while staying a physically plausible size for the surfaces and distances in the photograph`,
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

  const bg = Boolean(sel.hasBackground);

  const subjectLine = bg
    ? "A photorealistic lifestyle photograph: one printed greeting card composited into the supplied location photograph"
    : sel.surface === "print"
      ? `A photorealistic lifestyle photograph of ${device?.prompt ?? "a printed greeting card"}`
      : `A photorealistic lifestyle photograph of ${device?.prompt ?? "a smartphone"}`;

  const refs = sel.references ?? [];

  return joinPrompts([
    // With more than one reference in play, saying which is which comes first —
    // otherwise the card-artwork rules below have no unambiguous referent.
    referenceKeyClause(refs) ??
      (bg && refs.length === 1 ? `One reference image is supplied: ${refs[0]}` : undefined),
    subjectLine,
    bg ? backgroundSceneClause(sel.surface) : undefined,
    /*
     * Everything the background photograph already decides. Emitting these
     * alongside it would ask the model to re-shoot the photo it was told to
     * preserve, which is the one instruction that has to survive intact.
     */
    bg ? undefined : scene?.prompt,
    bg ? undefined : presence?.prompt,
    bg
      ? undefined
      : subjectClause({
          presenceId: sel.presenceId,
          ethnicityId: sel.ethnicityId,
          genderId: sel.genderId,
          ageId: sel.ageId,
          details: sel.details,
        }),
    bg ? undefined : angle?.prompt,
    bg ? undefined : framingClause(sel.framingId, sel.surface, sel.deviceId),
    /*
     * Only when somebody is actually holding it. A card standing on a table or
     * a billboard by a road has no hands to miscount, and the rule would be
     * noise there.
     */
    device?.heldInHand && sel.presenceId !== "none"
      ? handsClause(sel.surface === "print" ? "greeting card" : "device")
      : undefined,
    bg ? undefined : light?.prompt,
    bg ? undefined : look?.prompt,
    bg || !audience
      ? undefined
      : `the styling, wardrobe and props should read as authentically ${audience.prompt}`,
    aspect ? `composed for a ${aspect.id} ${aspect.label.split(" ")[1].toLowerCase()} social crop` : undefined,
    sel.hasCard ? cardOnSurfaceClause(sel.surface) : blankSurfaceClause(sel.surface),
    // Scenes here always show the card folded, front panel out.
    sel.surface === "print" ? cardScaleClause(sel.cardSizeId ?? CARD_SIZES[0].id, false) : undefined,
    // The still is always of a shut card; step 3 is what opens it.
    sel.surface === "print" ? CARD_CLOSED_CLAUSE : undefined,
    sel.surface === "print" ? FLAT_CARD_CLAUSE : undefined,
    // Carried over from the one-shot experiments: artwork depicting an envelope
    // was being built as a real envelope holding the card.
    sel.surface === "print" ? PRINT_CONTAINMENT_CLAUSE : undefined,
    /*
     * Both of these describe what may exist in the frame, so a supplied
     * photograph overrules them — it may well contain faces or an envelope, and
     * ordering the model to remove them contradicts leaving it untouched.
     */
    !bg && sel.surface === "print" && !byId(DEVICES, sel.deviceId)?.involvesEnvelope
      ? NO_ENVELOPE_CLAUSE
      : undefined,
    !bg && sel.surface === "print" ? NO_FACES_CLAUSE : undefined,
    bg ? undefined : PLAUSIBLE_PLACEMENT_CLAUSE,
    "Photorealistic, sharp, high dynamic range, believable real-world materials and physics",
    // The HeartStamp mark is composited on afterwards in the browser, so the
    // model must not try to draw one of its own.
    bg
      ? "Add no watermarks, captions, brand logos or text of your own — the only text in the image is whatever the supplied references already contain"
      : sel.hasCard
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
export const MOTIONS: (Option & {
  /** Restricts the motion to one surface. Omitted = fine on both. */
  surface?: SurfaceKind;
  kind: MotionKind;
  /** Only offered once an inside-spread image exists to reveal. */
  requiresInside?: boolean;
  /** This motion genuinely handles an envelope, so the prompt may mention one. */
  involvesEnvelope?: boolean;
  /**
   * How many hands this motion legitimately needs on the object.
   *
   * Left unset it is ONE, which is the default because it is the hold that
   * leaves a hand free to gesture with. Opening a folded card or an envelope
   * genuinely takes both, so those say so — otherwise the one-handed rule and
   * the motion contradict each other and the model resolves it by growing an
   * extra arm, which is the exact bug this is here to stop.
   */
  hands?: "none" | "both";
})[] = [
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
    surface: "screen",
    label: "Lift toward camera",
    emoji: "🙌",
    prompt: "the subject lifts the device up toward the camera, presenting the screen proudly to the viewer",
  },

  /* ------------------------------ action ----------------------------- */
  {
    id: "open-and-react",
    kind: "action",
    label: "React to it",
    emoji: "🥹",
    prompt:
      "the subject looks down at the card and reacts in real time — eyebrows lift, a grin spreads, their free hand comes up to their mouth while the holding hand stays exactly where it is, they let out a small laugh and shake their head. Shoulders and chest move with the breath and the laugh. Genuine, unforced, caught-in-the-moment energy",
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
    surface: "screen",
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
    surface: "screen",
    label: "Prop it up & watch",
    emoji: "🪑",
    prompt:
      "the subject props the device up against something on the table, lets go, sits back and folds their arms to watch it from a comfortable distance, sipping their drink. Hands leave the device entirely",
  },
  {
    id: "double-take",
    kind: "action",
    surface: "screen",
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

  /* ------------------ print · card stays closed ---------------------- */
  {
    id: "card-zoom",
    hands: "none",
    kind: "camera",
    surface: "print",
    label: "Stationary card zoom",
    emoji: "🔎",
    prompt:
      "the greeting card stays completely stationary while the camera slowly pushes in on its front panel, no hands entering frame",
  },
  {
    id: "card-turn",
    hands: "both",
    kind: "action",
    surface: "print",
    label: "Tilt & catch the light",
    emoji: "✨",
    prompt:
      "hands tilt the card slowly back and forth so the light rakes across the printed front and any foil or texture catches it, the card never leaving frame",
  },
  {
    id: "stand-it-up",
    hands: "both",
    kind: "action",
    surface: "print",
    label: "Stand it up",
    emoji: "🕯️",
    prompt:
      "hands stand the folded card upright on the surface like a tent, adjust it square to the camera and let go; the card settles and the hands withdraw from frame",
  },
  {
    id: "envelope-reveal",
    hands: "both",
    kind: "action",
    surface: "print",
    involvesEnvelope: true,
    label: "Envelope reveal",
    emoji: "✉️",
    prompt:
      "hands tear open the envelope, slide the greeting card out and turn its printed front to face the camera, paper and flap moving with believable stiffness",
  },

  /* -------- print · card opens (needs the inside spread) ------------- */
  {
    id: "card-open",
    hands: "both",
    kind: "action",
    surface: "print",
    requiresInside: true,
    label: "Open the card",
    emoji: "💌",
    prompt:
      "hands take hold of the front panel and swing the card open to reveal the full inside spread, the paper flexing with believable stiffness and weight, until both inside panels are square to the camera and fully readable. The card stays open and still for the last beat",
  },
  {
    id: "open-slow-reveal",
    hands: "both",
    kind: "camera",
    surface: "print",
    requiresInside: true,
    label: "Slow reveal",
    emoji: "🎥",
    prompt:
      "the camera pushes in slowly and continuously while the card opens, the inside spread growing to fill the frame; one smooth unbroken move, the camera unhurried even as the card itself opens briskly",
  },
  {
    id: "open-and-linger",
    hands: "both",
    kind: "action",
    surface: "print",
    requiresInside: true,
    label: "Open & linger",
    emoji: "🥰",
    prompt:
      "the card is opened out to the inside spread and then held completely still and square to the camera while the reader's eyes travel slowly across it; a long, quiet beat on the message",
  },
  {
    id: "open-and-react-print",
    hands: "both",
    kind: "action",
    surface: "print",
    requiresInside: true,
    label: "Open & react",
    emoji: "🥹",
    prompt:
      "the recipient opens the card out to its inside spread, reads it, and reacts in real time — eyebrows lift, a grin spreads, one hand comes to their mouth while the other keeps hold of the open card. The open card stays square to camera and readable throughout",
  },
  {
    id: "envelope-open-read",
    hands: "both",
    kind: "action",
    surface: "print",
    requiresInside: true,
    involvesEnvelope: true,
    label: "Unbox, open & read",
    emoji: "🎁",
    prompt:
      "hands slide the card out of its envelope, turn the printed front to camera for a beat, then open it out to the full inside spread and hold it steady and readable",
  },
  {
    id: "open-show-friend",
    hands: "both",
    kind: "action",
    surface: "print",
    requiresInside: true,
    label: "Open & show a friend",
    emoji: "👯",
    prompt:
      "the card is opened to the inside spread and then turned toward a friend beside them; the friend leans in to read it, eyes widen, and they both start laughing",
  },
  {
    id: "open-on-table",
    hands: "both",
    kind: "action",
    surface: "print",
    requiresInside: true,
    label: "Open it flat on the table",
    emoji: "🫳",
    prompt:
      "the closed card lies on the surface and hands reach in from the edge of frame to fold it open flat, pressing the centre crease down so the whole inside spread lies square and readable beneath an overhead camera",
  },
  {
    id: "open-and-stand",
    hands: "both",
    kind: "action",
    surface: "print",
    requiresInside: true,
    label: "Open & stand it up",
    emoji: "🪧",
    prompt:
      "hands open the card and stand it upright on the surface with the inside spread facing the camera, adjust it square and withdraw from frame; the card settles and holds",
  },
  {
    id: "open-hand-over",
    hands: "both",
    kind: "action",
    surface: "print",
    requiresInside: true,
    label: "Open & pass it over",
    emoji: "🤝",
    prompt:
      "the card is opened to the inside spread and handed across to another person, who takes it, looks down at it and breaks into a smile. Hands cross in frame and the open spread stays readable through the exchange",
  },
  {
    id: "open-busy-world",
    hands: "both",
    kind: "action",
    surface: "print",
    requiresInside: true,
    label: "Open it in the thick of it",
    emoji: "🌆",
    prompt:
      "the card is opened out to its inside spread while the world keeps moving around the subject — people crossing behind in both directions, traffic passing, fabric and hair stirring in the breeze. They stay with the open card while life carries on",
  },
  {
    id: "open-celebrate",
    hands: "both",
    kind: "action",
    surface: "print",
    requiresInside: true,
    label: "Open & celebrate",
    emoji: "🎉",
    prompt:
      "the card is opened to the inside spread and the room erupts — friends cheer and clap, arms go up, streamers or confetti drift through the frame — while the open card stays square to camera and readable",
  },
];

/**
 * Video output tiers.
 *
 * 4K is gone: Seedance 2.5, the shipped video model, tops out at 1080p. Offering
 * a tier the default model cannot produce means the adapter quietly coerces it
 * on the way out, and a silently downgraded render is worse than a shorter list.
 * A model that does offer 4K still gets the request through its own controls.
 */
export const VIDEO_RESOLUTIONS = ["480p", "720p", "1080p"] as const;

/**
 * Up to 30 seconds, which is what Seedance 2.5 accepts; 2.0 stopped at 15. A
 * model with a shorter ceiling gets the nearest legal value from the schema
 * adapter rather than an error, so the longer list costs nothing on the models
 * that cannot use it.
 */
export const VIDEO_DURATIONS = ["auto", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"] as const;

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

/**
 * Print equivalent of the screen clipping rule: ink stays ink.
 *
 * Artwork routinely depicts objects — envelopes, letters, flowers, people — and
 * without this the model builds them as real props in the room. One render came
 * back with the envelope from the card's own illustration stuck to the front of
 * the physical card.
 */
/**
 * The card in a scene still must be shut, with no gap along the fold.
 *
 * A still with the card cracked slightly open hands the video model an
 * ambiguous starting state: it has to decide what the sliver of inside is, and
 * it answers by inventing one — usually before the opening motion has started.
 * Closing it in the still removes the question.
 */
const CARD_CLOSED_CLAUSE = [
  "ABSOLUTE RULE — the greeting card is completely closed in this photograph",
  "its two halves are pressed flat together along the fold with no gap of any kind: no wedge of light between them, no glimpse of the inside, no corner lifting or curling away from the other half, and no separation anywhere along the opening edge",
  "only the printed front panel is visible; the inside of the card is not shown at all, not even a sliver of it",
  "the card reads as one solid closed rectangle of folded stock, as if it had just come out of its envelope",
].join(". ");

/**
 * A greeting card is one folded sheet, not a book.
 *
 * Video models reach for a familiar object when something opens, and the
 * familiar object with a printed cover is a book — so cards come back with
 * pages stacked inside, a bound spine, or artwork printed on leaves that turn.
 * Stating the panel count outright is what stops it.
 */
/**
 * How an opening clip is paced.
 *
 * Left to itself the model starts opening almost immediately, so the front
 * panel — the artwork somebody actually bought — is gone before a viewer can
 * read it. Stated as three unequal beats with proportions attached, because
 * "hold for a beat" means nothing to a model that has no sense of how long the
 * clip is.
 *
 * The open itself is deliberately the shortest beat: the reveal is what earns
 * attention, but watching hands work a piece of paper is not.
 */
const CARD_OPEN_PACING_CLAUSE = [
  "TIMING — this clip has three beats and they are deliberately unequal",
  "FIRST, roughly the opening quarter of the clip: the card is closed and completely still, its printed front square to the camera and fully readable. Nothing moves — no lifting corner, no fingers flexing the panel, no early peel. Hold long enough that a viewer can actually read the front before anything happens",
  "THEN the open itself, and this is the shortest of the three beats: one brisk, decisive movement that gets the card open without dawdling or ceremony",
  "FINALLY, and for all of the remaining time, hold on the open inside spread, square to the camera and readable. This is the longest beat and the clip ends on it — the card never closes again and nothing further happens",
  "the inside is never shown before the open, and the card is never re-closed after it",
].join(". ");

const FLAT_CARD_CLAUSE = [
  "ABSOLUTE RULE — this is an ordinary folded greeting card, never a book, a booklet, a notebook or a multi-page card",
  "it is a single sheet of card stock folded exactly once, which gives it exactly four surfaces and no more: the printed front, the two inside panels, and the plain back",
  "held open, it is exactly two leaves in total — one on the left, one on the right — joined only at the centre fold, with nothing between them and nothing behind them",
  /*
   * The edges are where this actually failed. A model that has otherwise
   * understood "one folded sheet" still draws a sheaf of page edges down the
   * outer sides, because that is what the edge of an open printed thing looks
   * like to it. So the edges get called out by name.
   */
  "the outer left and right edges of the open card are each ONE single clean cut edge of ONE sheet: no stack of page edges, no row of layered leaves, no sheaf or block of paper, no second sheet peeking out from behind or beneath either panel",
  "seen edge-on the card is one thin line of stock about as thick as a postcard, never a block, never a spine, and never a stepped stack of edges",
  "there are no pages inside it, no extra leaves or sheets, no bound spine, no stitching, staples or rings, and nothing tucked, glued or inserted between its halves",
  "it opens once and lies flat as a single inside spread — there is nothing further to turn, and no page ever lifts, curls, fans or flips inside it",
].join(". ");

const PRINT_CONTAINMENT_CLAUSE = [
  "ABSOLUTE RULE — everything in the supplied artwork is flat printed ink on the card and nothing more",
  "whatever that artwork depicts — envelopes, letters, stamps, flowers, objects, hands, people — exists only as part of the printed image, inside the card's own edges",
  "none of it may lift off the paper, gain depth or its own shadow, become a physical prop in the scene, sit in front of the card, overlap the card's edges or turn up anywhere else in the shot",
  "the card is one flat rectangular piece of printed stock: nothing is tucked into it, clipped to it, laid across it, propped against it or peeking out from behind it",
].join(". ");

/**
 * Used whenever nothing the user picked actually involves an envelope.
 *
 * Phrased positively first — describing the card alone — because leading with a
 * bare negation gives the model the noun to latch onto, which is the opposite of
 * what's wanted.
 */
const NO_ENVELOPE_CLAUSE = [
  "The card appears completely on its own: bare printed stock, held or resting by itself, with nothing else in frame alongside it and nothing attached to it",
  "no envelope, sleeve, wrapper, insert or backing card of any kind is present, and nothing is tucked into the card, laid across it or propped behind it — not even if the printed artwork happens to depict such a thing",
].join(". ");

/**
 * The hands rule for a video, given what the chosen motion actually does.
 *
 * `hands: "none"` means the motion has already said no hands enter frame, and
 * repeating an anatomy rule about people who are not there would only give the
 * model somebody to draw.
 */
function handsFor(surface: SurfaceKind, hands: "none" | "both" | undefined): string | undefined {
  if (hands === "none") return undefined;
  return handsClause(surface === "print" ? "greeting card" : "device", hands === "both" ? "both" : "one");
}

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
    /*
     * Straight after the motion, because the motion is what triggers it: the
     * gesture a reaction calls for is where the extra arm gets invented.
     */
    handsFor(opts.surface, motion?.hands),
    scene ? `Keep the environment consistent: ${scene.prompt}` : undefined,
    `Whatever artwork is already on ${surfaceNoun} must stay perfectly locked to that surface with correct perspective for the whole clip — it must never slide, flicker, warp or change`,
    opts.surface === "print" ? PRINT_CONTAINMENT_CLAUSE : SCREEN_CONTAINMENT_CLAUSE,
    opts.surface === "print" ? FLAT_CARD_CLAUSE : undefined,
    opts.surface === "print" ? undefined : NO_TOUCH_CLAUSE,
    opts.surface === "print" ? NO_FACES_CLAUSE : undefined,
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
  const surfaceNoun = opts.surface === "print" ? "the printed card panel" : "the device screen";

  return joinPrompts([
    `Recreate the scene in @Image1 as a live-action clip, and play the footage from @Video1 on ${surfaceNoun}`,
    `@Video1 is a HeartStamp greeting-card animation. It should appear to be genuinely playing on ${surfaceNoun} in @Image1, filling it edge to edge`,
    `@Image1 already shows the exact opening frame of @Video1 on ${surfaceNoun} — it is a pixel-accurate composite, not an approximation. Continue straight on from precisely that frame: no cut, no flash, no white or blank screen, no fade in, no restart, no re-framing. Frame one of this clip must be identical to @Image1`,
    `@Video1 is screen content, not a scene to stage. Never recreate, re-enact or reposition its subjects in the physical environment — its imagery exists only as pixels inside ${surfaceNoun} and nowhere else in the shot`,
    "Lock the played footage to the surface with correct perspective and keystone for the entire clip — it must never slide, drift or detach",
    "Match the scene's brightness, colour temperature and reflections so the footage looks natively displayed, not pasted on",
    opts.surface === "print" ? PRINT_CONTAINMENT_CLAUSE : SCREEN_CONTAINMENT_CLAUSE,
    opts.surface === "print" ? FLAT_CARD_CLAUSE : undefined,
    opts.surface === "print" ? undefined : NO_TOUCH_CLAUSE,
    motion?.prompt,
    handsFor(opts.surface, motion?.hands),
    "Preserve the exact subject, wardrobe, environment, framing and lighting of @Image1",
    "Realistic physics and motion blur. No text overlays, no captions, no watermarks, no logos, no scene cuts",
    opts.extraNotes?.trim(),
  ]);
}

/* ------------------------- ONE-SHOT (FLOW 2) ------------------------ */

/**
 * Flow 2 skips the still entirely and asks Seedance for the finished clip in a
 * single pass: the scene is described in words, and the uploaded card animation
 * is supplied as @Video1 to play on the device.
 *
 * The trade is exactness for simplicity — there is no composite step, so the
 * artwork is whatever Seedance renders on the screen, and the logo can't be
 * burned in. Worth measuring against flow 1 rather than assuming.
 */
export function buildOneShotPrompt(sel: {
  surface: SurfaceKind;
  deviceId: string;
  sceneId: string;
  angleId: string;
  lightingId: string;
  lookId: string;
  presenceId: string;
  /** Who the people in the scene read as — see ETHNICITIES. */
  ethnicityId?: string;
  genderId?: SubjectGenderId;
  ageId?: SubjectAgeId;
  /** Category id → option id, from DETAIL_CATEGORIES. */
  details?: Record<string, string>;
  /** The user supplied a location photograph; it becomes @Image1. */
  hasBackground?: boolean;
  audienceId: string;
  framingId: string;
  motionId: string;
  /** Printed cards only: an inside spread is available as @Image2. */
  hasInside?: boolean;
  extraNotes?: string;
}): string {
  const device = byId(DEVICES, sel.deviceId);
  const scene = byId(SCENES, sel.sceneId);
  const angle = byId(ANGLES, sel.angleId);
  const light = byId(LIGHTING, sel.lightingId);
  const look = byId(LOOKS, sel.lookId);
  const presence = byId(PRESENCE, sel.presenceId);
  const audience = byId(AUDIENCES, sel.audienceId);
  const motion = byId(MOTIONS, sel.motionId);
  const opensCard = Boolean(motion?.requiresInside && sel.hasInside);

  const setting = [
    scene?.prompt,
    presence?.prompt,
    subjectClause({
      presenceId: sel.presenceId,
      ethnicityId: sel.ethnicityId,
      genderId: sel.genderId,
      ageId: sel.ageId,
      details: sel.details,
    }),
    angle?.prompt,
    framingClause(sel.framingId, sel.surface, sel.deviceId),
    light?.prompt,
    look?.prompt,
    audience ? `the styling, wardrobe and props should read as authentically ${audience.prompt}` : undefined,
    PLAUSIBLE_PLACEMENT_CLAUSE,
  ];

  if (sel.surface === "print") {
    /*
     * The card contract goes FIRST, before any scene description.
     *
     * With it buried after the setting, renders came back with the envelope
     * from the card's own illustration built as a real envelope the card was
     * tucked into — "greeting card + envelope" is a strong enough prior to
     * survive a rule stated 1,500 characters in. Stating the coverage in
     * absolute terms ("one hundred percent of that panel, top edge to bottom
     * edge") is aimed at the same failure: only the busy lower half of the
     * artwork was being replaced.
     */
    return joinPrompts([
      "A photorealistic live-action clip whose subject is one printed greeting card",
      "THE CARD IS A SINGLE FLAT RECTANGLE OF CARD STOCK AND NOTHING ELSE",
      "@Image1 is the artwork printed on its front. That artwork covers one hundred percent of that panel — top edge to bottom edge, left edge to right edge — and is reproduced exactly: same composition, same colours, same typography, same layout, nothing added, removed, moved or cropped",
      "No part of the card is ever covered, overlapped, obscured or interrupted by anything. Nothing is tucked into it, slipped over it, clipped to it, laid across it, wrapped around it or propped in front of it",
      "Whatever the artwork depicts — people, objects, letters, envelopes, flowers — is flat printed ink inside that rectangle. None of it becomes a real object in the scene, gains depth or its own shadow, or appears anywhere outside the card",
      FLAT_CARD_CLAUSE,
      device?.involvesEnvelope || motion?.involvesEnvelope ? undefined : NO_ENVELOPE_CLAUSE,
      opensCard
        ? "@Image2 is the artwork printed across the full inside spread — left and right inside panels together. The card starts closed showing @Image1; as it opens, the inside shows exactly @Image2 across both panels with the centre fold down the middle, reproduced just as faithfully, and holds steady and readable at the end"
        : "The card stays closed throughout — only the printed front from @Image1 is ever shown. Never open it and never invent an interior",
      `Now the shot: ${device?.prompt ?? "the card held upright, front facing the camera"}`,
      ...setting,
      motion?.prompt,
      handsFor("print", motion?.hands),
      opensCard ? CARD_OPEN_PACING_CLAUSE : undefined,
      "The printed artwork follows any curl or flex in the paper and takes the scene's own light, so it reads as genuinely printed on stock",
      "Realistic physics and paper motion, with believable card weight and stiffness. No text overlays, no captions, no watermarks, no logos, no scene cuts",
      sel.extraNotes?.trim(),
    ]);
  }

  const bg = Boolean(sel.hasBackground);

  return joinPrompts([
    bg
      ? "@Image1 is a photograph of a real location. @Video1 is a HeartStamp greeting-card animation"
      : undefined,
    bg
      ? `A photorealistic live-action clip: ${device?.prompt ?? "a smartphone"} placed into the location photograph in @Image1`
      : `A photorealistic live-action clip of ${device?.prompt ?? "a smartphone"}`,
    bg ? backgroundSceneClause("screen") : undefined,
    // Everything the photograph already decides. Emitting these alongside it
    // would ask the model to re-shoot the shot it was told to preserve.
    ...(bg ? [] : setting),
    "@Video1 is a HeartStamp greeting-card animation playing full-screen on that device. It must appear genuinely displayed on the screen, filling it edge to edge, from the very first frame of the clip",
    "Lock it to the screen with correct perspective and keystone for the whole clip — it must never slide, drift, detach or change",
    "Give it believable emissive screen brightness plus the scene's own reflections, so it reads as displayed rather than pasted on",
    "@Video1 is screen content, not a scene to stage. Never recreate, re-enact or reposition its subjects in the physical environment — its imagery exists only as pixels inside the screen and nowhere else in the shot",
    SCREEN_CONTAINMENT_CLAUSE,
    NO_TOUCH_CLAUSE,
    motion?.prompt,
    handsFor("screen", motion?.hands),
    "Realistic physics and motion blur. No text overlays, no captions, no watermarks, no logos, no scene cuts",
    sel.extraNotes?.trim(),
  ]);
}

/* ---------------------- PRINTED CARD: OPENING ----------------------- */

/**
 * Prompt for a printed-card clip that opens to reveal the inside spread.
 *
 * Uses Seedance's reference-to-video so the inside artwork can be supplied as
 * @Image2. Without it the model invents an inside, which is the one thing a
 * greeting-card asset can't get wrong.
 */
export function buildCardOpenPrompt(opts: {
  motionId: string;
  sceneId?: string;
  extraNotes?: string;
}): string {
  const motion = byId(MOTIONS, opts.motionId);
  const scene = byId(SCENES, opts.sceneId ?? "");

  return joinPrompts([
    "Bring @Image1 to life as a short, natural-looking live-action clip",
    "@Image1 is the scene with the greeting card closed, its printed front showing",
    "@Image2 is the artwork printed across the full inside spread of that same card — the left and right inside panels together",
    /*
     * Before the motion, not after it. Buried below the action this lost to the
     * model's prior that a printed thing which opens is a book, and clips came
     * back with a stack of page edges down the outer sides of the card.
     */
    FLAT_CARD_CLAUSE,
    motion?.prompt,
    // Every motion that reaches this builder opens the card, which is a genuine
    // two-handed job — so the rule here is the count, not a one-handed hold.
    handsFor("print", motion?.hands ?? "both"),
    CARD_OPEN_PACING_CLAUSE,
    "As the card opens, the inside must show exactly the artwork from @Image2: same composition, same colours, same typography, same layout across both panels. Reproduce it faithfully — do not redesign it, re-letter it, recolour it or invent any inside content of your own",
    "Map it to the open card with correct perspective, following the centre fold and any curl in the paper, and let the scene's own light fall across it. It must read as genuinely printed on that stock",
    "Keep the printed front from @Image1 exactly as it is for as long as it is visible; the same physical card is simply being opened",
    scene ? `Keep the environment consistent: ${scene.prompt}` : undefined,
    "Preserve the exact identity, wardrobe, framing and lighting of @Image1",
    PRINT_CONTAINMENT_CLAUSE,
    NO_FACES_CLAUSE,
    "Realistic physics and paper motion. No text overlays, no captions, no watermarks, no logos, no scene cuts",
    opts.extraNotes?.trim(),
  ]);
}
