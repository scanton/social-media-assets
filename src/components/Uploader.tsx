"use client";

import { useRef, useState } from "react";
import { cx } from "./ui";

export function Uploader({
  accept,
  title,
  subtitle,
  emoji,
  onFile,
  disabled,
}: {
  accept: string;
  title: string;
  subtitle: string;
  emoji: string;
  onFile: (file: File, onProgress: (pct: number) => void) => Promise<void> | void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setProgress(0);
    try {
      await onFile(file, setProgress);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) void handle(e.dataTransfer.files?.[0]);
      }}
      className={cx(
        "relative overflow-hidden rounded-3xl border-2 border-dashed transition-all duration-300",
        disabled && "pointer-events-none opacity-50",
        over
          ? "scale-[1.01] border-stamp-600 bg-stamp-50"
          : "border-hairline bg-canvas-2/60 hover:border-stamp-300 hover:bg-stamp-50/40",
      )}
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="focus-stamp flex w-full flex-col items-center gap-2 px-6 py-10 text-center"
      >
        <span className={cx("text-3xl transition-transform duration-500", over ? "scale-125 animate-wobble" : "animate-float")}>
          {emoji}
        </span>
        <span className="mt-1 font-display text-base font-bold text-ink">{title}</span>
        <span className="max-w-xs text-xs leading-relaxed text-ink-faint">{subtitle}</span>
        <span className="mt-2 rounded-full border border-hairline bg-white px-3.5 py-1.5 text-xs font-bold text-ink-soft">
          Browse files
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          void handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {progress !== null && (
        <div className="absolute inset-x-0 bottom-0">
          <p className="pb-1 text-center text-[11px] font-bold uppercase tracking-wider text-stamp-700">
            Uploading {progress}%
          </p>
          <div className="h-1 bg-stamp-100">
            <div
              className="h-full bg-stamp-600 transition-[width] duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
