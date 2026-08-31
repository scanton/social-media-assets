"use client";

import {
  DEFAULT_PROVIDER, PROVIDER_COOKIE, isProviderId, type ProviderId,
} from "@/lib/providers";
import { capturePreview, previewFor, rememberPreview } from "@/lib/local-preview";

export class NoKeyError extends Error {
  constructor(message = "Add your fal.ai key to start generating.") {
    super(message);
    this.name = "NoKeyError";
  }
}

async function readError(res: Response): Promise<never> {
  let payload: { error?: string; detail?: string; code?: string } = {};
  try {
    payload = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (res.status === 428 || payload.code === "NO_KEY") throw new NoKeyError(payload.error);
  throw new Error([payload.error ?? `Request failed (${res.status})`, payload.detail].filter(Boolean).join(" — "));
}

/**
 * Puts a file where the active provider can read it, and returns its URL.
 *
 * Two routes, because the providers differ in a way that cannot be papered
 * over. fal mints a signed URL and the bytes go straight from the browser to
 * its CDN, so a 40 MB card animation never touches our origin. Replicate
 * authenticates its upload with the token, which is httpOnly and therefore not
 * something the browser can send — so those bytes go through our server.
 *
 * The server says which; this only has to do as it is told. Progress is
 * reported for both, since the slow one is the case that needs it.
 */
export async function uploadToFal(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const init = await fetch("/api/fal/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name || `upload-${Date.now()}`,
      contentType: file.type || "application/octet-stream",
    }),
  });
  if (!init.ok) await readError(init);
  const { mode, uploadUrl, fileUrl } = (await init.json()) as {
    mode?: "direct" | "proxy";
    uploadUrl: string;
    fileUrl: string | null;
  };

  if (mode === "proxy") {
    const body = new FormData();
    body.append("file", file, file.name || `upload-${Date.now()}`);
    const url = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          let msg = `Upload failed (${xhr.status}).`;
          try {
            const j = JSON.parse(xhr.responseText) as { error?: string; detail?: string };
            msg = [j.error, j.detail].filter(Boolean).join(" — ") || msg;
          } catch {
            /* not JSON */
          }
          reject(new Error(msg));
          return;
        }
        try {
          resolve((JSON.parse(xhr.responseText) as { fileUrl: string }).fileUrl);
        } catch {
          reject(new Error("The upload succeeded but returned nothing usable."));
        }
      };
      xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
      xhr.send(body);
    });
    onProgress?.(100);
    /*
     * Captured after the upload rather than before: an upload that fails should
     * not leave a thumbnail behind for a file that is not there.
     */
    const poster = await capturePreview(file);
    if (poster) rememberPreview(url, poster);
    return url;
  }

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection."));
    xhr.send(file);
  });

  onProgress?.(100);
  return fileUrl as string;
}

/**
 * `slot` names the step, not the model. The server needs it to check the model
 * is a legitimate stand-in and to reshape this payload to that model's schema —
 * see lib/model-input.ts.
 */
export async function submitJob(
  model: string,
  slot: string,
  input: Record<string, unknown>,
): Promise<string> {
  const res = await fetch("/api/fal/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, slot, input }),
  });
  if (!res.ok) await readError(res);
  const { requestId } = (await res.json()) as { requestId: string };
  return requestId;
}

export type PollUpdate = { status: string; queuePosition?: number };

/** Polls until the job completes, backing off from 1.5s to 6s. */
export async function awaitJob<T>(
  model: string,
  requestId: string,
  opts: { onUpdate?: (u: PollUpdate) => void; signal?: AbortSignal } = {},
): Promise<T> {
  let delay = 1500;
  for (;;) {
    if (opts.signal?.aborted) throw new DOMException("Cancelled", "AbortError");

    const res = await fetch(
      `/api/fal/status?model=${encodeURIComponent(model)}&requestId=${encodeURIComponent(requestId)}`,
      { signal: opts.signal, cache: "no-store" },
    );
    if (!res.ok) await readError(res);

    const body = (await res.json()) as { status: string; queuePosition?: number; data?: T };
    if (body.status === "COMPLETED") return body.data as T;

    opts.onUpdate?.({ status: body.status, queuePosition: body.queuePosition });
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.25, 6000);
  }
}

/** The provider this browser is pointed at, for code outside a React hook. */
export function currentProvider(): ProviderId {
  if (typeof document === "undefined") return DEFAULT_PROVIDER;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${PROVIDER_COOKIE}=`))
    ?.slice(PROVIDER_COOKIE.length + 1);
  return isProviderId(raw) ? raw : DEFAULT_PROVIDER;
}

export function downloadUrl(url: string, filename: string) {
  /*
   * A blob or data URL is already the bytes and is already local. Sending it to
   * the proxy would ask our server to fetch a URL only this tab can resolve,
   * which fails as a refused host — the finished clip would offer a Download
   * that 400s.
   */
  if (url.startsWith("blob:") || url.startsWith("data:")) return url;
  return `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
}

/**
 * The URL to actually put in an <img> or a <video>.
 *
 * fal serves generated media from a public CDN, so its URLs go straight in.
 * Replicate's files sit behind its API and need a bearer token, which a media
 * element has no way to send — the browser just fails, and it cannot say why.
 * That is what a freshly uploaded clip showing "can't load right now" was.
 *
 * Those go through our own proxy, which holds the key. Everything else is left
 * alone: routing fal's CDN through our origin would spend function time to
 * achieve nothing.
 */
export type AssetPreview = {
  src: string;
  /**
   * True when `src` is the asset itself and a <video> can play it. False when
   * it is a still standing in for one, which must go in an <img> whatever kind
   * of asset it belongs to.
   */
  playable: boolean;
};

/**
 * What to render for an asset, and how.
 *
 * fal serves its uploads from a public CDN, so the URL is the asset and a video
 * plays. Replicate serves nothing a browser can fetch: its file URLs need the
 * account token, the one it hands out returns metadata rather than bytes, and
 * the endpoint with the bytes wants an HMAC signed with a secret the caller
 * does not have. All that exists for those is the frame captured when the file
 * was chosen — a JPEG, even for a clip.
 *
 * Which is why this returns the shape rather than a string. A bare URL made
 * every caller assume it could be played, so the poster went into a <video>
 * and rendered nothing at all: the same blank tile as before, arrived at by a
 * different route.
 *
 * Null means there is nothing to show, and the caller draws its placeholder.
 */
/**
 * Can this asset be saved to disk?
 *
 * Replicate's file store hands back a resource URL, and the bytes behind it
 * need an HMAC signed with a secret we do not hold — so a Download button
 * pointed at one saves a few hundred bytes of JSON metadata named `.mp4`. Not
 * an error, which is worse than one: a file that opens in nothing, with no
 * indication of why.
 *
 * Rendered output is unaffected — that comes back on replicate.delivery, which
 * is public.
 */
export function isDownloadable(url: string): boolean {
  if (url.startsWith("blob:") || url.startsWith("data:")) return true;
  return !url.startsWith("https://api.replicate.com/");
}

export function assetPreview(url: string): AssetPreview | null {
  if (!url.startsWith("https://api.replicate.com/")) return { src: url, playable: true };
  const poster = previewFor(url);
  return poster ? { src: poster, playable: false } : null;
}


/* --------------------------- fal key state --------------------------- */

export async function getKeyState(): Promise<{ connected: boolean; hint: string | null }> {
  const res = await fetch("/api/key", { cache: "no-store" });
  if (!res.ok) return { connected: false, hint: null };
  return res.json();
}

export async function saveKey(key: string, provider: ProviderId = "fal") {
  const res = await fetch("/api/key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, provider }),
  });
  if (!res.ok) await readError(res);
  return res.json() as Promise<{ connected: boolean; hint: string }>;
}

export async function clearKey(provider: ProviderId = "fal") {
  await fetch(`/api/key?provider=${provider}`, { method: "DELETE" });
}

/** The connection state of every provider, for the header and the key dialog. */
export async function readKeys() {
  const res = await fetch("/api/key", { cache: "no-store" });
  if (!res.ok) await readError(res);
  return res.json() as Promise<{
    providers: Record<ProviderId, { connected: boolean; hint: string | null }>;
    connected: boolean;
    hint: string | null;
  }>;
}

/* ----------------------------- utilities ----------------------------- */

/** Grabs a still frame from an uploaded video so it can seed image models. */
export function extractVideoFrame(file: File, atSeconds = 1): Promise<File> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const fail = (msg: string) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(msg));
    };

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(atSeconds, Math.max(0, video.duration - 0.1));
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return fail("Could not read that video.");
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (!blob) return reject(new Error("Could not grab a frame from that video."));
        resolve(new File([blob], `${file.name.replace(/\.\w+$/, "")}-frame.png`, { type: "image/png" }));
      }, "image/png");
    };
    video.onerror = () => fail("Could not decode that video.");
  });
}

export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read that video."));
    };
  });
}
