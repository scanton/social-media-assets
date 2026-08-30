"use client";

/**
 * A thumbnail kept on this browser, for files the browser cannot fetch back.
 *
 * fal serves uploads from a public CDN, so a tile just points at the URL. A
 * Replicate upload is not like that at all: /v1/files is an input staging area,
 * not a media host. Every URL it hands out needs the account's bearer token,
 * and the one it hands out is the file RESOURCE — with the token you get JSON
 * metadata, not bytes. The bytes are behind a separate endpoint that wants an
 * HMAC signature made with the Files API signing secret, which is not the API
 * token and is not something a caller has.
 *
 * So there is no URL we can put in a <video>, and no proxy we can write that
 * would help: our server cannot fetch those bytes either. That is what "can't
 * load right now" was, and no amount of routing was going to fix it.
 *
 * What we do have is the file, at the moment it is chosen. One frame of it,
 * scaled down and kept here, is enough for a tile to show the thing it stands
 * for — and it survives a reload, which an object URL would not.
 *
 * Deliberately small. This lives in localStorage beside the roll, and a roll of
 * full-size stills would fill the quota and take the studio's own state down
 * with it.
 */

const KEY = "hs_local_previews";
/** Longest edge. Big enough for a tile at 2x, small enough to keep dozens. */
const EDGE = 240;
const QUALITY = 0.6;
/** Oldest are dropped first. Fifty covers a working session comfortably. */
const MAX = 50;

type Store = { url: string; data: string; at: number }[];

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : [];
  } catch {
    return [];
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store.slice(-MAX)));
  } catch {
    /*
     * Quota, most likely. A missing thumbnail is a cosmetic loss and the roll
     * itself is not — so this fails quietly rather than taking a write of the
     * asset list down with it.
     */
  }
}

export function previewFor(url: string): string | null {
  return read().find((e) => e.url === url)?.data ?? null;
}

export function rememberPreview(url: string, data: string) {
  const store = read().filter((e) => e.url !== url);
  store.push({ url, data, at: Date.now() });
  write(store);
}

export function forgetPreview(url: string) {
  write(read().filter((e) => e.url !== url));
}

/** Draws whatever is decodable onto a small canvas and returns a data URL. */
function shrink(source: CanvasImageSource, w: number, h: number): string | null {
  if (!w || !h) return null;
  const k = Math.min(1, EDGE / Math.max(w, h));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * k));
  cv.height = Math.max(1, Math.round(h * k));
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, cv.width, cv.height);
  try {
    return cv.toDataURL("image/jpeg", QUALITY);
  } catch {
    return null;
  }
}

/**
 * A poster for a file the user just chose.
 *
 * A video is seeked a little way in rather than to zero: the first frame of a
 * card animation is often a blank or a fade, and a thumbnail of nothing is not
 * worth keeping.
 *
 * Never throws. This is a nicety attached to an upload that has already
 * succeeded, and it must not be able to fail the upload.
 */
export async function capturePreview(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.src = url;
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      await new Promise<void>((r) => {
        v.onloadeddata = () => r();
        v.onerror = () => r();
      });
      if (!v.videoWidth) return null;
      if (Number.isFinite(v.duration) && v.duration > 0.6) {
        await new Promise<void>((r) => {
          v.onseeked = () => r();
          v.onerror = () => r();
          v.currentTime = Math.min(0.5, v.duration / 2);
        });
      }
      return shrink(v, v.videoWidth, v.videoHeight);
    }

    const img = new Image();
    img.src = url;
    await new Promise<void>((r) => {
      img.onload = () => r();
      img.onerror = () => r();
    });
    if (!img.naturalWidth) return null;
    return shrink(img, img.naturalWidth, img.naturalHeight);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
