# HeartStamp Asset Studio

Generate social-media assets for HeartStamp printed (POD) and 3D digital greeting cards.
Base lifestyle images → card composites → TikTok / Reels / Pinterest video.

Three steps:

| Step | What it does | Model |
| --- | --- | --- |
| **1 · Card** | Upload printed-card artwork and/or an 8–13s 3D card clip | direct-to-fal upload |
| **2 · Scene** | Batch photoreal lifestyle scenes **with the card already on the surface** and the logo stamped in the corner | `openai/gpt-image-2/edit` |
| **3 · Motion** | Animate the scene, or play the card clip on the device in it | `bytedance/seedance-2.0/image-to-video` · `…/reference-to-video` |

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

**The card is placed during scene generation, not afterwards.** Step 2 hands the artwork to
GPT-Image-2's *edit* endpoint as a reference image and asks for the whole lifestyle scene with the
card already on the screen or printed on the panel. With no artwork selected it falls back to
text-to-image and leaves the surface blank, so you can still batch scenes before the card exists.

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
