"use client";

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
 * Uploads straight to fal's CDN. Our server only mints the signed URL, so file
 * size is bounded by fal (90 MB single-shot), not by our serverless limits.
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
  const { uploadUrl, fileUrl } = (await init.json()) as { uploadUrl: string; fileUrl: string };

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
  return fileUrl;
}

export async function submitJob(model: string, input: Record<string, unknown>): Promise<string> {
  const res = await fetch("/api/fal/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input }),
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

export function downloadUrl(url: string, filename: string) {
  return `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
}

/* --------------------------- fal key state --------------------------- */

export async function getKeyState(): Promise<{ connected: boolean; hint: string | null }> {
  const res = await fetch("/api/key", { cache: "no-store" });
  if (!res.ok) return { connected: false, hint: null };
  return res.json();
}

export async function saveKey(key: string) {
  const res = await fetch("/api/key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key }),
  });
  if (!res.ok) await readError(res);
  return res.json() as Promise<{ connected: boolean; hint: string }>;
}

export async function clearKey() {
  await fetch("/api/key", { method: "DELETE" });
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
