/* ============================================================
   HeartStamp POP KIT - FRAMES
   ------------------------------------------------------------
   A medallion is not a circle. A medallion is a SHAPE, a BORDER
   TREATMENT and a FILL, and any of the three can change without
   the other two knowing.

   This module owns the first of those. Every frame is authored in
   a 0..100 box, so a diamond and a heart and a postage stamp are
   interchangeable at the call site, and everything downstream
   (borders, media clips, arrow anchors) works in the same units.

   frame(name, opts) -> { d, pts, cx, cy, name }

     d    the path, ready to draw
     pts  the same outline flattened to a polyline, which is what
          makes the rest of the system general: you can offset it
          for an inset ring, ray-cast it for an arrow anchor, and
          measure it, without knowing which shape it is

   AUTHORING RULE: absolute M / L / Q / C / Z only. No arcs. A
   circle here is four cubics. That is not pedantry, it is what
   lets one 40-line flattener serve all eighteen shapes.
   ============================================================ */

const K = 0.5522847498;                 /* circle-from-cubics constant */
const f = n => Math.round(n * 1000) / 1000;
const P = (x, y) => `${f(x)} ${f(y)}`;

/* ---------- flattener --------------------------------------
   Parses the subset above and returns a dense polyline. 18 steps
   per curve is enough that a 512px render shows no facets and a
   44px render could not care less.
   ------------------------------------------------------------ */
export function flatten(d, steps = 18) {
  const t = d.match(/[MLQCZ]|-?\d*\.?\d+/gi) || [];
  const pts = [];
  let i = 0, cur = [0, 0], start = [0, 0], cmd = 'M';
  const num = () => parseFloat(t[i++]);
  while (i < t.length) {
    const tok = t[i];
    if (/[MLQCZ]/i.test(tok)) { cmd = tok.toUpperCase(); i++; }
    if (cmd === 'Z') { cur = start.slice(); cmd = 'M'; continue; }
    if (cmd === 'M') { cur = [num(), num()]; start = cur.slice(); pts.push(cur.slice()); cmd = 'L'; continue; }
    if (cmd === 'L') { cur = [num(), num()]; pts.push(cur.slice()); continue; }
    if (cmd === 'Q') {
      const c = [num(), num()], e = [num(), num()], s = cur;
      for (let k = 1; k <= steps; k++) {
        const u = k / steps, v = 1 - u;
        pts.push([v * v * s[0] + 2 * v * u * c[0] + u * u * e[0],
                  v * v * s[1] + 2 * v * u * c[1] + u * u * e[1]]);
      }
      cur = e; continue;
    }
    if (cmd === 'C') {
      const a = [num(), num()], b = [num(), num()], e = [num(), num()], s = cur;
      for (let k = 1; k <= steps; k++) {
        const u = k / steps, v = 1 - u;
        pts.push([v*v*v*s[0] + 3*v*v*u*a[0] + 3*v*u*u*b[0] + u*u*u*e[0],
                  v*v*v*s[1] + 3*v*v*u*a[1] + 3*v*u*u*b[1] + u*u*u*e[1]]);
      }
      cur = e; continue;
    }
    i++;
  }
  /* Dedupe. A flattened closed shape ends where it started, and a
     duplicated vertex has a zero-length edge, which gives the
     offsetter a normal of NaN and puts a spike through the middle
     of every inset ring. This one line is the whole fix. */
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-4) out.push(p);
  }
  while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 1e-4) out.pop();
  return out;
}

export function area(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
}

export function centroid(pts) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const cr = p[0] * q[1] - q[0] * p[1];
    a += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr;
  }
  a /= 2;
  return Math.abs(a) < 1e-9 ? [50, 50] : [cx / (6 * a), cy / (6 * a)];
}

/* ---------- inward offset ----------------------------------
   Every inset ring, gold band, stitch line and media clip in the
   kit comes from here. Offsetting the FLATTENED outline rather
   than the path is what makes "gold band on a heart" cost nothing
   extra over "gold band on a circle".

   Vertex-bisector offset, with the step clamped. Without the
   clamp a 30-degree corner (the bottom of a triangle, the point
   of a diamond) throws a spike halfway across the frame.
   ------------------------------------------------------------ */
export function inset(pts, t) {
  if (t === 0) return pts.slice();
  const a = _offset(pts, t, 1), b = _offset(pts, t, -1);
  /* whichever shrank is the one that went inward. Cheaper and far
     more reliable than reasoning about winding order per shape. */
  return Math.abs(area(a)) < Math.abs(area(b)) ? a : b;
}

function _offset(pts, t, sign) {
  const n = pts.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const e1 = [p[0] - a[0], p[1] - a[1]], e2 = [b[0] - p[0], b[1] - p[1]];
    const l1 = Math.hypot(...e1) || 1, l2 = Math.hypot(...e2) || 1;
    /* inward normals */
    const n1 = [ sign * e1[1] / l1, -sign * e1[0] / l1];
    const n2 = [ sign * e2[1] / l2, -sign * e2[0] / l2];
    let bx = n1[0] + n2[0], by = n1[1] + n2[1];
    const bl = Math.hypot(bx, by);
    if (bl < 1e-6) { out.push(p.slice()); continue; }
    bx /= bl; by /= bl;
    const cos = Math.max(0.30, bx * n1[0] + by * n1[1]);
    const step = Math.min(t / cos, t * 3);
    out.push([p[0] + bx * step, p[1] + by * step]);
  }
  return out;
}

/* outward offset. Same machinery, opposite pick. Used by the gap
   ring, the sticker keyline and the glow. */
export function outset(pts, t) {
  if (t === 0) return pts.slice();
  const a = _offset(pts, t, 1), b = _offset(pts, t, -1);
  return Math.abs(area(a)) > Math.abs(area(b)) ? a : b;
}

/* point in polygon, ray crossing */
export function contains(pts, x, y) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi) inside = !inside;
  }
  return inside;
}

/* ---------- safe area ---------------------------------------
   The largest box, centred on the frame's centroid, that fits
   entirely inside the shape. This is what makes "any glyph in any
   frame" a real claim rather than a hopeful one: a triangle's safe
   area is genuinely smaller than a disc's, and the system knows
   it, so a hand gesture dropped into a triangle is scaled down
   instead of poking out of the point.
   ------------------------------------------------------------ */
export function safeBox(pts, aspect = 1, at = null) {
  const [cx, cy] = at || centroid(pts);
  let lo = 0, hi = 100;
  const fits = s => {
    const hw = (s * aspect) / 2, hh = s / 2;
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      if (!contains(pts, cx - hw + 2 * hw * u, cy - hh)) return false;
      if (!contains(pts, cx - hw + 2 * hw * u, cy + hh)) return false;
      if (!contains(pts, cx - hw, cy - hh + 2 * hh * u)) return false;
      if (!contains(pts, cx + hw, cy - hh + 2 * hh * u)) return false;
    }
    return true;
  };
  for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
  return { cx, cy, w: lo * aspect, h: lo };
}

export const toPath = pts =>
  pts.map((p, i) => `${i ? 'L' : 'M'} ${P(p[0], p[1])}`).join(' ') + ' Z';

/* ---------- anchors ----------------------------------------
   Where an arrow attaches. Cast a ray from the centroid at the
   given bearing and return the point where it leaves the shape.
   Bearing is clock-face degrees: 0 is up, 90 is right, so
   "arrow off the 4 o'clock" is a number a designer can say out
   loud. Works on a star and a heart, not just a disc.
   ------------------------------------------------------------ */
export function anchor(pts, bearing) {
  const [cx, cy] = centroid(pts);
  const a = (bearing - 90) * Math.PI / 180;
  const dx = Math.cos(a), dy = Math.sin(a);
  let best = null, bestT = -1;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const ex = q[0] - p[0], ey = q[1] - p[1];
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((p[0] - cx) * ey - (p[1] - cy) * ex) / den;
    const u = ((p[0] - cx) * dy - (p[1] - cy) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1 && t > bestT) { bestT = t; best = [cx + dx * t, cy + dy * t]; }
  }
  return best || [cx, cy];
}

/* ============================================================
   THE SHAPES
   ============================================================ */

/* rounded polygon: cut each corner back and turn it with a Q */
function roundPoly(v, r) {
  const n = v.length; let d = '';
  for (let i = 0; i < n; i++) {
    const p = v[i], a = v[(i - 1 + n) % n], b = v[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ca = Math.min(r, la / 2), cb = Math.min(r, lb / 2);
    const p1 = [p[0] + (a[0] - p[0]) * ca / la, p[1] + (a[1] - p[1]) * ca / la];
    const p2 = [p[0] + (b[0] - p[0]) * cb / lb, p[1] + (b[1] - p[1]) * cb / lb];
    d += `${i ? 'L' : 'M'} ${P(p1[0], p1[1])} Q ${P(p[0], p[1])} ${P(p2[0], p2[1])} `;
  }
  return d + 'Z';
}

function ellipse(cx, cy, rx, ry) {
  const ox = rx * K, oy = ry * K;
  return `M ${P(cx, cy - ry)} C ${P(cx + ox, cy - ry)} ${P(cx + rx, cy - oy)} ${P(cx + rx, cy)}
          C ${P(cx + rx, cy + oy)} ${P(cx + ox, cy + ry)} ${P(cx, cy + ry)}
          C ${P(cx - ox, cy + ry)} ${P(cx - rx, cy + oy)} ${P(cx - rx, cy)}
          C ${P(cx - rx, cy - oy)} ${P(cx - ox, cy - ry)} ${P(cx, cy - ry)} Z`;
}

function rrect(x, y, w, h, r) {
  return roundPoly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r);
}

function poly(n, R, rot, cx = 50, cy = 50, squash = 1) {
  const v = [];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + (rot * Math.PI) / 180 - Math.PI / 2;
    v.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R * squash]);
  }
  return v;
}

const SHAPES = {

  /* --- F01 disc. The one everything else is measured against. */
  circle: () => ellipse(50, 50, 48, 48),

  /* --- F02 oval. Portrait. Faces and full figures. */
  oval: () => ellipse(50, 50, 40, 48),

  /* --- F03 capsule. Wide. Screen grabs, before-and-afters. */
  capsule: () => rrect(1, 20, 98, 60, 30),

  /* --- F04 squircle. A true superellipse, not a rounded box.
     The corner never stops turning, which is why it sits beside
     a disc without arguing with it. */
  squircle: () => {
    const N = 72, R = 48, e = 2 / 4.2;
    let d = '';
    for (let i = 0; i <= N; i++) {
      const a = (Math.PI * 2 * i) / N;
      const x = 50 + Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), e) * R;
      const y = 50 + Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), e) * R;
      d += `${i ? 'L' : 'M'} ${P(x, y)} `;
    }
    return d + 'Z';
  },

  /* --- F05 square. Small radius. The reference frames use this
     for anything quoted, asked or filed. */
  square: () => rrect(3, 3, 94, 94, 9),

  /* --- F06 diamond. Same square, stood on its point. Reads as
     alert, reveal, gemstone. Cheapest energy in the set. */
  diamond: () => roundPoly(poly(4, 50, 0), 10),

  /* --- F07 heart. Ours by right. */
  heart: () => `M ${P(50, 93)}
    C ${P(20, 71)} ${P(3, 53)} ${P(3, 34)}
    C ${P(3, 17)} ${P(15, 6)} ${P(29, 6)}
    C ${P(39, 6)} ${P(46, 12)} ${P(50, 21)}
    C ${P(54, 12)} ${P(61, 6)} ${P(71, 6)}
    C ${P(85, 6)} ${P(97, 17)} ${P(97, 34)}
    C ${P(97, 53)} ${P(80, 71)} ${P(50, 93)} Z`,

  /* --- F08 triangle, point up. Warning, tip, heads-up. */
  triangle: () => roundPoly([[50, 4], [96, 88], [4, 88]], 13),

  /* --- F09 triangle, point down. Play, drop, "look below". */
  triangleDown: () => roundPoly([[4, 12], [96, 12], [50, 96]], 13),

  /* --- F10 shield. Guarantee, protection, print promise. */
  shield: () => `M ${P(12, 14)} Q ${P(12, 6)} ${P(20, 6)} L ${P(80, 6)}
    Q ${P(88, 6)} ${P(88, 14)} L ${P(88, 48)}
    C ${P(88, 72)} ${P(72, 86)} ${P(50, 96)}
    C ${P(28, 86)} ${P(12, 72)} ${P(12, 48)} Z`,

  /* --- F11 hexagon, flat top. Systems, specs, the technical beat. */
  hexagon: () => roundPoly(poly(6, 50, 90, 50, 50, 0.92), 9),

  /* --- F12 rosette. Twelve scallops. Award, seal, "we mean it". */
  rosette: () => {
    const n = 12, R = 41, b = 9;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a0 = (Math.PI * 2 * i) / n - Math.PI / 2;
      const a1 = (Math.PI * 2 * (i + 1)) / n - Math.PI / 2;
      const am = (a0 + a1) / 2;
      const p0 = [50 + Math.cos(a0) * R, 50 + Math.sin(a0) * R];
      const p1 = [50 + Math.cos(a1) * R, 50 + Math.sin(a1) * R];
      const pm = [50 + Math.cos(am) * (R + b) * 1.16, 50 + Math.sin(am) * (R + b) * 1.16];
      d += `${i ? '' : `M ${P(p0[0], p0[1])} `}Q ${P(pm[0], pm[1])} ${P(p1[0], p1[1])} `;
    }
    return d + 'Z';
  },

  /* --- F13 ticket. Bitten at the waist. Offers, codes, credits.
     The bites are cubics, not arcs, so the flattener sees them.  */
  ticket: () => `M ${P(16, 13)} L ${P(84, 13)} Q ${P(96, 13)} ${P(96, 25)} L ${P(96, 38)}
    C ${P(84, 41)} ${P(84, 59)} ${P(96, 62)} L ${P(96, 75)}
    Q ${P(96, 87)} ${P(84, 87)} L ${P(16, 87)} Q ${P(4, 87)} ${P(4, 75)} L ${P(4, 62)}
    C ${P(16, 59)} ${P(16, 41)} ${P(4, 38)} L ${P(4, 25)} Q ${P(4, 13)} ${P(16, 13)} Z`,

  /* --- F14 pennant. Points down at what it is talking about, so
     it needs no arrow at all. */
  pennant: () => roundPoly([[6, 8], [94, 8], [94, 62], [50, 96], [6, 62]], 8),

  /* --- F15 arch. Tombstone. Portraits, keepsakes, the sincere
     register where a hard corner would feel clinical. */
  arch: () => `M ${P(8, 90)} L ${P(8, 46)}
    C ${P(8, 20)} ${P(27, 5)} ${P(50, 5)}
    C ${P(73, 5)} ${P(92, 20)} ${P(92, 46)} L ${P(92, 90)}
    Q ${P(92, 96)} ${P(86, 96)} L ${P(14, 96)} Q ${P(8, 96)} ${P(8, 90)} Z`,

  /* --- F16 burst. Twelve points, softened. New, free, sale,
     the loudest thing we will print. */
  burst: () => {
    const v = [];
    for (let i = 0; i < 24; i++) {
      const a = (Math.PI * 2 * i) / 24 - Math.PI / 2;
      const r = i % 2 ? 33 : 49;
      v.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
    }
    return roundPoly(v, 4);
  },

  /* --- F17 blob. Nothing on it is straight or repeated. The
     soft register, and the antidote to a screen full of geometry. */
  blob: () => `M ${P(54, 3)}
    C ${P(76, 2)} ${P(94, 15)} ${P(96, 34)}
    C ${P(98, 50)} ${P(87, 60)} ${P(85, 74)}
    C ${P(83, 91)} ${P(63, 99)} ${P(44, 96)}
    C ${P(25, 93)} ${P(7, 81)} ${P(4, 62)}
    C ${P(1, 44)} ${P(6, 25)} ${P(19, 15)}
    C ${P(29, 7)} ${P(41, 4)} ${P(54, 3)} Z`,

  /* --- F18 stamp. Perforated on all four edges. We are called
     HeartStamp. Nobody else gets to own this one. */
  stamp: () => {
    const x = 5, y = 5, w = 90, h = 90, p = 6.2;
    const nx = 6, ny = 6, sx = w / nx, sy = h / ny;
    let d = `M ${P(x, y)} `;
    for (let i = 0; i < nx; i++) {
      const c = x + i * sx + sx / 2;
      d += `L ${P(c - p, y)} Q ${P(c, y + p * 1.55)} ${P(c + p, y)} `;
    }
    d += `L ${P(x + w, y)} `;
    for (let i = 0; i < ny; i++) {
      const c = y + i * sy + sy / 2;
      d += `L ${P(x + w, c - p)} Q ${P(x + w - p * 1.55, c)} ${P(x + w, c + p)} `;
    }
    d += `L ${P(x + w, y + h)} `;
    for (let i = nx - 1; i >= 0; i--) {
      const c = x + i * sx + sx / 2;
      d += `L ${P(c + p, y + h)} Q ${P(c, y + h - p * 1.55)} ${P(c - p, y + h)} `;
    }
    d += `L ${P(x, y + h)} `;
    for (let i = ny - 1; i >= 0; i--) {
      const c = y + i * sy + sy / 2;
      d += `L ${P(x, c + p)} Q ${P(x + p * 1.55, c)} ${P(x, c - p)} `;
    }
    return d + 'Z';
  }
};

/* ---------- cores -------------------------------------------
   A few shapes have an edge that must not be offset. Inset the
   stamp's perforations and every bite turns into a blister. So a
   shape may declare a CORE: the clean outline used for inset
   rings, media clips and the glyph safe area, while the decorated
   outline stays the thing you actually draw.
   ------------------------------------------------------------ */
const CORES = {
  stamp: () => rrect(9.5, 9.5, 81, 81, 5)
};

export const FRAME_NAMES = Object.keys(SHAPES);

/* human labels, used by the catalog and by the picker UI */
export const FRAME_LABELS = {
  circle: 'Disc', oval: 'Oval', capsule: 'Capsule', squircle: 'Squircle',
  square: 'Square', diamond: 'Diamond', heart: 'Heart', triangle: 'Triangle',
  triangleDown: 'Triangle down', shield: 'Shield', hexagon: 'Hexagon',
  rosette: 'Rosette', ticket: 'Ticket', pennant: 'Pennant', arch: 'Arch',
  burst: 'Burst', blob: 'Blob', stamp: 'Stamp'
};

/* what each shape is FOR. A shape library with no editorial is a
   shape library that gets used at random. */
export const FRAME_USE = {
  circle: 'Default. Faces, gestures, anything that has to survive 44px.',
  oval: 'Portrait crops. A person head to waist without a square fighting them.',
  capsule: 'Wide media. Screen recordings, before-and-after, a card front.',
  squircle: 'Product and UI. Reads as an app icon without being one.',
  square: 'Filed facts. Quotes, questions, specs, dates.',
  diamond: 'Reveal and alert. Turns any glyph into news.',
  heart: 'Ours. Sincere beats, love and family occasions, the brand stamp.',
  triangle: 'Heads-up, caution, tip. Points up at the thing above it.',
  triangleDown: 'Look below. Pairs with a caption sitting over the subject.',
  shield: 'Promise and guarantee. Print quality, delivery, privacy.',
  hexagon: 'Technical. Specs, process, how-it-works.',
  rosette: 'Award and seal. Best seller, staff pick, verified.',
  ticket: 'Offers, codes, HeartCredits. Anything redeemable.',
  pennant: 'Points down at the subject with no arrow needed.',
  arch: 'Keepsake and memorial. The soft register.',
  burst: 'New, free, launch. The loudest shape we own, use once.',
  blob: 'Organic, human, hand-cut. Breaks a grid of geometry.',
  stamp: 'HeartStamp itself. Postage, mailing, the physical card.'
};

/* ---------- the one entry point ---------------------------- */
export function frame(name = 'circle', { steps = 18 } = {}) {
  const gen = SHAPES[name] || SHAPES.circle;
  const d = gen().replace(/\s+/g, ' ').trim();
  const pts = flatten(d, steps);
  const core = CORES[name] ? flatten(CORES[name]().replace(/\s+/g, ' ').trim(), steps) : pts;
  const [cx, cy] = centroid(pts);
  return { name, d, pts, core, cx, cy };
}

export default frame;
