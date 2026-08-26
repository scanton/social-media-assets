/**
 * Re-applies the local fixes to the vendored POP KIT.
 *
 *   node scripts/patch-popkit.mjs                 apply (idempotent)
 *   node scripts/patch-popkit.mjs --check         report unapplied, exit 1
 *   node scripts/patch-popkit.mjs --dir <path>    patch a skill tree instead
 *
 * The --dir form is how the fixes get INTO a skill package: point it at the
 * unpacked tree's assets/kit and the same edits land there, so v10 ships them
 * and the vendored copy stops being a fork.
 *
 * WHY THIS EXISTS
 * Three kit files carry fixes that have not landed in a .skill package yet.
 * sync-popkit.mjs copies files *out* of a skill, so any re-sync reverts them -
 * and describing the patches in prose is not enough, because prose cannot be
 * re-run. This is the executable form of src/lib/popkit/kit/LOCAL-PATCHES.md.
 * Run it after any sync until the fixes ship inside the skill, at which point
 * every patch here goes inert (each one no-ops when its marker is present) and
 * the file can be deleted.
 *
 * Every patch is additive: a new export, a new optional option, a new layer.
 * None rewrites existing behaviour, which is what the v10 spec requires.
 */
import fs from "node:fs";
import path from "node:path";

/** Where the kit lives. Defaults to the vendored copy; --dir targets a skill tree. */
const dirArg = process.argv.indexOf("--dir");
const KIT = dirArg > -1 ? process.argv[dirArg + 1] : "src/lib/popkit/kit";
const check = process.argv.includes("--check");

/** marker: a string that is present once the patch is applied */
const PATCHES = [
  {
    file: "finish.js",
    marker: "media fills the shape, not its safe area",
    why: "a well's media was clipped to the inner core, so a stamp's perforations did not mask it",
    apply(s) {
      return s.replace(
        "      `<clipPath id=\"${cid}\"><path d=\"${toPath(inset(s.core, s.W.key / 2))}\"/></clipPath>`,",
        "      /* media fills the shape, not its safe area.\n" +
        "\n" +
        "         `core` is where a GLYPH belongs: inside the drawn edge, clear of\n" +
        "         whatever the outline is doing. A well is the other thing. The\n" +
        "         picture is the subject and the frame is the mask, so it runs to\n" +
        "         the outline and the outline cuts it.\n" +
        "\n" +
        "         Identical on seventeen of the eighteen frames, where the two are\n" +
        "         the same path. `stamp` is the one that differs: its core is the\n" +
        "         inner rectangle and its outline is the perforated edge, so the\n" +
        "         picture sat in a box with a margin around it instead of being cut\n" +
        "         by the perforations. */\n" +
        "      `<clipPath id=\"${cid}\"><path d=\"${toPath(inset(s.pts, s.W.key / 2))}\"/></clipPath>`,",
      );
    },
  },
  {
    file: "media.js",
    marker: "export function wellLayout",
    why: "well geometry was inline in renderWell, so only its HTML output could use it",
    apply(s) {
      s = s.replace(
        "  const S = WELL_SHAPES[shape] || WELL_SHAPES.rounded;\n" +
        "  const key = C.k;\n" +
        "  const fs = Math.round(C.base * size * 0.62);\n" +
        "\n" +
        "  /* the well is sized off the canvas, not off the media. User media\n" +
        "     never dictates layout, or one tall clip reflows the whole frame. */\n" +
        "  const mediaW = Math.round(C.w * 0.34 * size);\n" +
        "  const mediaH = Math.round(mediaW / S.ratio);\n" +
        "  const lip = S.lip ? Math.round(mediaH * S.lip) : 0;\n" +
        "  const pad = Math.round(key * 1.6);\n" +
        "\n" +
        "  /* the caption is measured and wrapped before the frame is sized, so\n" +
        "     the box always fits its own copy. Sizing the frame first and hoping\n" +
        "     the text fits is how lower thirds end up with clipped descenders. */\n" +
        "  const lineH = Math.round(fs * 1.18);\n" +
        "  const capLines = caption ? wrapText(caption, fs, Math.round(mediaW * 0.94), 'sans') : [];\n" +
        "  const capH = caption ? capLines.length * lineH + Math.round(fs * 0.34) : 0;\n" +
        "  const kickFs = Math.round(fs * 0.7);\n" +
        "  const kickH = kicker ? Math.round(kickFs * 1.7) : 0;\n" +
        "\n" +
        "  const w = mediaW + pad * 2;\n" +
        "  const h = mediaH + lip + pad * 2 + capH + kickH;\n",
        "  /* one source of geometry, shared with wellSvg */\n" +
        "  const L = wellLayout(spec, C);\n" +
        "  const { S, key, fs, mediaW, mediaH, lip, pad, lineH, capLines, kickFs, w, h } =\n" +
        "    { ...L, S: L.shape };\n",
      );
      return s.replace(
        "export function renderWell(spec = {}, C, target = 'dom') {",
        WELL_GEOMETRY + "\nexport function renderWell(spec = {}, C, target = 'dom') {",
      );
    },
  },
  {
    file: "finish.js",
    marker: "export function outerReach",
    why: "medallion crop under-counted the border's outward reach",
    apply(s) {
      const at = "export function dress(fr, opts = {}) {";
      return s.replace(at, OUTER_REACH + at);
    },
  },
  {
    file: "captions.js",
    marker: "padL: padLOverride",
    why: "caption padding was one number for both ends",
    apply(s) {
      s = s.replace(
        "  padScale = 1, padX: padXOverride = null, padY: padYOverride = null\n} = {}) {",
        "  padScale = 1, padX: padXOverride = null, padY: padYOverride = null,\n  padL: padLOverride = null, padR: padROverride = null\n} = {}) {",
      );
      s = s.replace(
        "  const W = Math.round(textW + padX * 2);",
        "  /* PER-END PADDING. padX is one number for both ends, which is right\n" +
        "     until a medallion laps over one of them: closing the gap on that\n" +
        "     end with padX drags the far end in by the same amount and pushes\n" +
        "     the copy against it. padL/padR override one end at a time and\n" +
        "     default to padX, so nothing that does not ask for them changes. */\n" +
        "  const padLeft = Math.round(padLOverride ?? padX);\n" +
        "  const padRight = Math.round(padROverride ?? padX);\n" +
        "  const W = Math.round(textW + padLeft + padRight);",
      );
      s = s.replace(
        "  const c = { W, H, k, fill, ink, cream, accent, tail, padX, padY, line,\n              register:",
        "  const c = { W, H, k, fill, ink, cream, accent, tail, padX, padY, line,\n              padL: padLeft, padR: padRight,\n              register:",
      );
      return s.replace("    W, H, tx: padX, ty: padY, style,", "    W, H, tx: padLeft, ty: padY, style,");
    },
  },
  {
    file: "compose.js",
    marker: "const arrowsAt = arrows.map",
    why: "crop reach, per-end padding, the mid arrow layer, reported arrow positions",
    apply(s) {
      s = s.replace("import { dress } from './finish.js';", "import { dress, outerReach } from './finish.js';");
      s = s.replace(
        "    grow(mx - k, my - k, mx + medSize + k, my + medSize + k);",
        "    /* the dressed border paints proud of the medallion box, and by\n" +
        "       how much is a property of the medallion, not of the keyline:\n" +
        "       a sticker outline hangs ten frame units out, which is 46px on\n" +
        "       a 441px medallion against the 7px this used to allow. Growing\n" +
        "       by k alone sliced the top off the cream outline on every large\n" +
        "       nugget. Ask finish.js what it is about to paint instead. */\n" +
        "    const br = Math.max(k, outerReach({\n" +
        "      register: S.register || reg,\n" +
        "      weight: S.weight ?? o.borderWeight ?? 1,\n" +
        "      borders: S.borders\n" +
        "    }) * medSize / 100);\n" +
        "    grow(mx - br, my - br, mx + medSize + br, my + medSize + br);",
      );
      s = s.replace(
        "    padScale: o.captionPad ?? 1, padX: o.captionPadX ?? null, padY: o.captionPadY ?? null",
        "    padScale: o.captionPad ?? 1, padX: o.captionPadX ?? null, padY: o.captionPadY ?? null,\n" +
        "    padL: o.captionPadL ?? null, padR: o.captionPadR ?? null",
      );
      s = s.replace(
        "  const under = arrows.filter(a => !a.over).map(a => a.g);\n  const over = arrows.filter(a => a.over).map(a => a.g);",
        "  /* THREE LAYERS, not two. `over: false` tucks an arrow under the whole\n" +
        "     caption so its tail disappears beneath the shell, which is what a\n" +
        "     popup arrow wants -- until the arrow lies mostly over the caption,\n" +
        "     at which point the shell swallows it and only the tip shows. `over:\n" +
        "     true` cures that but puts the arrow over the medallion too. `layer:\n" +
        "     'mid'` is the one that was missing: above the shell, below the\n" +
        "     medallion, and still under the copy so it can never cover a word. */\n" +
        "  const layerOf = a => a.layer || (a.over ? 'over' : 'under');\n" +
        "  const under = arrows.filter(a => layerOf(a) === 'under').map(a => a.g);\n" +
        "  const mid = arrows.filter(a => layerOf(a) === 'mid').map(a => a.g);\n" +
        "  const over = arrows.filter(a => layerOf(a) === 'over').map(a => a.g);",
      );
      s = s.replace(
        "  parts.push(...under, capG, L ? L.g : '', R ? R.g : '', textG, ...over);",
        "  parts.push(...under, capG, ...mid, L ? L.g : '', R ? R.g : '', textG, ...over);",
      );
      s = s.replace(
        "    arrows.push({ g: built.g, over: a.over !== false, x: px, y: py, r: size * 1.05 });",
        "    arrows.push({ g: built.g, over: a.over !== false, layer: a.layer || null, x: px, y: py, r: size * 1.05 });",
      );
      /* Report where the arrows landed. compose() already knows -- it placed
         them -- but kept it internal, so anything checking an arrow against a
         protected region had to re-derive the layout, which is exactly what
         the spec says not to do. Positions come back in the cropped viewBox's
         own coordinates so a caller can map them straight onto the canvas.
         The editor and the render route then enforce the same rule from the
         same numbers. */
      return s.replace(
        "  return { svg, W: vb[2], H: vb[3], viewBox: vb, lines, capW: cap ? cap.W : 0, capH, medSize };",
        "  const arrowsAt = arrows.map(a => ({ x: f(a.x - vb[0]), y: f(a.y - vb[1]), r: f(a.r) }));\n" +
        "  return { svg, W: vb[2], H: vb[3], viewBox: vb, lines, capW: cap ? cap.W : 0, capH, medSize, arrows: arrowsAt };",
      );
    },
  },
];

const WELL_GEOMETRY = "/* ============================================================\n   THE GEOMETRY, ON ITS OWN\n\n   renderWell() worked its layout out inline and emitted HTML, which\n   is right for the DOM, Satori and Remotion and no use at all to\n   anything drawing on a canvas or rasterising an SVG. Pulling the\n   numbers out into wellLayout() lets a second renderer place a well\n   without a second opinion about where its parts go: renderWell now\n   asks the same function, so the two cannot drift.\n\n   wellSvg() is that second renderer. wellFrame already emitted SVG;\n   only the media and the copy were HTML, and both have SVG forms.\n   ============================================================ */\n\n/** Every measurement of a well, in px, for a given canvas. */\nexport function wellLayout(spec = {}, C) {\n  const {\n    shape = 'rounded', size = 1, caption = null, kicker = null,\n  } = spec;\n\n  const S = WELL_SHAPES[shape] || WELL_SHAPES.rounded;\n  const key = C.k;\n  const fs = Math.round(C.base * size * 0.62);\n\n  /* the well is sized off the canvas, not off the media. User media\n     never dictates layout, or one tall clip reflows the whole frame. */\n  const mediaW = Math.round(C.w * 0.34 * size);\n  const mediaH = Math.round(mediaW / S.ratio);\n  const lip = S.lip ? Math.round(mediaH * S.lip) : 0;\n  const pad = Math.round(key * 1.6);\n\n  /* the caption is measured and wrapped before the frame is sized, so\n     the box always fits its own copy. */\n  const lineH = Math.round(fs * 1.18);\n  const capLines = caption ? wrapText(caption, fs, Math.round(mediaW * 0.94), 'sans') : [];\n  const capH = caption ? capLines.length * lineH + Math.round(fs * 0.34) : 0;\n  const kickFs = Math.round(fs * 0.7);\n  const kickH = kicker ? Math.round(kickFs * 1.7) : 0;\n\n  const w = mediaW + pad * 2;\n  const h = mediaH + lip + pad * 2 + capH + kickH;\n  const sx = 11, sy = 13;                       /* the slab offsets */\n\n  return {\n    shape: S, key, fs, pad, lip,\n    mediaW, mediaH,\n    /* where the media sits inside the frame */\n    mediaX: pad, mediaY: pad,\n    radius: shape === 'disc' ? Math.min(w, h) / 2 : parseInt(S.radius, 10),\n    capLines, capH, lineH, kickFs, kickH,\n    /* the copy block, under the media and its lip */\n    textX: pad, textY: pad + mediaH + lip + Math.round(fs * 0.34),\n    /* the frame, and the box including its extrude */\n    w, h, sx, sy, outerW: w + sx, outerH: h + sy,\n  };\n}\n\n/**\n * A well as one self-contained SVG.\n *\n * The same thing renderWell() draws, in the form anything that\n * rasterises can use. A clip cannot live in an SVG <image>, so\n * `kind: 'video'` draws the poster if there is one and otherwise\n * leaves the media area empty for a renderer to fill.\n */\nexport function wellSvg(spec = {}, C) {\n  const L = wellLayout(spec, C);\n  const {\n    kind = 'image', src = '', poster = null, caption = null, kicker = null,\n    badge = null, fill = BRAND.cream, accent = BRAND.red, tilt = 0,\n  } = spec;\n\n  const still = kind === 'video' ? poster : src;\n  const cid = 'wm' + Math.random().toString(36).slice(2, 8);\n  const font = \"'PK Stack',sans-serif\";\n\n  const media = still\n    ? `<clipPath id=\"${cid}\"><rect x=\"${L.mediaX}\" y=\"${L.mediaY}\" width=\"${L.mediaW}\" height=\"${L.mediaH}\"\n         rx=\"${L.radius}\"/></clipPath>\n       <g clip-path=\"url(#${cid})\"><image href=\"${still}\" x=\"${L.mediaX}\" y=\"${L.mediaY}\"\n         width=\"${L.mediaW}\" height=\"${L.mediaH}\" preserveAspectRatio=\"xMidYMid slice\"/></g>`\n    : '';\n\n  let y = L.textY;\n  let copy = '';\n  if (kicker) {\n    y += L.kickFs;\n    copy += `<text x=\"${L.textX}\" y=\"${y}\" font-family=\"${font}\" font-weight=\"700\"\n      font-size=\"${L.kickFs}\" letter-spacing=\"${L.kickFs * 0.14}\" fill=\"${accent}\"\n      >${esc(String(kicker).toUpperCase())}</text>`;\n    y += Math.round(L.kickFs * 0.7);\n  }\n  for (const line of L.capLines) {\n    y += L.lineH;\n    copy += `<text x=\"${L.textX}\" y=\"${y - Math.round(L.fs * 0.28)}\" font-family=\"${font}\"\n      font-weight=\"700\" font-size=\"${L.fs}\" fill=\"${INK}\">${esc(line)}</text>`;\n  }\n\n  const badgeEl = badge ? (() => {\n    const bh = Math.round(L.fs * 1.5);\n    const bfs = Math.round(L.fs * 0.66);\n    const bw = Math.round(String(badge.text || 'LIVE').length * bfs * 0.78 + L.fs * 1.6);\n    const bx = L.pad + 10, by = L.pad + 10;\n    return `<rect x=\"${bx}\" y=\"${by}\" width=\"${bw}\" height=\"${bh}\" rx=\"${bh / 2}\"\n        fill=\"${badge.bg || accent}\" stroke=\"${INK}\" stroke-width=\"${Math.max(3, Math.round(L.key * 0.6))}\"/>\n      <text x=\"${bx + L.fs * 0.5}\" y=\"${by + bh / 2 + bfs * 0.36}\" font-family=\"${font}\"\n        font-weight=\"700\" font-size=\"${bfs}\" letter-spacing=\"${bfs * 0.1}\" fill=\"${BRAND.cream}\"\n        >${esc(String(badge.text || 'LIVE').toUpperCase())}</text>`;\n  })() : '';\n\n  /* wellFrame draws its own <svg>; take its guts so this is one document */\n  const frame = wellFrame({\n    w: L.w, h: L.h, key: L.key, ink: INK, fill,\n    extrude: spec.extrude || 'slab', radius: L.radius, sx: L.sx, sy: L.sy,\n  }).replace(/^<svg[^>]*>/, '').replace(/<\\/svg>$/, '');\n\n  const spin = tilt ? ` transform=\"rotate(${tilt} ${L.outerW / 2} ${L.outerH / 2})\"` : '';\n  return `<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"${L.outerW}\" height=\"${L.outerH}\"\n    viewBox=\"0 0 ${L.outerW} ${L.outerH}\" fill=\"none\"><g${spin}>${frame}${media}${copy}${badgeEl}</g></svg>`;\n}\n\n";

const OUTER_REACH = `/* ---------- how far a dressed frame paints outside its box ----
   Every treatment above is drawn against the 0..100 frame box, and
   several of them paint PROUD of it: a sticker outline is a stroke
   centred on the edge, so half of it hangs outside; a slab is the
   whole shape shifted and redrawn; a glow is a blur. Anything that
   crops to a dressed medallion has to know that reach or it slices
   off the very outline that makes the medallion read as a sticker.

   Answered in FRAME UNITS, so a caller scales it exactly the way it
   scales the medallion itself. That is the point: the reach grows
   with the shape, and a fixed pixel margin cannot track it.

   Symmetric, and generous by a unit or two. A slab only reaches
   down and right, but a bound that is slightly large on one side is
   invisible, and one that is short is a cut border. */
export function outerReach(opts = {}) {
  const wt = opts.weight ?? 1;
  const w = wt === 1 ? W : Object.fromEntries(Object.entries(W).map(([k, v]) => [k, v * wt]));
  const reg = REGISTERS[opts.register || 'sticker'] || REGISTERS.sticker;
  const list = (opts.borders || reg.borders)
    .map(b => (typeof b === 'string' ? [b, {}] : [b.name, b]));

  /* a Gaussian tail is spent by three standard deviations */
  const BLUR = 3;

  /* only the treatments that leave the box. gold, double, stitch,
     tick and emboss are all inset, so they never widen anything. */
  const OUT = {
    slab:    o => Math.max(o.x ?? w.slabX, o.y ?? w.slabY) + (w.key + (o.grow ?? 0)) / 2,
    drop:    o => Math.max(o.x ?? 1.6, o.y ?? 2.6) + BLUR * (o.blur ?? w.dropB),
    glow:    o => (o.spread ?? 2.4) + BLUR * (o.blur ?? w.glowB),
    sticker: o => (o.w ?? w.sticker) + w.key,
    gap:     o => (o.out ?? w.gapOut) + (o.w ?? w.gap) / 2,
    key:     o => (o.w ?? w.key) / 2,
    keyFat:  o => (o.w ?? w.keyFat) / 2,
    hair:    o => (o.w ?? w.hair) / 2
  };

  let r = 0;
  for (const [name, o] of list) if (OUT[name]) r = Math.max(r, OUT[name](o || {}));
  return r;
}

`;

let missing = 0;
for (const p of PATCHES) {
  const target = path.join(KIT, p.file);
  if (!fs.existsSync(target)) {
    // Not every kit file is vendored into every tree; a patch for one that is
    // absent is not applicable rather than a failure.
    console.log(`  skip  ${p.file}  not in ${KIT}`);
    continue;
  }
  const before = fs.readFileSync(target, "utf8");

  if (before.includes(p.marker)) {
    console.log(`  ok    ${p.file}  already patched`);
    continue;
  }
  if (check) {
    missing++;
    console.error(`UNPATCHED  ${p.file}  ${p.why}`);
    continue;
  }

  const after = p.apply(before);
  if (!after.includes(p.marker)) {
    console.error(`FAILED  ${p.file}  the anchors this patch edits are not in the file.`);
    process.exit(2);
  }
  fs.writeFileSync(target, after);
  console.log(`patched ${p.file}  ${p.why}`);
}

if (check && missing) {
  console.error(`\n${missing} patch(es) missing. Run: node scripts/patch-popkit.mjs`);
  process.exit(1);
}
