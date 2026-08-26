/* ============================================================
   POP KIT v2 - FEEDBACK LAYER
   Sound and haptics, treated as part of the template, not an
   afterthought bolted on by whoever edits the video.

   Three consumers, one registry:
     1. Social video   -> the WAV lands on the audio track at the
                          nugget's entrance frame. No haptics.
     2. iOS app        -> AVAudioPlayer cue + Core Haptics AHAP,
                          or the cheap UIFeedbackGenerator fallback.
     3. Desktop web    -> WebAudio cue + navigator.vibrate on
                          touch devices. Silent by default.

   House rule: sound fires on ENTRANCE only, never on exit, and
   never ducks the music bed. If two nuggets land inside 250ms,
   the second one is silent. That rule is enforced in shouldSound().
   ============================================================ */

/* ---- the cue pack, all synthesized in sfx/make_sfx.py ----- */
export const CUES = {
  'pop-in':      { file: 'pop-in.wav',      ms: 110, gain: 0.62, desc: 'Nugget entrance. Warm wooden pock.' },
  'pop-in-alt':  { file: 'pop-in-alt.wav',  ms: 100, gain: 0.62, desc: 'Same, a semitone up. Alternate so repeats do not sound cloned.' },
  'pop-out':     { file: 'pop-out.wav',     ms: 75,  gain: 0.30, desc: 'Exit. Used only when a nugget exits alone into silence.' },
  'stamp':       { file: 'stamp.wav',       ms: 200, gain: 0.70, desc: 'Ink stamp on paper. Confirmations and step completion.' },
  'paper-slide': { file: 'paper-slide.wav', ms: 240, gain: 0.48, desc: 'Pointer whoosh. Lands with the arrow, 15 frames before its caption.' },
  'seal':        { file: 'seal.wav',        ms: 340, gain: 0.72, desc: 'Wax seal press. Order placed, card sent, big success.' },
  'chime':       { file: 'chime.wav',       ms: 620, gain: 0.55, desc: 'Two-note rise. Reveals, launches, unlocks. Use sparingly.' },
  'tick':        { file: 'tick.wav',        ms: 28,  gain: 0.28, desc: 'Progress dot advancing. Nearly subliminal.' },
  'soft-error':  { file: 'soft-error.wav',  ms: 260, gain: 0.5,  desc: 'Two descending pips. Never harsh, never a buzzer.' },
  'silent':      { file: null,              ms: 0,   gain: 0,    desc: 'No cue. Correct for most nuggets in a dense sequence.' }
};

/* ---- haptic vocabulary -------------------------------------
   `ios` maps to the cheap UIKit generators for anything that does
   not need custom feel. `ahap` names a Core Haptics pattern file
   in sfx/ahap/ for the ones that do. `web` is a navigator.vibrate
   pattern in ms, alternating vibrate and pause.
   ------------------------------------------------------------ */
export const HAPTICS = {
  pop:      { ios: 'impactLight',        ahap: 'pop.ahap',    web: [12],            desc: 'A nugget arrived. The default.' },
  popFirm:  { ios: 'impactMedium',       ahap: 'pop-firm.ahap', web: [20],          desc: 'A loud nugget: Double Extrude, Burst Chip, Micro Chip.' },
  tap:      { ios: 'selectionChanged',   ahap: null,          web: [8],             desc: 'Coach mark pointing at a control. Lightest thing we have.' },
  stampHit: { ios: 'impactRigid',        ahap: 'stamp.ahap',  web: [16, 30, 26],    desc: 'Step completed. Feels like a stamp landing.' },
  success:  { ios: 'notificationSuccess',ahap: 'seal.ahap',   web: [14, 40, 14, 40, 34], desc: 'Order placed, card sent. Earn it.' },
  warn:     { ios: 'notificationWarning',ahap: null,          web: [18, 60, 18],    desc: 'Non-blocking heads up. Amber, never red.' },
  none:     { ios: null,                 ahap: null,          web: null,            desc: 'No haptic. Correct on every social asset and most captions.' }
};

/* ---- per-template defaults ---------------------------------
   Anything not listed falls through to the family default.
   ------------------------------------------------------------ */
const FAMILY_DEFAULT = {
  caption:   { cue: 'pop-in',      haptic: 'pop' },
  medallion: { cue: 'pop-in',      haptic: 'pop' },
  pointer:   { cue: 'paper-slide', haptic: 'none' },
  tutorial:  { cue: 'tick',        haptic: 'tap' }
};

const OVERRIDE = {
  /* loud captions get the firmer pop */
  N03: { cue: 'pop-in',   haptic: 'popFirm' },
  N16: { cue: 'pop-in-alt', haptic: 'popFirm' },
  N17: { cue: 'chime',    haptic: 'popFirm' },
  N04: { cue: 'chime',    haptic: 'popFirm' },
  N08: { cue: 'stamp',    haptic: 'stampHit' },
  N11: { cue: 'paper-slide', haptic: 'pop' },
  N12: { cue: 'stamp',    haptic: 'stampHit' },
  /* quiet, sincere templates stay silent so the copy carries it */
  N07: { cue: 'silent',   haptic: 'none' },
  N15: { cue: 'silent',   haptic: 'none' },
  N20: { cue: 'silent',   haptic: 'none' },
  /* medallion specials */
  M04: { cue: 'stamp',    haptic: 'stampHit' },
  M06: { cue: 'pop-in-alt', haptic: 'pop' },
  M10: { cue: 'seal',     haptic: 'success' },
  M13: { cue: 'chime',    haptic: 'success' },
  /* tutorial */
  T01: { cue: 'tick',     haptic: 'tap' },
  T02: { cue: 'stamp',    haptic: 'stampHit' },
  T03: { cue: 'tick',     haptic: 'tap' },
  T04: { cue: 'soft-error', haptic: 'warn' },
  T05: { cue: 'chime',    haptic: 'pop' },
  T06: { cue: 'silent',   haptic: 'tap' }
};

export function feedbackFor(variant) {
  const base = FAMILY_DEFAULT[variant.family] || FAMILY_DEFAULT.caption;
  const o = OVERRIDE[variant.id] || {};
  const cueKey = o.cue || base.cue;
  const hapKey = o.haptic || base.haptic;
  return { cueKey, cue: CUES[cueKey], hapticKey: hapKey, haptic: HAPTICS[hapKey] };
}

/* ---- the anti-clatter rule ---------------------------------
   Walk a deck in time order and silence anything that would
   stack on top of the previous cue. Returns a new beat list.
   ------------------------------------------------------------ */
export function applySoundRules(beats, { minGapMs = 250, fps = 30 } = {}) {
  const sorted = [...beats].sort((a, b) => a.t - b.t);
  let lastAudible = -Infinity;
  return sorted.map(b => {
    const tms = b.t * 1000;
    const wants = b.cue && b.cue !== 'silent';
    if (wants && tms - lastAudible < minGapMs) return { ...b, cue: 'silent', mutedBy: 'anti-clatter' };
    if (wants) lastAudible = tms;
    return b;
  });
}

/* ---- alternate repeated cues so gags do not sound cloned --- */
export function alternate(beats) {
  let n = 0;
  return beats.map(b => {
    if (b.cue !== 'pop-in') return b;
    n++;
    return n % 2 === 0 ? { ...b, cue: 'pop-in-alt' } : b;
  });
}

/* ---- browser player (desktop app + web preview) ------------ */
export function createPlayer(basePath = '/sfx/') {
  if (typeof window === 'undefined') return { play: () => {} };
  let ctx = null;
  const buffers = new Map();
  const ensure = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

  async function load(key) {
    const c = CUES[key];
    if (!c || !c.file) return null;
    if (buffers.has(key)) return buffers.get(key);
    const res = await fetch(basePath + c.file);
    const buf = await ensure().decodeAudioData(await res.arrayBuffer());
    buffers.set(key, buf);
    return buf;
  }

  return {
    preload: () => Promise.all(Object.keys(CUES).map(load)),
    async play(cueKey, hapticKey) {
      const c = CUES[cueKey];
      if (c && c.file) {
        const buf = await load(cueKey);
        if (buf) {
          const src = ensure().createBufferSource();
          const g = ensure().createGain();
          g.gain.value = c.gain;
          src.buffer = buf; src.connect(g); g.connect(ensure().destination); src.start();
        }
      }
      const h = HAPTICS[hapticKey];
      if (h && h.web && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(h.web);
    }
  };
}
