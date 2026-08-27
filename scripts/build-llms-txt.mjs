/**
 * Writes `public/llms.txt` — the studio's instructions for AI assistants.
 *
 * WHY IT IS GENERATED
 * Most of what an assistant needs to know is already written down: `help.ts`
 * carries 100-odd explanations of individual controls, and `options.ts` carries
 * every choice those controls offer. Copying that prose into a hand-written
 * guide would create exactly the second copy `help.ts` says it refuses to keep
 * — "second copies rot" — except this one would rot facing outward, where the
 * people misled by it are users and their assistants rather than us.
 *
 * So the narrative is written here and the reference is derived. Adding a scene
 * to the taxonomy or a tooltip to a control updates the published guide; there
 * is no second place to remember.
 *
 * The output is committed. It ships as a static file rather than a route so it
 * costs nothing to serve, survives with the app switched off, and can be read
 * without executing any of this.
 *
 * WHY IT COMPILES ITS OWN IMPORTS
 * `help.ts` reaches `freeform.ts`, which is a client module, so a route handler
 * importing it is asking the bundler an awkward question. The three files form
 * a closed graph of relative imports and plain data, so tsc flattens them to a
 * temp directory and this reads the result. No runner dependency, and nothing
 * in the app has to bend to be readable from a script.
 *
 *   node scripts/build-llms-txt.mjs            # write it
 *   node scripts/build-llms-txt.mjs --check    # fail if it would change
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHECK = process.argv.includes("--check");

/* ------------------------- read the source of truth ------------------------ */

function loadRegistries() {
  const dir = mkdtempSync(path.join(tmpdir(), "llms-"));
  try {
    try {
      execFileSync(
        "npx",
        [
          "tsc",
        path.join(ROOT, "src/lib/help.ts"),
        "--outDir", dir,
        "--rootDir", path.join(ROOT, "src"),
        "--module", "commonjs",
        "--target", "es2022",
          "--skipLibCheck",
        ],
        { cwd: ROOT, stdio: "pipe" },
      );
    } catch (e) {
      /*
       * tsc reports on stdout, and execFileSync's own error is a stack trace
       * with the compiler's actual complaint buried in a Buffer. This runs on
       * every build now, so a type error in help.ts or the taxonomy has to read
       * like a type error rather than like this script being broken.
       */
      const out = (e.stdout?.toString() ?? "").trim();
      console.error("llms.txt: could not read the help registry.\n");
      console.error(out || e.message);
      process.exit(1);
    }
    // rootDir is pinned to `src` so the layout is predictable: left to itself tsc
    // infers it from the inputs, and a single entry file collapses the tree.
    /*
     * CommonJS, and required rather than imported. tsc emits `from "./options"`
     * with no extension, which Node's ESM resolver refuses and its CJS resolver
     * handles without comment. Nothing here needs ESM semantics — it is three
     * files of plain data.
     */
    return createRequire(import.meta.url)(path.join(dir, "lib", "help.js"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------- rendering -------------------------------- */

/**
 * The reference section, grouped.
 *
 * Order is the order someone meets these things, not alphabetical: the steps,
 * then what goes into a step, then the two other surfaces. A list sorted by key
 * would put `bench` before `card` and teach the app backwards.
 */
const SECTIONS = [
  ["The three steps", ["step."]],
  ["Step 1 — what you upload", ["card."]],
  ["Step 2 — the scene", ["scene."]],
  ["Step 2 — who is in frame", ["styling."]],
  ["Step 2 — the handwritten message", ["hand."]],
  ["Step 2 — output and cost", ["image."]],
  ["Step 3 — motion and output", ["motion.", "video."]],
  ["Choosing a model", ["model."]],
  ["PopKit — the nugget builder at /nuggets", ["pop."]],
  ["The bench at /freeform", ["bench."]],
];

const bullet = (t) => `  - **${t.term}** — ${t.what}`;

function renderEntry(key, e) {
  const lines = [`### ${e.title}`, "", e.body];
  if (e.terms?.length) lines.push("", ...e.terms.map(bullet));
  lines.push("");
  return lines.join("\n");
}

/** One line per control for the short file: the title and its first sentence. */
function renderIndexLine(key, e) {
  const first = e.body.split(/(?<=\.)\s/)[0];
  return `- **${e.title}** — ${first}`;
}

function renderReference(HELP, { full }) {
  const used = new Set();
  const out = [];
  for (const [heading, prefixes] of SECTIONS) {
    const keys = Object.keys(HELP)
      .filter((k) => prefixes.some((p) => k.startsWith(p)) && !used.has(k));
    if (!keys.length) continue;
    keys.forEach((k) => used.add(k));
    const render = full ? renderEntry : renderIndexLine;
    out.push(`## ${heading}`, "", ...keys.map((k) => render(k, HELP[k])), "");
  }
  /*
   * Anything unclaimed still gets printed. A silent drop is how a new control
   * ships undocumented and nobody notices for six months — the same failure the
   * derived lists exist to prevent.
   */
  const rest = Object.keys(HELP).filter((k) => !used.has(k) && !k.includes("."));
  if (rest.length) {
    const render = full ? renderEntry : renderIndexLine;
    out.push("## Named styles and shapes", "", ...rest.map((k) => render(k, HELP[k])), "");
  }
  return out.join("\n");
}

/*
 * The narrative. Hand-written, because none of it is derivable: it is the
 * reasons things are the way they are, and the mistakes an assistant makes on
 * its way to finding out.
 */
const PREAMBLE = `# HeartStamp Asset Studio

> A browser tool that turns greeting-card artwork into social-media assets —
> lifestyle stills, TikTok/Reels/Shorts video, and annotated "nugget" clips.
> Written for AI assistants helping someone operate it.

You are almost certainly reading this because someone asked you for help with
this tool. It is a graphical app: there is no agent API, no headless mode, and
no way to drive it except a browser. What you can usefully do is know what it
makes, know which part to send someone to, know the vocabulary, and know the
handful of rules that are not guessable and that cost money to learn the hard
way. That is what this file is.

## Read this before you render anything

**Every generation spends the user's own money, immediately.**

Each person supplies their own fal.ai key, so renders bill their fal account
rather than a shared one. There is no free tier inside the app, no preview, and
no undo — a submitted job is a charge. This is the single most important thing
on this page.

Step 2 is where this bites, because its batch multiplies:

    images = camera angles × orientations × variations

Four angles, two orientations and two variations is sixteen images, not eight,
and it is easy to tick four boxes without doing that arithmetic. One exception:
supplying your own background photograph locks the camera angles — the picture
already decides where the camera is — so the batch collapses to
\`orientations × variations\`.

The app is on your side here. Step 2 shows the resulting count next to the render
button before you commit, and past twelve it warns outright that these are
billable renders on your fal account. Renders run three at a time and are
cancellable mid-flight.

**Read the count out to the user and get an explicit yes before triggering a
render**, especially a batch. Do not treat "make me some scenes" as authorisation
for sixteen of them.

Video costs more than stills and takes minutes rather than seconds. That is the
whole reason the printed-card path stops at a still: you can look at eight
framings for the price of eight images instead of eight videos.

**Do not handle the fal key.** It is entered through the app's own dialog and
kept in an httpOnly cookie the page cannot read. Never ask a user to paste a key
to you, never put one in a file, a URL or a command. If they are not connected,
point them at the key dialog in the header and at fal.ai/dashboard/keys.

## What the studio makes

Three surfaces, and picking the right one is most of the help you can give.

**\`/\` — the card pipeline.** The main event, and the only part that knows what a
greeting card is. Upload artwork, put it in a photographed scene, animate it.
What you are selling picks the route:

- **Printed card** — three steps. Artwork → a lifestyle still with the front
  printed on the card → motion. It goes through a still because a video model
  handed artwork as a reference re-draws it; \`image-to-video\` reproduces frame
  one exactly, so the still is what pins the artwork down.
- **Digital card** — two steps. Upload the 2–15s card animation, then one render
  straight to video. No still needed: the clip is played back on the device's
  screen rather than re-imagined, so it survives.

**\`/nuggets\` — PopKit.** Annotation over a finished clip or a still image:
captions, medallions, arrows, media wells that pop in at chosen moments. It never
alters the footage; it draws on top and re-encodes both together in the browser.
This is where you go to explain, caption, or point at something — not to generate
imagery.

**\`/freeform\` — the bench.** Direct access to every image and video model fal
offers, with that model's own settings read live from fal's schema. No card
knowledge, no pipeline, no house rules. Use it when the pipeline's assumptions
are in the way, or to try a model the pipeline does not offer.

## Rules that are not guessable

These are all consequences of real renders failing, and each one will waste the
user's money if you ignore it.

**Nobody's face is ever shown.** Every "who's in frame" option is written around
hands, shoulders, backs of heads and crops above the chin. Generated faces
animate badly, and a wrong face sinks an otherwise good shot. Do not write a
prompt asking for a face, and do not suggest one as an improvement.

**An inside spread decides which motions exist.** With a spread uploaded, every
motion opens the card and the spread rides along so the real artwork is revealed.
Without one, nothing opens, because the model would have to invent an interior.
Uploading or removing a spread flips the whole motion set, and the current
selection is re-validated. If a motion "disappeared", this is why.

**There is no seed.** GPT-Image-2 exposes none, so "variations" means N separate
calls with a prompt nudge, not N seeds. You cannot reproduce a specific image, and
you cannot ask for "the same one but…". The only honest advice is to re-roll and
keep what lands.

**Nothing is stored server-side, and nothing lasts.** Config and asset URLs live
in the browser's localStorage; the media itself only ever lives on fal's CDN.
Uploads are expired by fal after about a week, and generated output goes the same
way — the app does not assume a deadline, it checks: the asset roll has a **Remove
expired items** control that sweeps for dead URLs, and it will quietly drop things
that have gone. **Anything worth keeping must be downloaded.** Clearing site data
loses the session too. Say this early, before someone spends an afternoon building
a roll they think is saved.

**Nobody touches the screen.** Taps never line up with what is playing, so hands
support a device from its edges only, and the motions are written to match.

**The logo is composited, not prompted.** A model asked to draw a brand mark
returns an approximation in a different place every time, so the real PNG is
burned in on a canvas. Scene stills are clean; the mark appears on video only.
Do not suggest prompting for it.

**PopKit exports in real time.** The encode records the deck as it plays, so a
sixty-second deck takes sixty seconds and the tab has to stay open and visible.
That is also why the still-background timeline is capped at a minute.

## Helping without a browser

If you cannot see the app, the useful things you can still do are: work out which
surface and which route the user needs; explain what a control does (the whole
reference is below); write prompt text for the "extra direction" box or the
bench; do the batch arithmetic before they spend; and talk through why a render
came out wrong using the rules above. Ask what is on their screen rather than
assuming — the app self-heals a restored session and drops assets that are gone,
so what they have may not be what they left.

If you are driving a browser, the flow is top-to-bottom on the page: the header
picks printed or digital, each step unlocks when the one above it has what it
needs, and the render button at the bottom of a step carries the count and the
cost. The "?" beside every control opens the same text you will find below.

---

`;

const INDEX_HEAD = `# Every control in the app, one line each

Generated from the app's own help registry, so it matches what the "?" buttons
say. **The full text of each, plus every option explained, is at
\`/llms-full.txt\`** — read that when someone asks what a specific control does or
which choice to pick.

`;

const FULL_HEAD = `# Reference: every control in the app

Generated from the app's own help registry, so it matches what the "?" buttons
say. Where a control offers a list of choices, each choice is explained too.

`;

const footer = (name) => `
---

\`${name}\` is generated from \`src/lib/help.ts\` and \`src/lib/options.ts\`. Do not
edit by hand; run \`pnpm llms\` instead.
`;

/* --------------------------------- main ----------------------------------- */

const { HELP } = loadRegistries();

/*
 * Two files, which is the llms.txt convention and here also the honest shape of
 * the thing. The narrative is what an assistant needs to be useful and is small
 * enough to read every time; the full control reference is four times its size
 * and is only wanted when someone asks about a specific control. Making that a
 * separate fetch means the common case stays cheap.
 */
const FILES = [
  ["llms.txt", PREAMBLE + INDEX_HEAD + renderReference(HELP, { full: false })],
  ["llms-full.txt", PREAMBLE + FULL_HEAD + renderReference(HELP, { full: true })],
];

let stale = false;
for (const [name, body] of FILES) {
  const doc = body + footer(name);
  const to = path.join(ROOT, "public", name);
  const current = (() => {
    try { return readFileSync(to, "utf8"); } catch { return null; }
  })();

  if (CHECK) {
    if (current !== doc) {
      console.error(`drift public/${name} is stale`);
      stale = true;
    }
    continue;
  }
  writeFileSync(to, doc);
  console.log(`wrote public/${name}  ${(doc.length / 1024).toFixed(1)} KB`);
}

if (CHECK) {
  if (stale) {
    console.error("      run `pnpm llms`");
    process.exit(1);
  }
  console.log(`ok    llms.txt is up to date (${Object.keys(HELP).length} entries)`);
}
