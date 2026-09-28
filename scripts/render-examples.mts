/**
 * Renders the example pictures shown in the help tooltips (see src/lib/examples.ts).
 *
 *   OPENAI_API_KEY=… npx tsx scripts/render-examples.mts
 *   npx tsx scripts/render-examples.mts --key-file ~/keys/openai.txt --only lighting,look
 *   npx tsx scripts/render-examples.mts --only setting --ids beach,diner-booth --force
 *
 * Only missing pictures are rendered unless --force is given, so re-running
 * after adding an option costs one image. Needs `cwebp` (brew install webp) and
 * python3 with Pillow, for putting the sample card on the screens.
 *
 * The key is read from the environment or a file and is never printed.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  EXAMPLE_GALLERY_IDS,
  EXAMPLE_RENDER_SIZE,
  EXAMPLE_STORED_WIDTH,
  examplePrompts,
  exampleSrc,
} from "../src/lib/examples";

const MODEL = "gpt-image-2.5-flare";
const QUALITY = "medium";
const CONCURRENCY = 4;
/** Warps the sample card onto a render's blank screen, as the studio does. */
const COMPOSITE = "scripts/composite-example.py";
const CARD = "scripts/assets/sample-card.webp";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const keyFile = arg("key-file");
const key = (keyFile ? readFileSync(keyFile.replace(/^~/, process.env.HOME ?? ""), "utf8") : process.env.OPENAI_API_KEY ?? "").trim();
if (!key) {
  console.error("No key: set OPENAI_API_KEY or pass --key-file.");
  process.exit(1);
}

const only = arg("only")?.split(",");
const ids = arg("ids")?.split(",");
const force = process.argv.includes("--force");
const dry = process.argv.includes("--dry-run");

const jobs = EXAMPLE_GALLERY_IDS.filter((g) => !only || only.includes(g)).flatMap((gallery) =>
  examplePrompts(gallery)
    .filter((p) => !ids || ids.includes(p.optionId))
    .map((p) => ({ gallery, ...p, out: join("public", exampleSrc(gallery, p.optionId)) }))
    .filter((j) => force || !existsSync(j.out)),
);

console.log(`${jobs.length} to render${dry ? " (dry run)" : ""}.`);
if (dry) {
  for (const j of jobs) console.log(`\n# ${j.gallery}/${j.optionId}\n${j.prompt}`);
  process.exit(0);
}

async function render(prompt: string): Promise<Buffer> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        size: `${EXAMPLE_RENDER_SIZE.width}x${EXAMPLE_RENDER_SIZE.height}`,
        quality: QUALITY,
        n: 1,
      }),
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: { b64_json?: string }[] };
      const b64 = body.data?.[0]?.b64_json;
      if (b64) return Buffer.from(b64, "base64");
    }
    const detail = res.ok ? "no image in the response" : `${res.status} ${(await res.text()).slice(0, 200)}`;
    // Auth and bad requests will not fix themselves.
    if (res.status === 400 || res.status === 401 || res.status === 403 || attempt >= 3) {
      throw new Error(detail);
    }
    await new Promise((r) => setTimeout(r, 4000 * attempt));
  }
}

let cursor = 0;
let failed = 0;
const worker = async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor++];
    const label = `${job.gallery}/${job.optionId}`;
    try {
      const png = await render(job.prompt);
      const tmp = join(tmpdir(), `example-${job.gallery}-${job.optionId}.png`);
      writeFileSync(tmp, png);
      // The card goes on at full size, before the downscale softens the screen's edge.
      if (job.composite) execFileSync("python3", [COMPOSITE, tmp, CARD, tmp], { stdio: ["ignore", "ignore", "inherit"] });
      mkdirSync(dirname(job.out), { recursive: true });
      execFileSync("cwebp", ["-quiet", "-q", "80", "-resize", String(EXAMPLE_STORED_WIDTH), "0", tmp, "-o", job.out]);
      rmSync(tmp);
      console.log(`✓ ${label}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${label}: ${(err as Error).message}`);
    }
  }
};

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(failed ? `${failed} failed — re-run to retry just those.` : "Done.");
process.exit(failed ? 1 : 0);
