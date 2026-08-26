"use client";

/**
 * The open bench: any image or video model, your own prompt.
 *
 * The guided pipelines write the whole prompt for you from a handful of
 * choices. This is the other end of the range, where the person knows roughly
 * what they want and it is not something the product already covers. So the
 * prompt is theirs, and everything here is optional scaffolding around it.
 *
 * WHY THESE LISTS EXIST
 * "Add lighting" is not useful advice to someone who has not spent years
 * looking at lighting. A list of named looks is, because reading "hard midday
 * sun, sharp shadows" and recognising it is much easier than producing it from
 * a blank page. Each option carries the phrasing a model actually responds to,
 * so picking one is worth more than knowing the term.
 *
 * WHY THEY APPEND RATHER THAN TEMPLATE
 * The clauses are added after the person's own words, never woven through
 * them. A helper that rewrites your sentence is a helper you stop trusting the
 * moment it changes something you meant. The compiled prompt is shown in full
 * for the same reason.
 */

export interface Hint {
  id: string;
  label: string;
  /** The words appended to the prompt. */
  prompt: string;
  hint?: string;
}

export interface HintGroup {
  id: string;
  label: string;
  /** Shown for both, or only when the output moves. */
  media: "both" | "video";
  blurb: string;
  options: Hint[];
}

export const HINT_GROUPS: HintGroup[] = [
  {
    id: "shot",
    label: "Shot size",
    media: "both",
    blurb: "How much of the subject is in frame.",
    options: [
      { id: "extreme-wide", label: "Extreme wide", prompt: "extreme wide shot, the subject small in a large space" },
      { id: "wide", label: "Wide", prompt: "wide shot, full subject with the surroundings visible" },
      { id: "medium", label: "Medium", prompt: "medium shot, subject from the waist up" },
      { id: "close", label: "Close-up", prompt: "close-up, the subject filling the frame" },
      { id: "macro", label: "Macro", prompt: "macro shot, very close, fine detail and texture" },
    ],
  },
  {
    id: "angle",
    label: "Camera angle",
    media: "both",
    blurb: "Where the camera sits relative to the subject.",
    options: [
      { id: "eye", label: "Eye level", prompt: "shot at eye level, straight on" },
      { id: "low", label: "Low angle", prompt: "low angle looking up at the subject", hint: "Makes the subject loom" },
      { id: "high", label: "High angle", prompt: "high angle looking down at the subject" },
      { id: "overhead", label: "Overhead", prompt: "directly overhead, flat lay, looking straight down" },
      { id: "dutch", label: "Dutch tilt", prompt: "dutch angle, the horizon tilted", hint: "Unease, energy" },
      { id: "over-shoulder", label: "Over the shoulder", prompt: "over-the-shoulder shot" },
      { id: "three-quarter", label: "Three-quarter", prompt: "three-quarter view, turned slightly away from camera" },
    ],
  },
  {
    id: "lighting",
    label: "Lighting",
    media: "both",
    blurb: "The single biggest lever on how a shot feels.",
    options: [
      { id: "golden", label: "Golden hour", prompt: "golden hour light, low warm sun, long soft shadows" },
      { id: "blue", label: "Blue hour", prompt: "blue hour, cool even twilight just after sunset" },
      { id: "soft-window", label: "Soft window", prompt: "soft diffused daylight from a large window, gentle falloff" },
      { id: "overcast", label: "Overcast", prompt: "flat overcast daylight, soft shadowless light" },
      { id: "hard-sun", label: "Hard sun", prompt: "hard midday sun, bright highlights and sharp shadows" },
      { id: "rembrandt", label: "Rembrandt", prompt: "Rembrandt lighting, one key light at 45 degrees, deep shadow side" },
      { id: "rim", label: "Rim light", prompt: "strong rim light separating the subject from a dark background" },
      { id: "neon", label: "Neon", prompt: "neon lighting, saturated magenta and cyan practicals" },
      { id: "candle", label: "Candlelight", prompt: "warm candlelight, low key, flickering pools of light" },
      { id: "studio", label: "Studio softbox", prompt: "clean studio lighting, large softbox, even and controlled" },
    ],
  },
  {
    id: "lens",
    label: "Lens",
    media: "both",
    blurb: "Focal length changes perspective, not just crop.",
    options: [
      { id: "wide-lens", label: "Wide 24mm", prompt: "shot on a 24mm wide lens, expansive perspective" },
      { id: "35", label: "35mm", prompt: "shot on a 35mm lens, natural documentary perspective" },
      { id: "50", label: "50mm", prompt: "shot on a 50mm lens, perspective close to the human eye" },
      { id: "85", label: "85mm portrait", prompt: "shot on an 85mm portrait lens, flattering compression" },
      { id: "tele", label: "Telephoto 200mm", prompt: "shot on a 200mm telephoto, heavily compressed background" },
      { id: "macro-lens", label: "Macro", prompt: "shot on a macro lens, extreme close focus" },
    ],
  },
  {
    id: "depth",
    label: "Depth of field",
    media: "both",
    blurb: "How much of the scene is sharp.",
    options: [
      { id: "shallow", label: "Shallow", prompt: "shallow depth of field, subject sharp against a soft blurred background" },
      { id: "deep", label: "Deep", prompt: "deep depth of field, everything from foreground to background in focus" },
      { id: "tilt", label: "Tilt-shift", prompt: "tilt-shift effect, a narrow band of focus across the frame" },
    ],
  },
  {
    id: "look",
    label: "Look",
    media: "both",
    blurb: "The finish. Where a shot reads as film, or phone, or render.",
    options: [
      { id: "film35", label: "35mm film", prompt: "shot on 35mm film, natural grain, slight halation" },
      { id: "cinematic", label: "Cinematic", prompt: "cinematic colour grade, filmic contrast, anamorphic feel" },
      { id: "editorial", label: "Editorial", prompt: "editorial photography, clean and considered, magazine quality" },
      { id: "ugc", label: "Phone / UGC", prompt: "shot on a phone, candid and unstyled, natural imperfection" },
      { id: "polaroid", label: "Polaroid", prompt: "instant film look, soft focus, washed warm tones, white border" },
      { id: "bw", label: "Black and white", prompt: "black and white, rich tonal range" },
      { id: "render3d", label: "3D render", prompt: "clean 3D render, soft global illumination, subtle ambient occlusion" },
      { id: "illustration", label: "Illustration", prompt: "flat vector illustration, bold shapes, limited palette" },
    ],
  },
  {
    id: "time",
    label: "Time and weather",
    media: "both",
    blurb: "When it is, and what the air is doing.",
    options: [
      { id: "dawn", label: "Dawn", prompt: "early morning, pale light, long shadows" },
      { id: "midday", label: "Midday", prompt: "bright midday" },
      { id: "dusk", label: "Dusk", prompt: "dusk, the last warm light going" },
      { id: "night", label: "Night", prompt: "at night, artificial light sources only" },
      { id: "rain", label: "Rain", prompt: "rain, wet reflective surfaces" },
      { id: "fog", label: "Fog", prompt: "fog, heavy atmosphere, depth falling away" },
      { id: "snow", label: "Snow", prompt: "snow falling, cold muted palette" },
    ],
  },

  /* ------------------------------ video only ------------------------------ */
  {
    id: "motion",
    label: "Camera motion",
    media: "video",
    blurb: "What the camera does. The move is the difference between a still that ticks and a shot.",
    options: [
      { id: "static", label: "Locked off", prompt: "the camera is locked off and completely static" },
      { id: "dolly-in", label: "Dolly in", prompt: "the camera dollies slowly in toward the subject" },
      { id: "dolly-out", label: "Dolly out", prompt: "the camera dollies slowly back away from the subject" },
      { id: "truck-left", label: "Truck left", prompt: "the camera trucks steadily to the left, staying parallel to the subject" },
      { id: "truck-right", label: "Truck right", prompt: "the camera trucks steadily to the right, staying parallel to the subject" },
      { id: "pan-left", label: "Pan left", prompt: "the camera pans left from a fixed position" },
      { id: "pan-right", label: "Pan right", prompt: "the camera pans right from a fixed position" },
      { id: "tilt-up", label: "Tilt up", prompt: "the camera tilts up from a fixed position" },
      { id: "tilt-down", label: "Tilt down", prompt: "the camera tilts down from a fixed position" },
      { id: "crane-up", label: "Crane up", prompt: "the camera cranes upward, rising above the subject" },
      { id: "orbit", label: "Orbit", prompt: "the camera orbits smoothly around the subject" },
      { id: "zoom-in", label: "Zoom in", prompt: "a slow zoom in", hint: "The lens moves, not the camera" },
      { id: "zoom-out", label: "Zoom out", prompt: "a slow zoom out", hint: "The lens moves, not the camera" },
      { id: "handheld", label: "Handheld", prompt: "handheld camera, subtle natural shake" },
      { id: "push-follow", label: "Follow", prompt: "the camera follows the subject, holding them steady in frame" },
      { id: "rack", label: "Rack focus", prompt: "a rack focus, shifting focus from foreground to background" },
    ],
  },
  {
    id: "pace",
    label: "Pace",
    media: "video",
    blurb: "How fast anything moves.",
    options: [
      { id: "still", label: "Almost still", prompt: "almost no movement, only the smallest drift" },
      { id: "slow", label: "Slow", prompt: "slow, unhurried movement" },
      { id: "natural", label: "Natural", prompt: "movement at a natural, real-time pace" },
      { id: "brisk", label: "Brisk", prompt: "brisk, energetic movement" },
      { id: "slowmo", label: "Slow motion", prompt: "slow motion, high frame rate look" },
    ],
  },
];

/**
 * The person's prompt, with whatever they picked appended.
 *
 * Their words first and untouched. The clauses follow in the order the groups
 * are listed, which runs subject, framing, light, finish, then motion, roughly
 * the order a director would describe a shot in.
 */
export function compilePrompt(prompt: string, picks: Record<string, string>, isVideo: boolean): string {
  const clauses: string[] = [];
  for (const group of HINT_GROUPS) {
    if (group.media === "video" && !isVideo) continue;
    const chosen = group.options.find((o) => o.id === picks[group.id]);
    if (chosen) clauses.push(chosen.prompt);
  }
  const base = prompt.trim();
  if (!clauses.length) return base;
  return base ? `${base}. ${clauses.join(". ")}.` : `${clauses.join(". ")}.`;
}

/**
 * A negative prompt worth having by default, for models that take one.
 *
 * Not applied silently: it is a field the person can see and clear. These are
 * the failure modes that spoil an otherwise good render rather than a wishlist.
 */
export const DEFAULT_NEGATIVE =
  "blurry, low resolution, distorted proportions, extra fingers, watermark, text artefacts, oversaturated";
