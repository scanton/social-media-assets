/**
 * Submits nothing, but asks the question a submit would.
 *
 * The studio describes a job once — prompt, references, 1080p, eight seconds,
 * 9:16 — and `lib/model-input.ts` projects that onto whatever model was picked.
 * When the projection is wrong fal rejects the job, and the only way anyone
 * found out was a user spending a click on it:
 *
 *   duration: Input should be a valid integer, unable to parse string as an
 *   integer, input: "auto"
 *
 * That was eight models, not one. `duration` is a string enum on the model this
 * pipeline grew up around and a plain integer on Gemini, MiniMax, Grok and
 * Pixverse, and a string aimed at an integer field fell straight through the
 * adapter untouched.
 *
 * So this walks fal's catalogue, adapts each of the three workflows' real
 * payloads against each model's real schema, and validates every property that
 * comes out the other side. It is the check that would have caught it.
 *
 *   node scripts/check-model-inputs.mjs           # every category
 *   node scripts/check-model-inputs.mjs --limit 20
 *
 * Not part of `pnpm build`. It reads a few hundred schemas over the network,
 * which is not something a build should depend on being up.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "..");
const LIMIT = Number(process.argv[process.argv.indexOf("--limit") + 1]) || 60;

/* The three workflows, as they actually submit. Keep in step with the payloads
 * in studio-store.tsx and Freeform.tsx — a drifting copy here reports success
 * for a shape nothing sends. */
const PAYLOADS = {
  "video · digital + printed screen-replace": {
    prompt: "p", image_urls: ["u"], video_urls: ["u"],
    resolution: "1080p", duration: "auto", aspect_ratio: "9:16",
    generate_audio: true, bitrate_mode: "high",
  },
  "video · printed motion": {
    prompt: "p", image_url: "u",
    resolution: "1080p", duration: "auto", aspect_ratio: "9:16",
    generate_audio: true, bitrate_mode: "high",
  },
  "image · printed scene": {
    prompt: "p", image_urls: ["u"],
    image_size: { width: 1024, height: 1024 }, num_images: 1, quality: "medium",
  },
};

const CATEGORIES = [
  ["image-to-video", ["video · digital + printed screen-replace", "video · printed motion"]],
  ["image-to-image", ["image · printed scene"]],
  ["text-to-image", ["image · printed scene"]],
];

/* ------------------------- the adapter under test ------------------------- */

function loadAdapter() {
  const dir = mkdtempSync(path.join(tmpdir(), "modelcheck-"));
  const entry = path.join(dir, "lib", "model-input.js");
  /*
   * A real tsconfig rather than bare flags: the adapter imports through the
   * `@/` alias, which only exists as a `paths` mapping. Absolute paths
   * throughout so the file can live in a temp directory.
   */
  const config = path.join(dir, "tsconfig.json");
  writeFileSync(config, JSON.stringify({
    compilerOptions: {
      outDir: dir,
      rootDir: path.join(ROOT, "src"),
      module: "commonjs",
      moduleResolution: "node",
      target: "es2022",
      skipLibCheck: true,
      baseUrl: ROOT,
      paths: { "@/*": ["src/*"] },
    },
    files: [path.join(ROOT, "src/lib/model-input.ts")],
  }));

  try {
    execFileSync(path.join(ROOT, "node_modules/.bin/tsc"), ["-p", config], { cwd: ROOT, stdio: "pipe" });
  } catch (e) {
    /*
     * tsc emits even when it complains, and the complaints here are about
     * Next-specific types this standalone compile has no reason to know
     * (`next` on RequestInit). What matters is whether the adapter came out.
     */
    if (!existsSync(entry)) {
      console.error("could not compile the adapter.\n");
      console.error((e.stdout?.toString() ?? "").trim() || e.message);
      process.exit(1);
    }
  }

  /*
   * `paths` is a resolution rule, not an emit rule: tsc type-checks `@/lib/x`
   * and then writes `require("@/lib/x")` into the output, which Node cannot
   * resolve. Rewriting the emitted requires is the smallest fix that does not
   * involve copying sources somewhere and editing them.
   */
  for (const file of readdirSync(path.join(dir, "lib"))) {
    if (!file.endsWith(".js")) continue;
    const js = path.join(dir, "lib", file);
    const src = readFileSync(js, "utf8").replace(
      /require\("@\/([^"]+)"\)/g,
      (_m, rest) => {
        const target = path.join(dir, rest);
        let rel = path.relative(path.dirname(js), target);
        if (!rel.startsWith(".")) rel = `./${rel}`;
        return `require("${rel}")`;
      },
    );
    writeFileSync(js, src);
  }

  try {
    return createRequire(import.meta.url)(entry);
  } finally {
    // Required already; the files are no longer needed.
    setTimeout(() => rmSync(dir, { recursive: true, force: true }), 0).unref?.();
  }
}

/* ------------------------------ validation -------------------------------- */

const branches = (p) => (p.anyOf?.length ? [p, ...p.anyOf] : [p]);

/** Would fal's own validator accept this value for this property? */
function legal(value, prop) {
  for (const b of branches(prop)) {
    if (Array.isArray(b.enum) && b.enum.length) {
      if (b.enum.includes(value)) return true;
      continue;
    }
    switch (b.type) {
      case "integer": if (typeof value === "number" && Number.isInteger(value)) return true; break;
      case "number":  if (typeof value === "number") return true; break;
      case "string":  if (typeof value === "string") return true; break;
      case "boolean": if (typeof value === "boolean") return true; break;
      case "array":   if (Array.isArray(value)) return true; break;
      case "object":  if (value && typeof value === "object" && !Array.isArray(value)) return true; break;
      case "null":    if (value === null) return true; break;
      // A branch we cannot read is a $ref. Unreadable is not the same as
      // disproved, so it counts as acceptable rather than failing the model.
      default: return true;
    }
  }
  return false;
}

async function schemaFor(id) {
  try {
    const r = await fetch(`https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=${id}`);
    if (!r.ok) return null;
    const d = await r.json();
    const s = d?.components?.schemas ?? {};
    const k = Object.keys(s).find((x) => x.toLowerCase().endsWith("input"));
    return k ? s[k] : null;
  } catch {
    return null;
  }
}

async function listModels(category) {
  const r = await fetch(`https://fal.ai/api/models?categories=${category}&page_size=${LIMIT}`);
  if (!r.ok) return [];
  const d = await r.json();
  return (d.items ?? []).map((m) => m.id);
}

/* --------------------------------- main ----------------------------------- */

const { adaptInput } = loadAdapter();
const problems = [];
let pairs = 0;
let unreachable = 0;

for (const [category, payloadNames] of CATEGORIES) {
  const ids = await listModels(category);
  process.stdout.write(`${category}: ${ids.length} models`);
  for (const id of ids) {
    const schema = await schemaFor(id);
    if (!schema) { unreachable++; continue; }
    for (const name of payloadNames) {
      pairs++;
      const { input } = adaptInput(PAYLOADS[name], schema);
      for (const [key, value] of Object.entries(input)) {
        const prop = schema.properties[key];
        if (prop && !legal(value, prop)) {
          problems.push({ id, name, key, value, prop });
        }
      }
    }
  }
  process.stdout.write(`  ✓\n`);
}

console.log(`\nchecked ${pairs} model/payload pairs${unreachable ? ` (${unreachable} schemas unreachable)` : ""}`);

if (!problems.length) {
  console.log("ok    every property the studio sends validates against its model's schema");
  process.exit(0);
}

console.error(`\n${problems.length} value(s) fal would reject:\n`);
for (const p of problems) {
  const want = JSON.stringify({ type: p.prop.type, enum: p.prop.enum }).slice(0, 90);
  console.error(`  ${p.id}`);
  console.error(`    ${p.name}`);
  console.error(`    ${p.key} = ${JSON.stringify(p.value)}   schema wants ${want}\n`);
}
process.exit(1);
