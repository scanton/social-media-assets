"use client";

import { useEffect, useRef, useState } from "react";
import { composeScene } from "@/lib/compose";
import { downloadUrl } from "@/lib/client-api";
import type { Pt, Quad } from "@/lib/perspective";
import type { Asset } from "@/lib/studio-types";
import { useStudio } from "./studio-store";
import { Button, cx, useToast } from "./ui";

const CORNER_LABELS = ["Top left", "Top right", "Bottom right", "Bottom left"];

/** Sensible starting box when detection found nothing at all. */
function defaultQuad(w: number, h: number): Quad {
  const x0 = w * 0.3;
  const x1 = w * 0.7;
  const y0 = h * 0.25;
  const y1 = h * 0.75;
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/**
 * Drag the four screen corners and re-composite. This is the recovery path for
 * the automatic detection in lib/screen-detect.ts — without it a missed screen
 * would be a dead end.
 */
export function ScreenAligner({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const s = useStudio();
  const toast = useToast();

  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [quad, setQuad] = useState<Quad | null>(asset.quad ?? null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const rawUrl = asset.rawUrl ?? asset.url;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  useEffect(() => {
    if (dragging === null) return;
    const move = (e: PointerEvent) => {
      const box = boxRef.current?.getBoundingClientRect();
      if (!box || !natural) return;
      const x = ((e.clientX - box.left) / box.width) * natural.w;
      const y = ((e.clientY - box.top) / box.height) * natural.h;
      setQuad((q) => {
        if (!q) return q;
        const next = [...q] as Quad;
        next[dragging] = {
          x: Math.max(0, Math.min(natural.w, x)),
          y: Math.max(0, Math.min(natural.h, y)),
        };
        return next;
      });
    };
    const up = () => setDragging(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, natural]);

  const apply = async () => {
    if (!quad || !asset.cardUrl) return;
    setBusy(true);
    try {
      const composed = await composeScene({
        renderUrl: rawUrl,
        cardUrl: asset.cardUrl,
        quad,
        withLogo: s.base.logo,
      });
      s.updateAsset(asset.id, {
        url: composed.url,
        contentType: "image/png",
        rawUrl,
        quad,
        needsAlign: false,
        tags: asset.tags.map((tg) => (tg === "screen not found" ? "exact card" : tg)),
      });
      toast("Screen aligned — the card is now pixel-exact.", "success");
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const pct = (p: Pt) =>
    natural ? { left: `${(p.x / natural.w) * 100}%`, top: `${(p.y / natural.h) * 100}%` } : {};

  return (
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center bg-ink/80 p-4 backdrop-blur-md sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Align the screen"
    >
      <div className="flex max-h-full w-full max-w-5xl flex-col gap-4 sm:flex-row">
        <div
          ref={boxRef}
          className="relative min-h-0 flex-1 touch-none select-none overflow-hidden rounded-2xl bg-ink/40"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={downloadUrl(rawUrl, "scene.png")}
            alt=""
            draggable={false}
            className="h-full w-full object-contain"
            onLoad={(e) => {
              const el = e.currentTarget;
              setNatural({ w: el.naturalWidth, h: el.naturalHeight });
              setQuad((q) => q ?? defaultQuad(el.naturalWidth, el.naturalHeight));
            }}
          />

          {quad && natural && (
            <>
              <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${natural.w} ${natural.h}`} preserveAspectRatio="xMidYMid meet">
                <polygon
                  points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="rgba(190,30,46,0.18)"
                  stroke="#BE1E2E"
                  strokeWidth={Math.max(2, natural.w * 0.004)}
                />
              </svg>
              {quad.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={CORNER_LABELS[i]}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setDragging(i);
                  }}
                  style={pct(p)}
                  className={cx(
                    "absolute -ml-4 -mt-4 h-8 w-8 cursor-grab rounded-full border-2 border-white bg-stamp-600 shadow-lg transition-transform",
                    dragging === i ? "scale-125 cursor-grabbing" : "hover:scale-110",
                  )}
                />
              ))}
            </>
          )}
        </div>

        <div className="w-full shrink-0 rounded-2xl bg-white p-5 sm:w-72">
          <h2 className="font-display text-lg font-extrabold tracking-tight text-ink">
            Align the screen
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
            Drag the four handles onto the corners of the device screen. The card is warped to fit
            exactly what you mark, so the first video frame matches perfectly.
          </p>

          <ol className="mt-4 space-y-1.5">
            {CORNER_LABELS.map((label, i) => (
              <li key={label} className="flex items-center gap-2 text-xs text-ink-soft">
                <span
                  className={cx(
                    "grid h-5 w-5 place-items-center rounded-full text-[10px] font-extrabold",
                    dragging === i ? "bg-stamp-600 text-white" : "bg-canvas-2 text-ink-faint",
                  )}
                >
                  {i + 1}
                </span>
                {label}
              </li>
            ))}
          </ol>

          <div className="mt-5 flex flex-col gap-2">
            <Button onClick={apply} loading={busy} disabled={!quad || !asset.cardUrl}>
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={() => natural && setQuad(defaultQuad(natural.w, natural.h))}
              disabled={busy}
            >
              Reset handles
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
