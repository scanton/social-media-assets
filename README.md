# HeartStamp Asset Studio

Generate social-media assets for HeartStamp printed (POD) and 3D digital greeting cards.
Base lifestyle images → card composites → TikTok / Reels / Pinterest video.

Built for the four-step workflow from Keith's brief:

| Step | What it does | Model |
| --- | --- | --- |
| **1 · Card** | Upload printed-card artwork and/or an 8–13s 3D card clip | direct-to-fal upload |
| **2 · Base** | Batch photoreal lifestyle scenes with a **blank** screen or card panel | `openai/gpt-image-2` |
| **3 · Place** | Composite the artwork onto that blank surface, perspective-matched | `openai/gpt-image-2/edit` |
| **4 · Motion** | Animate the still, or play the card clip on the device in-scene | `bytedance/seedance-2.0/image-to-video` · `…/reference-to-video` |

Everything is downloadable in-app. Nothing is stored server-side.

---

## Quick start

```bash
pnpm install
```

Create `.env.local` from the template:

```bash
cp .env.example .env.local
```

Generate a session secret:

```bash
openssl rand -base64 32
```

Then run:

```bash
pnpm dev
```

Open http://localhost:3000 and paste your fal.ai key when prompted.

> Without `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, the studio runs unauthenticated **in local
> development only** and shows a warning banner. A production build (`NODE_ENV=production`,
> which Vercel always sets) hard-fails closed and requires Google sign-in.

## Google sign-in

Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** → Web application.

Authorised redirect URI:

```
https://<your-domain>/api/auth/callback/google
```

For local testing add `http://localhost:3000/api/auth/callback/google` too.

Access is restricted to **@heartstamp.com** accounts. The `hd` parameter only biases Google's
account chooser — the actual gate is the `signIn` callback in [`src/auth.ts`](src/auth.ts), which
verifies the Workspace domain (`hd` claim) or a verified `@heartstamp.com` address.

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

**Base assets are generated blank on purpose.** The prompt compiler in
[`src/lib/options.ts`](src/lib/options.ts) appends a hard requirement that the screen (or printed
panel) come back as pure flat white with all four corners in frame and no glare — that's what
makes step 3's composite land cleanly. The toggle can be turned off if you just want a finished
scene.

**Variations are re-rolls.** GPT-Image-2 exposes no `seed` parameter, so N variations means N
separate calls with a prompt nudge, not N seeds. Step 2's batch is
`angles × orientations × variations` and the count is shown before you spend anything.

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

Set `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `AUTH_URL` (your canonical origin)
in project environment variables, then add the production callback URL to the Google OAuth client.

## Extending the taxonomy

Devices, scenes, camera angles, orientations, lighting, film looks, presence and camera motions
are all plain arrays in [`src/lib/options.ts`](src/lib/options.ts). Adding a new option is one
object — the dropdowns, checkboxes and prompt compiler pick it up automatically. Scenes can be
tagged with an `audience` list to filter them per persona.
