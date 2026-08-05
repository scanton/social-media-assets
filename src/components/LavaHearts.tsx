"use client";

import { useEffect, useRef } from "react";
import { drawHeartsFrame, initBlobs, updateBlobs, type Blob } from "@/lib/lava-hearts";
import { cx } from "./ui";

/**
 * The studio's loading state: a metaball field rendered as a grid of hearts.
 *
 * Fills its parent, so the caller owns the box. The canvas is sized from the
 * measured box × devicePixelRatio and the context scaled to match, otherwise
 * the hearts go soft on retina displays.
 *
 * Grid spacing is in CSS pixels and deliberately fixed rather than derived from
 * the box: it's the density of the pattern, and a tile shows a smaller window
 * onto the same field rather than a coarser version of it.
 */
export function LavaHearts({
  className,
  color = "var(--color-stamp-600)",
  gridSpacing = 11,
  speed = 1,
}: {
  className?: string;
  /** Any canvas fillStyle. CSS custom properties are resolved before use. */
  color?: string;
  gridSpacing?: number;
  speed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas can't read a CSS variable, so resolve it against the live element.
    const resolved = color.startsWith("var(")
      ? getComputedStyle(canvas)
          .getPropertyValue(color.slice(4, -1).trim())
          .trim() || "#be1e2e"
      : color;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let blobs: Blob[] = [];
    let width = 0;
    let height = 0;
    let raf = 0;
    let alive = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextW = Math.max(1, Math.round(rect.width));
      const nextH = Math.max(1, Math.round(rect.height));
      if (nextW === width && nextH === height) return;

      width = nextW;
      height = nextH;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      blobs = initBlobs(width, height);
      // A resize mid-flight would otherwise leave the last frame stretched
      // until the next tick — and with reduced motion there is no next tick.
      drawHeartsFrame(ctx, width, height, blobs, gridSpacing, resolved);
    };

    const tick = () => {
      if (!alive) return;
      // A backgrounded tab stops rAF anyway; this keeps a hidden-but-animating
      // tile (another card scrolled over it) from burning frames.
      if (!document.hidden && width > 0) {
        updateBlobs(blobs, width, height, speed);
        drawHeartsFrame(ctx, width, height, blobs, gridSpacing, resolved);
      }
      raf = requestAnimationFrame(tick);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!reduced) raf = requestAnimationFrame(tick);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [color, gridSpacing, speed]);

  return <canvas ref={canvasRef} aria-hidden className={cx("h-full w-full", className)} />;
}
