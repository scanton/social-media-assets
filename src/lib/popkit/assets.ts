"use client";

/**
 * Uploaded glyphs and well media, kept in the browser.
 *
 * There is no asset server behind PopKit, and the format never wanted one:
 * `media-wells.md` writes a well as `media: 'data:image/jpeg;base64,…'` and the
 * 62 built-in glyphs already resolve to data URIs. So an upload is not a file
 * that needs somewhere to live, it is a data URI the person supplied instead of
 * one the kit generated, and it travels inside the deck like every other one.
 *
 * IndexedDB rather than localStorage for the working copy. The studio store
 * already holds localStorage, which caps around 5MB across the origin, and a
 * handful of stills would evict a session's work. IndexedDB is measured in
 * hundreds of megabytes and takes Blobs without base64 inflating them by a
 * third.
 */

const DB = "heartstamp-popkit-assets";
const STORE = "assets";

export interface StoredAsset {
  id: string;
  name: string;
  /** `image` or `video`. A video may only be used as well media. */
  kind: "image" | "video";
  type: string;
  blob: Blob;
  addedAt: number;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB is unavailable."));
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const putAsset = (a: StoredAsset) => tx("readwrite", (s) => s.put(a) as IDBRequest<IDBValidKey>);
export const getAsset = (id: string) => tx<StoredAsset | undefined>("readonly", (s) => s.get(id));
export const allAssets = () => tx<StoredAsset[]>("readonly", (s) => s.getAll());
export const deleteAsset = (id: string) => tx("readwrite", (s) => s.delete(id) as IDBRequest<undefined>);

/** The longest edge an uploaded still is kept at. Matches the Stampy pack. */
export const GLYPH_EDGE = 512;

/**
 * Normalises a still on the way in.
 *
 * Redrawn to a square canvas at a known size, because a 4000px phone photo
 * dropped straight into a deck is several megabytes of base64 for something
 * that renders at 180 pixels. PNG rather than JPEG: a glyph with a transparent
 * background is the common case and JPEG has no alpha to keep.
 */
export async function normaliseImage(file: File, edge = GLYPH_EDGE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return new Promise((resolve, reject) => {
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error("That image could not be read."))), "image/png");
  });
}

/**
 * An SVG upload is kept as-is rather than rasterised.
 *
 * It is already resolution independent, which is the whole point of it, and
 * redrawing it into a 512px bitmap would throw that away at the moment the
 * entrance spring scales it past 100%.
 */
export const isSvg = (file: File) => file.type === "image/svg+xml" || /\.svg$/i.test(file.name);

export function toDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("That file could not be read."));
    fr.readAsDataURL(blob);
  });
}
