# HeartStamp Asset Studio

Generate social-media assets for HeartStamp printed (POD) and 3D digital greeting cards.
Base lifestyle images → card composites → TikTok / Reels / Pinterest video.

What you're selling picks the pipeline — the buttons in the header are the choice. Both products
run the same two steps and the same single Seedance call; only the references differ.

| | Step 1 | Step 2 |
| --- | --- | --- |
| **Digital 3D Card** | Upload the 2–15s card animation | Scene + motion + output → the clip plays on a device |
| **Printed Card** | Upload the front panel, optionally the inside spread | Scene + motion + output → the card is the subject |

Digital hands the clip over as `@Video1`. Print hands over the artwork itself — front as `@Image1`,
inside spread as `@Image2` when the card opens. Everything goes through
`bytedance/seedance-2.0/reference-to-video`.

**There is no generated still in either path.** There used to be: a GPT-Image-2 scene that artwork
was composited onto, then animated. It cost more than it gave. The digital flow fought it — an
approximate first frame made Seedance stop believing the clip belonged on the screen — and on
printed cards it invented people whose faces then had to be animated. Describing the scene in words
and handing over the real artwork avoids both.

The inside spread decides which motions exist, and the two sets are mutually exclusive. With a
spread, every motion opens the card — that's the whole reason to have one, and 11 openings cover the
range from a plain reveal to unboxing, showing a friend, or opening it flat under an overhead
camera. Without a spread nothing opens, because the model would have to invent an interior, which is
the one thing a greeting-card asset can't get wrong.

Uploading or removing a spread flips the set, so the selected motion is re-validated on every asset
change and on load, falling back to the first one that fits rather than stranding the UI on a motion
that no longer applies.

Card artwork routinely depicts objects — an envelope, a letter, flowers — and the model will happily
build those as real props in the room. One render came back with the envelope from the card's own
illustration stuck to the front of the physical card. The print prompt now states that everything in
the supplied artwork is flat ink inside the card's edges and nothing more, and adds an explicit
"the card appears on its own" rule unless a chosen device or motion genuinely involves an envelope
(`involvesEnvelope` on the option). That rule leads with the positive description, because opening
with a bare negation hands the model the noun to latch onto.

Which panel an upload is gets guessed from its aspect ratio — fronts are portrait, inside spreads
are two panels side by side and so land as landscape. Dropping onto a named slot overrides the
guess but warns if the two disagree, and every tile has a front/inside toggle.

The logo is burned into the finished clip in the browser —
[`src/lib/video-logo.ts`](src/lib/video-logo.ts) plays it through a canvas, paints the emblem on
every frame with `paintLogo()`, and records the canvas back out to MP4 via MediaRecorder. Real time,
no dependencies, no extra API cost.

Three things about that file are load-bearing and were each found by testing, not reasoning:

- The `<video>` is attached to the DOM off-screen. A detached element is never composited, and the
  first version recorded 21 KB of black because of it.
- Frames are driven by a **worker timer**, not `requestAnimationFrame` or
  `requestVideoFrameCallback` — both stop when the tab is hidden, which would stall an encode the
  moment someone switches tabs.
- Audio is taken from the element's own `captureStream()`, which still carries signal while the
  element is muted. A Web Audio tap looks tidier but records silence from a muted element, and the
  element has to stay muted to satisfy autoplay policy.

**Unreachable as of this change:** `Step2Scene`, `Step3Motion`, `ScreenAligner`, `lib/compose.ts`,
`lib/screen-detect.ts`, `lib/perspective.ts`, and the `generateScenes` / `generateVideo` actions in
the store. They implement the old still pipeline, including the perspective compositing that put
artwork on a device screen pixel-exactly. Kept for now because the one-shot printed path hasn't been
through a real render yet; delete once it has.

Everything is downloadable in-app. Nothing is stored server-side.

---

## Quick start

```bash
pnpm install
```

```bash
pnpm dev
```

Open http://localhost:3000 and paste your fal.ai key when prompted. No `.env` file, no accounts,
no setup — that's it.

## Authentication is off

The studio currently runs as an **open demo**. There is no sign-in.

That's a deliberate trade: every user supplies their own fal.ai key, so there's no spend on a
shared account, no secret of ours stored anywhere, and no data to leak. The key is the real gate.
The app is also `noindex`, so it won't turn up in search.

The Google / `@heartstamp.com` implementation is **still in the repo, intact and type-checked** —
nothing was deleted. To turn it back on:

1. Set `AUTH_ENABLED = true` in [`src/auth.ts`](src/auth.ts).
2. Fill in `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` (see `.env.example`;
   generate the secret with `openssl rand -base64 32`).
3. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** →
   Web application, with redirect URI `https://<your-domain>/api/auth/callback/google`
   (add `http://localhost:3000/api/auth/callback/google` for local testing).

That one flag restores the sign-in page, the per-route API guards, and the account UI in the
header. Access is restricted to **@heartstamp.com**: the `hd` parameter only biases Google's
account chooser — the actual gate is the `signIn` callback, which verifies the Workspace domain
(`hd` claim) or a verified `@heartstamp.com` address.

## The fal.ai key

Each user brings their own key, so generations bill to their fal account.

- Validated against fal before it's accepted, so typos fail immediately.
- Stored in an **httpOnly, SameSite=Lax** cookie — unreadable from JavaScript and never written
  to a database.
- A second, non-sensitive cookie holds only the last four characters, purely so the header can
  render a "connected" state.
- "Disconnect" in the key dialog clears both.

Grab one at [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys).

## Architecture notes

**Uploads bypass our server.** `POST /api/fal/upload-url` calls fal's `storage/upload/initiate`
(a tiny authenticated JSON request) and returns a signed URL. The browser then `PUT`s the bytes
straight to fal's CDN. A 40 MB card video never touches our origin, so serverless request-body
limits are irrelevant. Uploaded files expire from fal after 7 days.

**Generation is queued, not blocking.** `POST /api/fal/submit` enqueues and returns a
`request_id`; the client polls `GET /api/fal/status` with backoff (1.5s → 6s). Video renders that
take minutes never hold a function open. Batches run 3-wide and are cancellable mid-flight.

**The card is composited onto the screen in the browser, not drawn by the model.** GPT-Image-2
treats a reference image as inspiration: given a card frame it re-typeset the text and cropped away
the dark background. An approximate first frame is also what makes Seedance stop believing the clip
belongs on the screen — it starts staging the clip's contents in the room instead.

So for the screen surface the model is asked only for a clean blank white screen, and then
[`src/lib/screen-detect.ts`](src/lib/screen-detect.ts) finds that screen (largest near-white,
low-saturation blob whose corner-quad it actually fills — which is what rejects plates and cups) and
[`src/lib/perspective.ts`](src/lib/perspective.ts) warps the artwork onto it. Canvas 2D is
affine-only, so the projective map is applied by subdividing into a 32×32 mesh and drawing each cell
affinely; the error inside a cell is well under a pixel. The detected quad is pushed outward a few
pixels on purpose — overhang onto the black bezel is invisible, a bright rim of bare screen is not.

Corners come from fitting a line to each straight edge and intersecting neighbours, not from extreme
points. Phone screens are rounded, and an extreme point sits on the corner *arc* — about 0.29r inside
the true corner, which is ~20px on a phone screen and showed up as a white rim of bare screen around
the artwork.

The artwork is centre-cropped to the screen's aspect rather than stretched to it (a 9:16 card on a
~19.5:9 screen loses ~7% from each side instead of being squashed), with a little overscan, and is
clipped to a rounded outline so it never squares off over the bezel's corners.

Detection can miss, so every scene keeps its pre-composite render and can be re-aligned by dragging
four handles ([`ScreenAligner`](src/components/ScreenAligner.tsx)); tiles that need it are flagged.

Printed cards still go through the *edit* endpoint — paper curls and folds, so a flat perspective
warp is the wrong tool. With no artwork selected the surface is simply left blank.

**Uploading a clip also registers its first frame as card artwork.** Otherwise step 2 has nothing
to put on the screen, the scene renders blank, and step 3's video has to invent its way out of a
white screen. Grabbing frame one means the still already shows exactly what the clip opens on, and
the screen-replace prompt tells Seedance to continue straight from that frame with no cut or flash.
Uploading a clip also pre-selects the *Play the card clip* engine in step 3.

**Two prompt rules exist because real renders broke without them.** The screen is declared a hard
clipping boundary — content that leaves the card animation's frame disappears at the screen edge
rather than falling out of the phone into the room. And nobody touches the screen: hands support
the device from its edges only, since taps never line up with what's playing. Motions are written to
match, so no option asks for a finger on the glass.

**Selections are persisted, and self-heal on load.** `cardArtId` / `cardVideoId` / `baseId` used to
live in component state, so any reload left the assets in the roll with nothing wired up and step 2
quietly rendered a blank screen. They now sit in the store, and a restored session drops ids whose
asset is gone, falls back to the newest asset of the right kind, and resets taxonomy ids that no
longer exist. An explicit `null` is respected — that means "deliberately cleared", not "unset".
Step 2 also shows a thumbnail of exactly what is going onto the surface, so a blank render can't
happen unnoticed.

**The logo is composited on a canvas, not prompted.** A diffusion model asked to draw a brand mark
returns an approximation, in a slightly different place every time. So
[`src/lib/watermark.ts`](src/lib/watermark.ts) burns the real PNG into the bottom-right corner of
every still — 11% of the short edge, 4.5% margin, pixel-exact and identical across the whole batch.
The still is pulled through `/api/download` first so the canvas is never tainted by a cross-origin
read. Step 3 then tells Seedance the mark is a flat overlay that must not move, scale or catch the
scene lighting.

The emblem is auto-trimmed to its opaque bounds before scaling, so transparent padding around the
artwork can't shrink it. The two supplied PNGs disagreed on this — the 3959px master carries ~30%
padding, the old 85px export had none — and trimming is what makes `LOGO_SCALE` mean "how wide the
heart is" regardless of which file is dropped in.

**Variations are re-rolls.** GPT-Image-2 exposes no `seed` parameter, so N variations means N
separate calls with a prompt nudge, not N seeds. Step 2's batch is
`angles × orientations × variations` and the count is shown before you spend anything.

**Scenes can be uploaded, not just generated.** Step 2 takes a finished still as a `base` asset so
work from an earlier session goes straight into step 3. Uploads are not stamped — anything saved out
of this tool already carries the logo.

**Framing is its own control, separate from camera angle.** `ANGLES` says where the camera is;
`FRAMINGS` says how close. The prompt gives the model a concrete area target — hero close-up asks
for the screen alone to fill 45–60% of the image — because "close up" on its own gets interpreted
very loosely. Default is hero: the card is the point of the shot, so it should be readable while
someone is scrolling past.

**Motion comes in two flavours.** *Camera only* moves the lens over a still scene. *Make the scene
come alive* drives the subject and the background — reactions, a friend leaning in, a thumb
stopping mid-scroll, wind, crowds. The second group is what stops a clip reading as a slow pan over
a photograph.

**Nothing persists server-side.** Config and the session's asset URLs live in `localStorage`
(via a `useSyncExternalStore` store, so there's no hydration mismatch). Media stays on fal's CDN.
Downloads stream through `/api/download`, which is host-allowlisted to fal domains.

## Scripts

```bash
pnpm dev
```

```bash
pnpm build
```

```bash
pnpm lint
```

## Deploying to Vercel

No environment variables are needed while authentication is off — just deploy.

If you re-enable auth, add `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` and `AUTH_URL`
(your canonical origin) to the project environment, then add the production callback URL to the
Google OAuth client.

## Extending the taxonomy

Devices, scenes, camera angles, orientations, lighting, film looks, presence and motions are all
plain arrays in [`src/lib/options.ts`](src/lib/options.ts). Adding a new option is one object — the
dropdowns, checkboxes and prompt compiler pick it up automatically. Scenes can be tagged with an
`audience` list to filter them per persona; motions carry `kind: "camera" | "action"`, which is
what splits the two groups in step 3.

## Replacing the logo

Drop a new PNG in `public/` and point `LOGO_SRC` in [`src/lib/watermark.ts`](src/lib/watermark.ts)
at it. `LOGO_SCALE` and `LOGO_MARGIN` in the same file control size and inset. Transparent padding
around the mark is handled automatically, so the new file doesn't have to be cropped to match the
old one.
