"use client";

import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSink,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  type WrappedCanvas,
} from "mediabunny";

/**
 * Encoding that does not run on a clock.
 *
 * The other route out of this app — captureStream into MediaRecorder, in
 * video-encode.ts — records in real time, which means the finished file is as
 * long as the frames the machine managed to paint. A slow machine does not
 * produce a slow render, it produces a SHORT one: a customer's thirteen second
 * deck came back as six and a half seconds of choppy video, because her PC
 * painted at roughly half speed and the recorder faithfully wrote down what it
 * was given.
 *
 * There is no setting that fixes that, because the bug is the clock. Coarsening
 * the work per frame — which is what the previous attempt did — only moves the
 * threshold; a machine slow enough still loses the end of the deck, and now
 * quietly, at lower quality.
 *
 * WebCodecs removes the clock. Every frame is handed to the encoder with an
 * explicit timestamp, so frame 389 of a 13-second deck is stamped at 12.966s
 * whether the paint before it took four milliseconds or four hundred. A slow
 * machine takes longer to export and produces exactly the same file. That is
 * the entire idea, and everything else here follows from it.
 *
 * Two consequences worth stating, because they are what make it correct rather
 * than merely different:
 *
 *  - The source clips cannot be `<video>` elements playing. A playing element
 *    is a clock. Frames come out of a decoder instead, pulled one at a time.
 *  - The audio cannot be a live Web Audio graph, for the same reason. It is
 *    mixed offline into one buffer and encoded alongside.
 */

/** WebCodecs is the whole basis of this path; without it, callers fall back. */
export function canEncodeOffline(): boolean {
  return (
    typeof VideoEncoder !== "undefined" &&
    typeof VideoFrame !== "undefined" &&
    typeof VideoDecoder !== "undefined"
  );
}

/** Output frame rate. Fixed rather than derived: see `encodeDeterministic`. */
export const OFFLINE_FPS = 30;

/**
 * A clip, addressed by deck time rather than played.
 *
 * `at(t)` answers "which frame of this clip should be on screen at t", which is
 * the last source frame whose timestamp has passed. Time only ever moves
 * forward here, so the decoder runs straight through the file once — the same
 * sequential decode a player does, minus the waiting.
 */
export interface FrameSource {
  at(t: number): Promise<CanvasImageSource | null>;
  close(): Promise<void>;
}

/**
 * Opens a clip for frame-by-frame reading.
 *
 * `loop` restarts the decoder when the deck outlasts the clip, matching what
 * the editor does with a looping well. Returns null when the blob has no video
 * track the browser can decode, which callers treat as an empty shape rather
 * than a dead render — the same tolerance the real-time path has.
 */
export async function openFrameSource(
  blob: Blob,
  opts: { loop?: boolean } = {},
): Promise<FrameSource | null> {
  let input: Input;
  let sink: CanvasSink;
  let length: number;
  try {
    input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return null;
    // No width/height: the paint loop scales, exactly as it does for a <video>,
    // so resizing here would be a second resample of the same pixels.
    sink = new CanvasSink(track);
    length = await input.computeDuration();
  } catch {
    return null;
  }

  let iter = sink.canvases(0);
  let current: WrappedCanvas | null = null;
  let next: WrappedCanvas | null = null;
  let drained = false;
  /** Deck time at which the current pass through the clip began. */
  let passStart = 0;

  const pull = async (): Promise<WrappedCanvas | null> => {
    if (drained) return null;
    const r = await iter.next();
    if (r.done) {
      drained = true;
      return null;
    }
    return r.value;
  };

  return {
    async at(t) {
      if (opts.loop && length > 0 && t - passStart >= length) {
        // Wrapped. Rewind by whole clip lengths so a deck several times the
        // clip's length lands in the right place rather than one pass behind.
        passStart += length * Math.floor((t - passStart) / length);
        await iter.return?.(undefined);
        iter = sink.canvases(0);
        current = null;
        next = null;
        drained = false;
      }
      const want = t - passStart;

      if (!current) {
        current = await pull();
        next = await pull();
      }
      while (next && next.timestamp <= want) {
        current = next;
        next = await pull();
      }
      return current?.canvas ?? null;
    },
    async close() {
      await iter.return?.(undefined).catch(() => undefined);
      input.dispose?.();
    },
  };
}

/**
 * The audio of a source clip, laid into an offline graph.
 *
 * Scheduled by timestamp rather than concatenated, because a track with a gap
 * in it — or one that does not start at zero — would otherwise slide everything
 * after it forward. Returns false when there is nothing to schedule, which is
 * how a silent source is told apart from a failed one by the caller.
 */
export async function scheduleSourceAudio(
  blob: Blob,
  ctx: BaseAudioContext,
  destination: AudioNode,
  until: number,
): Promise<boolean> {
  try {
    const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return false;
    const sink = new AudioBufferSink(track);
    let any = false;
    for await (const wrapped of sink.buffers(0, until)) {
      const src = ctx.createBufferSource();
      src.buffer = wrapped.buffer;
      src.connect(destination);
      src.start(Math.max(0, wrapped.timestamp));
      any = true;
    }
    input.dispose?.();
    return any;
  } catch {
    // An undecodable audio track loses the sound, not the render.
    return false;
  }
}

export interface OfflineEncodeResult {
  blob: Blob;
  /** `mp4` when H.264 is encodable here, otherwise `webm`. */
  ext: string;
}

/**
 * Paints and encodes every frame, at its own timestamp, as fast or as slowly as
 * the machine happens to manage.
 *
 * `paint` is handed a frame index and the deck time it stands for, and must
 * leave the finished picture on `canvas`. It may be async — pulling a frame out
 * of a decoder is — which is precisely the thing the real-time path could not
 * allow and the reason it had to guess.
 */
export async function encodeDeterministic({
  canvas,
  fps = OFFLINE_FPS,
  frames,
  paint,
  audio,
  onProgress,
  signal,
}: {
  canvas: HTMLCanvasElement;
  fps?: number;
  frames: number;
  paint: (index: number, t: number) => void | Promise<void>;
  /** The whole soundtrack, mixed. Omitted for a render with no sound at all. */
  audio?: AudioBuffer | null;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<OfflineEncodeResult> {
  const width = canvas.width;
  const height = canvas.height;

  /*
   * H.264 first, because that is what social platforms want and what the
   * MediaRecorder path already preferred. VP9 and AV1 are here so a browser
   * without an H.264 encoder still gets a deterministic render rather than
   * being dropped back onto the clock.
   */
  const videoCodec = await getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width, height });
  if (!videoCodec) throw new Error("This browser has no video encoder, so the clip can't be rendered here.");
  const asMp4 = videoCodec === "avc";

  const audioCodec = audio
    ? await getFirstEncodableAudioCodec(asMp4 ? ["aac", "opus"] : ["opus"], {
        numberOfChannels: audio.numberOfChannels,
        sampleRate: audio.sampleRate,
      })
    : null;

  const output = new Output({
    // Metadata at the front: a file whose moov is at the end will not start
    // playing until it is fully downloaded, and these get posted.
    format: asMp4 ? new Mp4OutputFormat({ fastStart: "in-memory" }) : new WebMOutputFormat(),
    target: new BufferTarget(),
  });

  // The same rule the recorder used, so a deck does not change weight because
  // it took a different route out.
  const bitrate = Math.max(6_000_000, Math.min(20_000_000, width * height * 4));
  const videoSource = new CanvasSource(canvas, {
    codec: videoCodec,
    quality: new Quality({ bitrate }),
    keyFrameInterval: 2,
  });
  output.addVideoTrack(videoSource);

  let audioSource: AudioBufferSource | null = null;
  if (audio && audioCodec) {
    audioSource = new AudioBufferSource({ codec: audioCodec, quality: new Quality({ bitrate: 128_000 }) });
    output.addAudioTrack(audioSource);
  }

  await output.start();

  /*
   * The soundtrack goes in a second at a time, alongside the picture, rather
   * than in one call before or after it.
   *
   * A muxer holding one finished track and none of the other has to buffer the
   * whole thing, and any backpressure it applies while waiting for the second
   * track is a deadlock if that track is not being fed yet. Feeding both
   * forward together sidesteps the question entirely, and slicing an
   * AudioBuffer is cheap.
   */
  const sliceSeconds = 1;
  let audioWritten = 0;
  const pushAudioThrough = async (t: number) => {
    if (!audioSource || !audio) return;
    while (audioWritten < audio.duration && audioWritten < t + sliceSeconds) {
      const from = Math.round(audioWritten * audio.sampleRate);
      const to = Math.min(audio.length, Math.round((audioWritten + sliceSeconds) * audio.sampleRate));
      if (to <= from) break;
      const slice = new AudioBuffer({
        length: to - from,
        numberOfChannels: audio.numberOfChannels,
        sampleRate: audio.sampleRate,
      });
      for (let ch = 0; ch < audio.numberOfChannels; ch++) {
        slice.copyToChannel(audio.getChannelData(ch).subarray(from, to), ch);
      }
      await audioSource.add(slice);
      audioWritten += (to - from) / audio.sampleRate;
    }
  };

  try {
    for (let i = 0; i < frames; i++) {
      if (signal?.aborted) break;
      const t = i / fps;
      await paint(i, t);
      await videoSource.add(t, 1 / fps);
      await pushAudioThrough(t);
      onProgress?.(i + 1, frames);
    }
    // Whatever is left of the bed after the last frame's slice.
    await pushAudioThrough(Number.POSITIVE_INFINITY);
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  }

  const buffer = output.target.buffer;
  if (!buffer) throw new Error("The encoder produced no file.");
  return {
    blob: new Blob([buffer], { type: asMp4 ? "video/mp4" : "video/webm" }),
    ext: asMp4 ? "mp4" : "webm",
  };
}
