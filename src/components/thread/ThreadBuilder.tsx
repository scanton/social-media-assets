"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CANVASES } from "@/lib/popkit/catalogue";
import type { CanvasId } from "@/lib/popkit/deck";
import { chromeSvgFor, paintThread } from "@/lib/thread/paint";
import { canRenderThread, renderThread } from "@/lib/thread/render-video";
import {
  DEFAULT_THREAD, cardStartsAt, clipLength, schedule,
  type Sender, type Thread, type ThreadMessage,
} from "@/lib/thread/thread";
import type { RenderProgress } from "@/lib/video-encode";
import { Uploader } from "../Uploader";
import { Button, Field, Select, cx, useToast } from "../ui";
import { Panel } from "../steps/shared";

/**
 * Builds a text-message thread that ends in a card.
 *
 * The preview is the render. `paintThread` draws both, so there is no second
 * description of what a bubble looks like and nothing to drift — which is the
 * one structural change from the creator's demo, where the on-screen version
 * was DOM and the video was whatever a screen recorder caught of it.
 */

const uid = () => Math.random().toString(36).slice(2, 9);

export function ThreadBuilder() {
  const toast = useToast();
  const [thread, setThread] = useState<Thread>(DEFAULT_THREAD);
  const [canvas, setCanvas] = useState<CanvasId>("reels");
  const [card, setCard] = useState<{ file: File; url: string; seconds: number } | null>(null);
  const [thumb, setThumb] = useState<{ file: File; url: string } | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rendering, setRendering] = useState<RenderProgress | null>(null);

  const preset = CANVASES[canvas];
  const patch = (next: Partial<Thread>) => setThread((p) => ({ ...p, ...next }));

  const { threadEnds } = useMemo(() => schedule(thread), [thread]);
  const cardSeconds = card?.seconds ?? 13;
  const total = clipLength(threadEnds, cardSeconds);
  const cardAt = cardStartsAt(threadEnds);

  /* ---- the preview canvas ---- */
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chromeRef = useRef<HTMLImageElement | null>(null);
  const thumbRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // The status bar and home indicator, rasterised whenever the frame or clock
  // changes. An <img> rather than a second canvas painter: see screen-chrome.
  useEffect(() => {
    const img = new Image();
    img.src =
      "data:image/svg+xml;base64," +
      btoa(unescape(encodeURIComponent(chromeSvgFor(preset.w, preset.h, thread.clock))));
    void img.decode().catch(() => undefined).then(() => {
      chromeRef.current = img;
    });
  }, [preset.w, preset.h, thread.clock]);

  useEffect(() => {
    if (!thumb) {
      thumbRef.current = null;
      return;
    }
    const img = new Image();
    img.src = thumb.url;
    void img.decode().catch(() => undefined).then(() => {
      thumbRef.current = img;
    });
  }, [thumb]);

  /*
   * One effect owns the preview loop and the hidden <video> the card frames
   * come from. Two effects sharing them tripped the React Compiler lint and,
   * worse, let the element outlive the URL it was playing.
   */
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ctx = el.getContext("2d", { alpha: false });
    if (!ctx) return;

    let raf = 0;
    let started = performance.now() - playhead * 1000;
    let video = videoRef.current;
    if (card && (!video || video.src !== card.url)) {
      video = document.createElement("video");
      video.src = card.url;
      video.muted = true;
      video.playsInline = true;
      videoRef.current = video;
    }
    if (!card) videoRef.current = null;

    const draw = (t: number) => {
      const v = videoRef.current;
      let frame: CanvasImageSource | null = null;
      if (v && t >= cardAt && v.readyState >= 2) {
        const want = Math.min(Math.max(0, t - cardAt), cardSeconds - 0.05);
        if (playing) {
          if (v.paused) void v.play().catch(() => undefined);
        } else {
          v.pause();
          if (Math.abs(v.currentTime - want) > 0.06) v.currentTime = want;
        }
        frame = v;
      } else if (v) {
        v.pause();
      }
      paintThread(
        ctx,
        {
          thread, w: preset.w, h: preset.h,
          card: frame, thumb: thumbRef.current, chrome: chromeRef.current, cardSeconds,
        },
        t,
      );
    };

    if (!playing) {
      draw(playhead);
      return;
    }
    const loop = () => {
      const t = (performance.now() - started) / 1000;
      if (t >= total) {
        setPlaying(false);
        setPlayhead(total);
        draw(total);
        return;
      }
      setPlayhead(t);
      draw(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      started = 0;
    };
  }, [thread, preset.w, preset.h, playing, playhead, card, cardAt, cardSeconds, total]);

  /* ---- message editing ---- */
  const setMessage = (i: number, next: Partial<ThreadMessage>) =>
    setThread((p) => ({
      ...p,
      messages: p.messages.map((msg, n) => (n === i ? { ...msg, ...next } : msg)),
    }));

  const addMessage = (from: Sender) =>
    setThread((p) => {
      // Before the link, always: the card is what ends the thread.
      const link = p.messages.findIndex((msg) => msg.kind === "link");
      const at = link === -1 ? p.messages.length : link;
      const next = [...p.messages];
      next.splice(at, 0, { id: uid(), kind: "bubble", from, text: "" });
      return { ...p, messages: next };
    });

  const removeMessage = (i: number) =>
    setThread((p) => ({
      ...p,
      messages: p.messages.filter((_, n) => n !== i),
      liveFrom: Math.min(p.liveFrom, Math.max(0, p.messages.length - 2)),
    }));

  const input =
    "focus-stamp w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm transition-colors focus:border-stamp-600";

  const ready = Boolean(card);

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-5 sm:px-6">
      <header className="mb-5">
        <Link
          href="/"
          className="focus-stamp mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-ink-faint transition-colors hover:text-stamp-600"
        >
          <span aria-hidden>←</span> Asset Studio
        </Link>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stamp-600">THREAD</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Thread Tool
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          A text conversation that ends in a card. The preview is the render — the same paint
          function draws both — so what you see here is what comes out of the file.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ------------------------------ editor ----------------------------- */}
      <div className="space-y-5">
        <Panel title="The conversation" help="thread.panel">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Contact" hint="The name and avatar at the top.">
                <input
                  value={thread.contact}
                  onChange={(e) => patch({ contact: e.target.value })}
                  className={input}
                />
              </Field>
              <Field label="Clock" hint="What the status bar reads.">
                <input
                  value={thread.clock}
                  onChange={(e) => patch({ clock: e.target.value })}
                  className={input}
                />
              </Field>
              <Field label="Canvas" hint="The shape of the finished video.">
                <Select
                  value={canvas}
                  onChange={(v) => setCanvas(v as CanvasId)}
                  options={Object.entries(CANVASES).map(([id, c]) => ({
                    id, label: id, hint: `${c.w}×${c.h}`,
                  }))}
                />
              </Field>
            </div>

            <div className="space-y-2">
              {thread.messages.map((msg, i) => {
                const live = i >= thread.liveFrom;
                return (
                  <div
                    key={msg.id}
                    className={cx(
                      "flex items-center gap-2 rounded-xl border px-2.5 py-2",
                      live ? "border-stamp-200 bg-stamp-50/40" : "border-hairline bg-canvas-2",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setMessage(i, { from: msg.from === "me" ? "them" : "me" })
                      }
                      disabled={msg.kind === "divider"}
                      className={cx(
                        "focus-stamp shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-40",
                        msg.from === "me" ? "bg-[#0b84ff]" : "bg-ink/70",
                      )}
                    >
                      {msg.kind === "divider" ? "time" : msg.from === "me" ? "me" : thread.contact || "them"}
                    </button>
                    {msg.kind === "link" ? (
                      <span className="flex-1 text-xs font-semibold text-ink-soft">
                        💌 The card link — ends the thread
                      </span>
                    ) : (
                      <input
                        value={msg.text}
                        onChange={(e) => setMessage(i, { text: e.target.value })}
                        placeholder={msg.kind === "divider" ? "Today 9:38 AM" : "Type the message…"}
                        className="focus-stamp min-w-0 flex-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-sm"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => patch({ liveFrom: i })}
                      title="Start the animation here"
                      className={cx(
                        "focus-stamp shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold",
                        thread.liveFrom === i ? "bg-stamp-600 text-white" : "text-ink-faint hover:bg-canvas-2",
                      )}
                    >
                      ▶
                    </button>
                    {msg.kind !== "link" && (
                      <button
                        type="button"
                        onClick={() => removeMessage(i)}
                        className="focus-stamp shrink-0 rounded-lg px-2 py-1 text-[11px] text-ink-faint hover:bg-canvas-2"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={() => addMessage("them")}>
                + {thread.contact || "Them"}
              </Button>
              <Button variant="ghost" onClick={() => addMessage("me")}>+ Me</Button>
              <span className="text-xs text-ink-faint">
                ▶ marks where the live conversation starts — everything above it is already
                on screen when the clip opens.
              </span>
            </div>

            <Field
              label="Pace"
              hint={`${thread.pace.toFixed(2)}× — the thread runs ${threadEnds.toFixed(1)}s before the card.`}
            >
              <input
                type="range" min={0.5} max={1.8} step={0.05}
                value={thread.pace}
                onChange={(e) => patch({ pace: Number(e.target.value) })}
                className="focus-stamp w-full accent-stamp-600"
              />
            </Field>
          </div>
        </Panel>

        <Panel title="The card" help="thread.card">
          <div className="space-y-4">
            <Uploader
              emoji="🎬"
              accept="video/mp4,video/quicktime"
              title={card ? "Swap the card animation" : "Drop or browse the card animation"}
              subtitle="It plays on the phone when the link is tapped, then the frame pushes in on it."
              onFile={async (file) => {
                const url = URL.createObjectURL(file);
                const v = document.createElement("video");
                v.src = url;
                await new Promise((r) => { v.onloadedmetadata = r; v.onerror = r; });
                setCard({ file, url, seconds: Number.isFinite(v.duration) ? v.duration : 13 });
                toast("Card animation added.", "success");
              }}
            />
            <Uploader
              emoji="🖼️"
              accept="image/png,image/jpeg,image/webp"
              title={thumb ? "Swap the link thumbnail" : "Drop or browse a link thumbnail"}
              subtitle="The preview image inside the link bubble. Optional."
              onFile={(file) => {
                setThumb({ file, url: URL.createObjectURL(file) });
              }}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Link title">
                <input
                  value={thread.cardTitle}
                  onChange={(e) => patch({ cardTitle: e.target.value })}
                  className={input}
                />
              </Field>
              <Field label="Link domain">
                <input
                  value={thread.cardDomain}
                  onChange={(e) => patch({ cardDomain: e.target.value })}
                  className={input}
                />
              </Field>
            </div>
          </div>
        </Panel>
      </div>

      {/* ------------------------------ preview ---------------------------- */}
      <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
        <canvas
          ref={canvasRef}
          width={preset.w}
          height={preset.h}
          className="w-full rounded-2xl border border-hairline bg-black"
        />
        <div className="flex items-center gap-2">
          <Button onClick={() => { setPlaying((p) => !p); }}>
            {playing ? "Pause" : playhead >= total ? "Replay" : "Play"}
          </Button>
          <input
            type="range" min={0} max={Math.max(0.1, total)} step={0.01}
            value={Math.min(playhead, total)}
            onChange={(e) => { setPlaying(false); setPlayhead(Number(e.target.value)); }}
            className="focus-stamp w-full accent-stamp-600"
          />
          <span className="shrink-0 font-mono text-[11px] text-ink-faint">
            {playhead.toFixed(1)}/{total.toFixed(1)}s
          </span>
        </div>

        <Button
          onClick={async () => {
            if (!card) return;
            setRendering({ stage: "Preparing" });
            try {
              const { blob, ext } = await renderThread({
                thread, card: card.file, thumb: thumb?.file ?? null,
                w: preset.w, h: preset.h, onProgress: setRendering,
              });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `thread-${Date.now()}.${ext}`;
              a.click();
              URL.revokeObjectURL(a.href);
            } catch (err) {
              toast((err as Error).message, "error");
            } finally {
              setRendering(null);
            }
          }}
          loading={Boolean(rendering)}
          disabled={!ready || !canRenderThread() || Boolean(rendering)}
          title={ready ? undefined : "Add the card animation first"}
        >
          {rendering
            ? `${rendering.stage}${rendering.pct !== undefined ? ` ${rendering.pct}%` : ""}…`
            : "Render video"}
        </Button>
        <p className="text-xs leading-relaxed text-ink-faint">
          {canRenderThread()
            ? `Encoded frame by frame — a slower machine takes longer, not shorter. About ${total.toFixed(0)}s of video.`
            : "This browser has no video encoder, so the thread can't be rendered here."}
        </p>
      </div>
      </div>
    </div>
  );
}
