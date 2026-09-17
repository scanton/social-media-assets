"use client";

/**
 * Sound cues the user uploaded, kept on this browser.
 *
 * A sibling of lib/render-store.ts rather than a tenant in it, deliberately.
 * That store evicts oldest-first against a 600MB budget, which is right for
 * finished renders and wrong for these: a cue is a few tens of kilobytes and
 * was chosen on purpose, and having one silently deleted to make room for a
 * video would be a genuinely bad surprise. Different lifetime, different store.
 *
 * Blobs rather than data URIs because the deck lives in localStorage, which is
 * a ~5MB quota storing UTF-16 — a single 2MB mp3 base64s to 2.7MB of characters
 * and lands as 5.4MB, so one upload would blow the whole session away.
 */

const DB = "heartstamp-popkit";
const STORE = "cues";
const VERSION = 1;

export interface StoredCue {
  id: string;
  /** What the user called it, from the filename. */
  name: string;
  /** Trimmed, normalised WAV — see `prepareCue`. */
  blob: Blob;
  /** Length in ms, after trimming. */
  ms: number;
  gain: number;
  createdAt: number;
}

/** Cue keys are namespaced so they can never collide with the shipped pack. */
export const CUSTOM_PREFIX = "custom:";
export const isCustomCue = (key: string) => key.startsWith(CUSTOM_PREFIX);
export const cueIdFromKey = (key: string) => key.slice(CUSTOM_PREFIX.length);

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

/* ---- the live view the UI and the players read ---- */

let rows: StoredCue[] = [];
let urls = new Map<string, string>();
let hydrated = false;
const listeners = new Set<() => void>();
const ping = () => listeners.forEach((l) => l());

export function subscribeCues(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export const customCues = () => rows;
export const cuesHydrated = () => hydrated;
/** The object URL for a cue key, once hydrated. */
export const customCueUrl = (key: string) => urls.get(cueIdFromKey(key)) ?? null;

export async function hydrateCues(): Promise<void> {
  if (hydrated) return;
  try {
    rows = ((await tx("readonly", (s) => s.getAll())) as StoredCue[]) ?? [];
    for (const u of urls.values()) URL.revokeObjectURL(u);
    urls = new Map(rows.map((r) => [r.id, URL.createObjectURL(r.blob)]));
  } catch {
    // No IndexedDB — private window, or blocked. The shipped pack still works.
    rows = [];
  }
  hydrated = true;
  ping();
}

/* ---- preparing an upload ---- */

/** Anything below this counts as silence when trimming the head. */
const SILENCE = 0.004;
/** Long enough for any cue worth the name; keeps a stray podcast out. */
export const MAX_CUE_S = 4;

/**
 * Decodes, trims and re-encodes an uploaded sound.
 *
 * The trim is the point. Both supplied packs so far arrived with a stretch of
 * silence in front of the transient — 188ms, 112ms, 150ms — and the player
 * starts a buffer at the beat with no offset, so an untrimmed cue lands that
 * far behind the thing it is announcing. At 30fps, 150ms is four and a half
 * frames late, which is plainly visible and impossible to attribute to the
 * sound file when you are looking at the animation. Doing it here means nobody
 * has to know that, and it cannot be forgotten.
 *
 * Re-encoded to mono 48k/16 WAV to match the shipped pack, and because a
 * decoded-and-retrimmed buffer has to be written back to SOMETHING the player
 * can fetch.
 */
export async function prepareCue(file: File): Promise<{ blob: Blob; ms: number }> {
  const AC: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch {
    await ctx.close();
    throw new Error("That file could not be decoded as audio. Try a WAV, MP3 or M4A.");
  }
  await ctx.close();

  // Mono: the pack is mono, and a cue is a point event with no business having
  // a stereo image.
  const n = decoded.length;
  const chans = decoded.numberOfChannels;
  const mono = new Float32Array(n);
  for (let c = 0; c < chans; c++) {
    const d = decoded.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += d[i] / chans;
  }

  let start = 0;
  while (start < n && Math.abs(mono[start]) < SILENCE) start++;
  if (start >= n) throw new Error("That file is silent all the way through.");

  let end = n;
  while (end > start && Math.abs(mono[end - 1]) < SILENCE) end--;
  end = Math.min(end, start + Math.round(decoded.sampleRate * MAX_CUE_S));

  const cut = mono.subarray(start, end);
  const rate = decoded.sampleRate;

  /*
   * A short fade at the tail, so a cue cut at the cap — or one whose own tail
   * ends abruptly — does not click. 20ms is inaudible as a fade and plenty to
   * kill a discontinuity.
   */
  const fade = Math.min(cut.length, Math.round(rate * 0.02));
  const out = Float32Array.from(cut);
  for (let i = 0; i < fade; i++) {
    out[out.length - fade + i] *= 1 - i / fade;
  }

  return { blob: wav(out, rate), ms: Math.round((out.length / rate) * 1000) };
}

/** Minimal 16-bit PCM WAV writer. No dependency earns its weight for 44 bytes. */
function wav(samples: Float32Array, rate: number): Blob {
  const bytes = samples.length * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const ascii = (at: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
  };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  ascii(8, "WAVEfmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);   // PCM
  v.setUint16(22, 1, true);   // mono
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, bytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

/* ---- writing ---- */

export async function saveCue(file: File, gain = 0.6): Promise<string> {
  const { blob, ms } = await prepareCue(file);
  const row: StoredCue = {
    id: Math.random().toString(36).slice(2, 10),
    name: file.name.replace(/\.\w+$/, "").slice(0, 40) || "cue",
    blob,
    ms,
    gain,
    createdAt: Date.now(),
  };
  await tx("readwrite", (s) => s.put(row));
  rows = [...rows, row];
  urls.set(row.id, URL.createObjectURL(row.blob));
  ping();
  return CUSTOM_PREFIX + row.id;
}

export async function deleteCue(key: string): Promise<void> {
  const id = cueIdFromKey(key);
  await tx("readwrite", (s) => s.delete(id));
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
  rows = rows.filter((r) => r.id !== id);
  ping();
}

export async function setCueGain(key: string, gain: number): Promise<void> {
  const id = cueIdFromKey(key);
  const row = rows.find((r) => r.id === id);
  if (!row) return;
  const next = { ...row, gain };
  await tx("readwrite", (s) => s.put(next));
  rows = rows.map((r) => (r.id === id ? next : r));
  ping();
}
