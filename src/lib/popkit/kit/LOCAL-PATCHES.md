# Local patches to the vendored kit

**Status: none outstanding.** Everything in this directory is byte-identical to
`heartstamp-pop-kit_v10.skill`, and `node scripts/sync-popkit.mjs <skill>
--check` proves it.

The four fixes below were carried here as local patches while v10 was being
built. They now ship inside the skill, so `scripts/patch-popkit.mjs` is inert:
every patch no-ops when its marker is present, and it is kept only so the same
edits can be re-applied to a future skill tree with `--dir`.

Two guards remain, and should stay:

- `sync-popkit.mjs` refuses to overwrite a file edited here since the last sync
  (`--force` to discard). A sync silently reverted all three of these once.
- `patch-popkit.mjs --check` reports any that have gone missing.

## What v10 added to the kit

### `finish.js` — a well's media fills the shape

`fillLayer` clipped media to the inset **core**. `core` is where a *glyph*
belongs: inside the drawn edge, clear of whatever the outline is doing. A well
is the other thing, where the picture is the subject and the frame is the mask,
so it should run to the outline and be cut by it.

Identical on seventeen of the eighteen frames, where core and outline are the
same path. `stamp` is the one that differs: its core is the inner rectangle and
its outline is the perforated edge, so a picture sat in a box with a margin
around it instead of being cut by the perforations.

### `media.js` — the well geometry, on its own

`renderWell()` worked its layout out inline and emitted HTML, which is right for
the DOM, Satori and Remotion and no use at all to anything drawing on a canvas
or rasterising an SVG. Since a well is not square (16:9, 9:16, 4:3, 4:5, and a
polaroid with a caption lip), `compose()`'s square medallion could not express
one at any size, so a second renderer was unavoidable.

`wellLayout(spec, C)` returns every measurement; `renderWell` now asks it rather
than working them out, so the two cannot drift. Verified byte-identical output
across all ten templates after the extraction.

`wellSvg(spec, C)` is the second renderer. `wellFrame` already emitted SVG; only
the media and the copy were HTML, and both have SVG forms. That one function
serves the editor preview, the browser video renderer and the skill's render
route.

### `finish.js` + `compose.js` — the medallion crop

`compose()` cropped to its content by growing the medallion's box by `k`, the
canvas keyline (7px on reels). But `dress()` paints border treatments *outside*
that box by an amount measured in frame units, so it scales with the medallion
rather than with the keyline:

| register      | outward reach | at a 441px medallion |
| ------------- | ------------- | -------------------- |
| `letterpress` | 2.9u          | 13px                 |
| `flat`        | 1.7u          | 7px                  |
| `sticker`     | 10.4u         | **46px**             |
| `chrome`      | 11.6u         | **51px**             |
| `neon`        | 17.4u         | **77px**             |

Against the 18px the old crop allowed (`k` plus the default `pad`), every
register but `flat` and `letterpress` had its outermost border sliced off. On
the default `sticker` register that is the cream outline, cut flat across the
top of the medallion.

`finish.js` gained `outerReach(opts)`, which reports how far a dressed frame
paints outside its box in frame units; `compose.js` asks it instead of assuming
`k`. `outerReach` is the honest place for it: the treatments are defined in
`finish.js`, so it is the only module that can answer without duplicating the
weight table.

### `captions.js` + `compose.js` — per-end caption padding

`caption()` took one `padX` and applied it to both ends (`W = textW + padX * 2`,
`tx = padX`). A medallion laps over one end, and its distance to the copy is
`padX + k * 1.6`, a constant whatever size the medallion is. Closing that gap by
lowering `padX` dragged the far end in by the same amount and pushed the copy
against it.

`caption()` now also takes `padL` / `padR`, each defaulting to `padX`, and
`compose()` passes them as `captionPadL` / `captionPadR`.

### `compose.js` — a third arrow layer

Arrows had two layers: `over: false` drew them before the caption, `over: true`
after everything. `arrows.md` recommends the former for a popup arrow so the tail
tucks under the shell, but an arrow lying mostly *over* the caption is then
swallowed by it. At a 250 degree bearing off a right-hand medallion it vanished
completely.

`layer: 'mid'` draws between the caption shell and the medallions, so the arrow
reads against the caption, sits under the medallion, and stays beneath the copy
where it can never cover a word. `over` is still honoured when `layer` is absent.

### `compose.js` — reported arrow positions

`compose()` knew where it put each arrow and kept it internal, so anything
checking an arrow against a protected region had to re-derive the layout. It now
returns `arrows: [{x, y, r}]` in the cropped viewBox's coordinates. The builder
and `scripts/render-deck.js` enforce the clearance rule from the same numbers.
