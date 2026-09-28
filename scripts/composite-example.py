#!/usr/bin/env python3
"""
Puts the sample card onto the blank screen of an example render.

    python3 scripts/composite-example.py <render.png> <card.png> <out.png>

The studio never asks the model to draw artwork on a phone; it renders a blank
white screen and warps the card onto it in the browser (src/lib/compose.ts).
The example pictures are finished the same way so they look like what people
actually get. Pillow only — no numpy — since this is a dev-time helper.

Exits 0 either way: a render with no findable screen (a "No people" flat lay
of a phone face-down, say) is written out untouched and reported on stderr.
"""

import sys
from collections import deque

from PIL import Image, ImageChops, ImageDraw, ImageFilter

WORK_W = 256


def white_mask(img: Image.Image, floor: int) -> Image.Image:
    """255 where a pixel is bright and colourless — the blank screen."""
    r, g, b = img.split()
    lo = ImageChops.darker(ImageChops.darker(r, g), b)
    hi = ImageChops.lighter(ImageChops.lighter(r, g), b)
    bright = lo.point(lambda v: 255 if v >= floor else 0)
    flat = ImageChops.subtract(hi, lo).point(lambda v: 255 if v <= 24 else 0)
    return ImageChops.multiply(bright, flat)


def largest_blob(mask: Image.Image):
    w, h = mask.size
    px = mask.load()
    seen = bytearray(w * h)
    best: list[tuple[int, int]] = []
    for y in range(h):
        for x in range(w):
            if px[x, y] == 0 or seen[y * w + x]:
                continue
            blob = []
            q = deque([(x, y)])
            seen[y * w + x] = 1
            while q:
                cx, cy = q.popleft()
                blob.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            if len(blob) > len(best):
                best = blob
    return best


def solve(a, b):
    """Gaussian elimination, for the 8x8 perspective system."""
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                for k in range(c, n + 1):
                    m[r][k] -= f * m[c][k]
    return [m[i][n] / m[i][i] for i in range(n)]


def perspective_coeffs(dst, src):
    """Coefficients mapping output points (dst) back to input points (src), as PIL wants."""
    a, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        b.append(u)
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        b.append(v)
    return solve(a, b)


def main():
    render_path, card_path, out_path = sys.argv[1:4]
    img = Image.open(render_path).convert("RGB")
    card = Image.open(card_path).convert("RGB")
    W, H = img.size

    # Relative floor, so a warm or dim screen still counts as the white one.
    lum = sorted(img.convert("L").resize((64, 80)).tobytes())
    floor = max(185, min(235, lum[int(len(lum) * 0.985)] - 18))

    scale = WORK_W / W
    small = img.resize((WORK_W, round(H * scale)))
    blob = largest_blob(white_mask(small, floor))
    if len(blob) < small.width * small.height * 0.012:
        img.save(out_path)
        print(f"no screen found in {render_path}", file=sys.stderr)
        return

    inv = 1 / scale
    tl = min(blob, key=lambda p: p[0] + p[1])
    br = max(blob, key=lambda p: p[0] + p[1])
    tr = max(blob, key=lambda p: p[0] - p[1])
    bl = min(blob, key=lambda p: p[0] - p[1])
    quad = [(x * inv, y * inv) for x, y in (tl, tr, br, bl)]

    # Rounded corners pull the extreme points inward; push them back out a
    # little. The white mask below keeps the card off the bezel regardless.
    cx = sum(p[0] for p in quad) / 4
    cy = sum(p[1] for p in quad) / 4
    quad = [(cx + (x - cx) * 1.06, cy + (y - cy) * 1.06) for x, y in quad]

    def dist(p, q):
        return ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) ** 0.5

    qw = (dist(quad[0], quad[1]) + dist(quad[3], quad[2])) / 2
    qh = (dist(quad[0], quad[3]) + dist(quad[1], quad[2])) / 2

    # Cover-fit the card to the screen's shape, landscape screens included.
    art = card if qw <= qh else card.rotate(90, expand=True)
    target = qw / qh
    aw, ah = art.size
    if aw / ah > target:
        nw = round(ah * target)
        art = art.crop(((aw - nw) // 2, 0, (aw - nw) // 2 + nw, ah))
    else:
        nh = round(aw / target)
        art = art.crop((0, (ah - nh) // 2, aw, (ah - nh) // 2 + nh))
    aw, ah = art.size

    coeffs = perspective_coeffs(quad, [(0, 0), (aw, 0), (aw, ah), (0, ah)])
    warped = art.transform((W, H), Image.Transform.PERSPECTIVE, coeffs, Image.Resampling.BICUBIC)

    region = Image.new("L", (W, H), 0)
    ImageDraw.Draw(region).polygon(quad, fill=255)
    mask = ImageChops.multiply(white_mask(img, floor - 25), region)
    # Close the pinholes glare leaves, grow a hair onto the bezel's soft edge.
    mask = mask.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(3))
    mask = ImageChops.multiply(mask, region).filter(ImageFilter.GaussianBlur(0.8))

    img.paste(warped, (0, 0), mask)
    img.save(out_path)


if __name__ == "__main__":
    main()
