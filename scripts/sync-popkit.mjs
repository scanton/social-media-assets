/**
 * Vendors the POP KIT composition source out of a .skill package.
 *
 *   node scripts/sync-popkit.mjs <path-to.skill>          copy in
 *   node scripts/sync-popkit.mjs <path-to.skill> --check  report drift, exit 1
 *
 * WHY VENDOR AT ALL
 * The spec is explicit that the app must use the kit's real layout math rather
 * than re-deriving it, because "two independent implementations of the same
 * layout math will drift apart over time". A .skill is a zip, not a package, so
 * there is nothing to depend on — copying is the only way in. `--check` is what
 * keeps a copy from quietly becoming a fork: CI (or a person) can ask whether
 * these files still match the skill they came from.
 *
 * WHY THIS EXACT FILE LIST
 * These are the modules reachable from compose() plus the three that generate
 * the 62 object/occasion glyphs. Every one is free of fs/path/url/Buffer, which
 * is what lets the browser run the same code the render route will. hands.js and
 * stampy-art.js are deliberately absent: they read PNGs off disk, and neither
 * the gestures nor the Stampy faces are in this feature's picker set.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FILES = [
  "assets/kit/compose.js",
  "assets/kit/tokens.js",
  "assets/kit/frames.js",
  "assets/kit/finish.js",
  "assets/kit/arrows2.js",
  "assets/kit/captions.js",
  "assets/kit/measure.js",
  "assets/kit/feedback.js",
  "assets/kit/motion.js",
  "assets/kit/media.js",
  "assets/kit/deck-validate.js",
  "references/deck.schema.json",
  "assets/kit/widths.json",
  "assets/kit/objects-rich.js",
  "assets/kit/categories-rich.js",
  "assets/kit/categories-rich-2.js",
];

const DEST = "src/lib/popkit/kit";

const skill = process.argv[2];
const check = process.argv.includes("--check");
if (!skill) {
  console.error("usage: node scripts/sync-popkit.mjs <path-to.skill> [--check]");
  process.exit(2);
}

const digest = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 12);
const read = (entry) => execFileSync("unzip", ["-p", skill, entry], { maxBuffer: 64 << 20 });

fs.mkdirSync(DEST, { recursive: true });

/* What the last sync wrote. A file that no longer matches its recorded
   digest has been edited HERE since, and overwriting it silently throws
   that work away — which is exactly what happened the first time this
   script grew a second job and got run without --check out of habit.
   See src/lib/popkit/kit/LOCAL-PATCHES.md for the patches this guards. */
const SOURCE = path.join(DEST, "SOURCE.json");
const previous = fs.existsSync(SOURCE)
  ? (JSON.parse(fs.readFileSync(SOURCE, "utf8")).syncedFiles ?? {})
  : {};
const force = process.argv.includes("--force");

let drift = 0;
let blocked = 0;
const manifest = {};

for (const entry of FILES) {
  const name = path.basename(entry);
  const target = path.join(DEST, name);
  const incoming = read(entry);
  manifest[name] = digest(incoming);

  const existing = fs.existsSync(target) ? fs.readFileSync(target) : null;
  const same = existing && existing.equals(incoming);

  if (check) {
    if (!same) {
      drift++;
      console.error(`DRIFT  ${name}  ${existing ? "differs from" : "missing against"} ${path.basename(skill)}`);
    }
    continue;
  }

  const locallyEdited =
    existing && previous[name] && digest(existing) !== previous[name] && !same;

  if (locallyEdited && !force) {
    blocked++;
    console.error(
      `KEPT    ${name}  edited here since the last sync — not overwriting. ` +
      `Land the change in the skill, or pass --force to discard it.`,
    );
    // The baseline stays the SKILL's digest, never the local one. Recording the
    // local file here would make it look unedited on the next run and the guard
    // would wave the overwrite through -- which is how two of these came back
    // reverted the first time.
    continue;
  }

  if (!same) fs.writeFileSync(target, incoming);
  console.log(`${same ? "  same" : force && locallyEdited ? "FORCED" : "update"}  ${name}  ${manifest[name]}`);
}

if (check) {
  if (drift) {
    console.error(`\n${drift} file(s) drifted from ${path.basename(skill)}. Re-run without --check to sync.`);
    process.exit(1);
  }
  console.log(`in sync with ${path.basename(skill)}`);
  process.exit(0);
}

/* ---------------------------------------------------------------
   STAMPY

   Stampy is artwork, not code: 28 PNGs in assets/stampy/png. They
   cannot be vendored like the modules above, because the loader that
   reads them — assets/kit/stampy-art.js — opens them with `fs`, and
   glyphs.md is emphatic that the character is never rebuilt out of
   paths. So the files are copied to public/ and served, and the one
   thing the browser genuinely needs out of that module is extracted
   rather than retyped: every expression carries its own MEASURED head
   fraction, and without it the wizard's head renders two thirds the
   size of grief's. Importing the module here and dumping its exports
   keeps that table honest — a retyped copy would rot the first time
   an expression is remeasured.
   --------------------------------------------------------------- */
const STAMPY_DIR = "public/stampy";
const STAMPY_DATA = "src/lib/popkit/stampy.json";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "popkit-stampy-"));
fs.writeFileSync(path.join(tmp, "stampy-art.js"), read("assets/kit/stampy-art.js"));
const art = await import(pathToFileURL(path.join(tmp, "stampy-art.js")).href);
fs.rmSync(tmp, { recursive: true, force: true });

fs.mkdirSync(STAMPY_DIR, { recursive: true });
let copied = 0;
for (const name of art.STAMPY_NAMES) {
  const target = path.join(STAMPY_DIR, `${name}-512.png`);
  const incoming = read(`assets/stampy/png/${name}-512.png`);
  const existing = fs.existsSync(target) ? fs.readFileSync(target) : null;
  if (!existing || !existing.equals(incoming)) {
    fs.writeFileSync(target, incoming);
    copied++;
  }
}

/* ---------------------------------------------------------------
   THE SOUND PACK

   Nine wavs, synthesised by the skill's own sfx/make_sfx.py. Copied out
   rather than regenerated here: the editor previewing a different
   rendering of "pop-in" than the render route muxes would be worse than
   no preview at all. If they are absent the skill predates the pack and
   the builder simply offers no audition.
   --------------------------------------------------------------- */
const SFX_DIR = "public/sfx";
let sfxCopied = 0;
try {
  const listed = execFileSync("unzip", ["-Z1", skill, "sfx/*.wav"], { encoding: "utf8" })
    .split("\n").map((l) => l.trim()).filter(Boolean);
  fs.mkdirSync(SFX_DIR, { recursive: true });
  for (const entry of listed) {
    const target = path.join(SFX_DIR, path.basename(entry));
    const incoming = read(entry);
    const existing = fs.existsSync(target) ? fs.readFileSync(target) : null;
    if (!existing || !existing.equals(incoming)) {
      fs.writeFileSync(target, incoming);
      sfxCopied++;
    }
  }
} catch {
  /* no sfx in this package */
}

fs.writeFileSync(
  STAMPY_DATA,
  JSON.stringify(
    {
      note: "Generated by scripts/sync-popkit.mjs. Do not edit: it is a dump of stampy-art.js's own tables.",
      base: art.BASE ?? 0.8907,
      names: art.STAMPY_NAMES,
      use: art.STAMPY_USE,
      headScale: Object.fromEntries(art.STAMPY_NAMES.map((n) => [n, art.headScale(n)])),
    },
    null,
    2,
  ) + "\n",
);

fs.writeFileSync(
  path.join(DEST, "SOURCE.json"),
  JSON.stringify({ source: path.basename(skill), syncedFiles: manifest }, null, 2) + "\n",
);
console.log(`\nvendored ${FILES.length} files from ${path.basename(skill)}`);
console.log(`stampy: ${art.STAMPY_NAMES.length} expressions, ${copied} png(s) written to ${STAMPY_DIR}`);
console.log(`sfx: ${fs.existsSync(SFX_DIR) ? fs.readdirSync(SFX_DIR).length : 0} cue(s) available, ${sfxCopied} written to ${SFX_DIR}`);
if (blocked) {
  console.error(
    `\n${blocked} locally-edited file(s) kept. They are still patched against ` +
    `${path.basename(skill)} — see src/lib/popkit/kit/LOCAL-PATCHES.md.`,
  );
}
