/* ============================================================
   POP KIT v2 - TEXT MEASUREMENT
   Exact advance widths taken from the real font files at build
   time, so the shell can be sized without a DOM. Works in the
   browser, in Node, and inside a Satori render with no changes.
   ============================================================ */
import W from './widths.json' with { type: 'json' };

export function measureLine(str, fontSize, face = 'sans') {
  const t = W[face] || W.sans;
  let u = 0;
  for (const ch of String(str)) u += (t.w[ch] ?? t.def);
  return (u / t.upm) * fontSize;
}

/* Greedy wrap. Honors explicit \n first, then wraps to maxW. */
export function wrap(text, fontSize, maxW, face = 'sans') {
  const out = [];
  for (const para of String(text).split('\n')) {
    if (!maxW) { out.push(para); continue; }
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (measureLine(test, fontSize, face) <= maxW || !line) line = test;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

export function blockSize(lines, fontSize, lineH, face = 'sans') {
  const w = Math.max(...lines.map(l => measureLine(l, fontSize, face)), 0);
  return { w: Math.ceil(w), h: Math.ceil(lines.length * lineH) };
}
