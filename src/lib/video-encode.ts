"use client";

/**
 * The parts of a browser video pass that have nothing to do with what is being
 * drawn: which container the browser will encode, a clock that survives a
 * hidden tab, and a seek that waits for the frame to actually arrive.
 *
 * Extracted from video-logo.ts when the nugget renderer needed the same three
 * things. They are here rather than copied because each one encodes a lesson
 * that cost something to learn, and a copy is a place for one of them to be
 * quietly fixed and the other left broken.
 */

const MP4_TYPES = [
  "video/mp4;codecs=avc1.640028,mp4a.40.2",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4;codecs=avc1.42E01E",
  "video/mp4",
];

/** Prefers MP4 — social platforms are fussy about WebM — but takes what it can get. */
export function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of [...MP4_TYPES, "video/webm;codecs=vp9", "video/webm"]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

export function canRecordVideo(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    pickRecorderMime() !== null
  );
}

export type RenderProgress = {
  stage: string;
  pct?: number;
  /**
   * Frames per second actually achieved.
   *
   * Only meaningful while `realtime` is true, and only reported there. On that
   * path the finished file is as long as the frames it was given, so a machine
   * painting at half speed produces half a deck, and silence about it makes a
   * truncated render look like a bug in the deck rather than a machine that
   * could not keep up.
   */
  fps?: number;
  /**
   * Whether this render is on a clock.
   *
   * False means WebCodecs is stamping each frame with its own timestamp (see
   * video-encode-offline.ts), so a slow machine costs time and nothing else —
   * and the "this machine is behind" warning would be a lie. True means the
   * MediaRecorder fallback, where it is the truth.
   */
  realtime?: boolean;
};

/**
 * A ~60 Hz tick that survives the tab being hidden.
 *
 * Timers on the main thread get throttled to roughly once a second in a
 * background tab, and rAF stops entirely, so a worker owns the clock and the
 * main thread only does the drawing.
 */
export function makeTicker() {
  let worker: Worker | null = null;
  let fallback: number | null = null;

  return {
    start(onTick: () => void) {
      try {
        const src = "let h;onmessage=e=>{if(e.data==='stop'){clearInterval(h);close();}else{h=setInterval(()=>postMessage(0),16);}}";
        const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
        worker = new Worker(url);
        URL.revokeObjectURL(url);
        worker.onmessage = onTick;
        worker.postMessage("start");
      } catch {
        // No workers available — rAF still covers the common visible-tab case.
        const loop = () => {
          onTick();
          fallback = requestAnimationFrame(loop);
        };
        fallback = requestAnimationFrame(loop);
      }
    },
    stop() {
      worker?.postMessage("stop");
      worker?.terminate();
      worker = null;
      if (fallback !== null) cancelAnimationFrame(fallback);
      fallback = null;
    },
  };
}

/**
 * Seeks and waits for the frame to actually be there.
 *
 * Resolves on `seeked` rather than after setting currentTime, because the frame
 * isn't decoded until then and drawImage would otherwise copy whatever was on
 * screen before. The timeout is a safety valve: a decoder that never fires the
 * event must not hang the whole stamping pass.
 */
export function seekTo(video: HTMLVideoElement, time: number, timeoutMs = 4000): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", onSeeked);
      clearTimeout(timer);
      resolve(ok);
    };
    const onSeeked = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);

    video.addEventListener("seeked", onSeeked);
    try {
      video.currentTime = time;
    } catch {
      finish(false);
    }
  });
}

