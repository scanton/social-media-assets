"use client";

import { useEffect, useRef, useState } from "react";
import { uploadToFal } from "@/lib/client-api";
import type { Asset } from "@/lib/studio-types";
import { useStudio, uid } from "./studio-store";
import { AssetTile } from "./AssetTile";
import { Uploader } from "./Uploader";
import { cx, useToast } from "./ui";
import { Panel } from "./steps/shared";

/** Formats fal accepts and the image and video models handle cleanly. */
const PASTEABLE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const sizeTag = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))}KB`
    : `${(bytes / 1024 / 1024).toFixed(1)}MB`;

/**
 * Upload, paste or pick the location photograph the product is dropped into.
 *
 * Shared by both workflows because the mechanic is identical — a printed card
 * gets composited into the photo by the image model, a device gets composited
 * into it by Seedance — and only the wording differs. Selecting one locks the
 * scene controls in whichever step is hosting this.
 */
export function BackgroundPanel({ subject }: { subject: "card" | "device" }) {
  const s = useStudio();
  const toast = useToast();
  const [pasteProgress, setPasteProgress] = useState<number | null>(null);

  const backgrounds = s.assets.filter((a) => a.kind === "background");
  const locked = backgrounds.some((a) => a.id === s.backgroundId);
  const noun = subject === "card" ? "card" : "device";

  const uploadBackground = async (
    file: File,
    onProgress: (pct: number) => void,
    opts: { label?: string; extraTags?: string[] } = {},
  ) => {
    if (!s.keyConnected) {
      s.openKeyDialog();
      return;
    }
    try {
      const url = await uploadToFal(file, onProgress);
      const asset: Asset = {
        id: uid(),
        kind: "background",
        url,
        contentType: file.type,
        label: opts.label ?? file.name.replace(/\.\w+$/, ""),
        tags: ["background", ...(opts.extraTags ?? []), sizeTag(file.size)],
        createdAt: Date.now(),
        surface: s.surface,
      };
      s.addAssets([asset]);
      s.setBackgroundId(asset.id);
      toast("Background set — it now defines the scene.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const handlePaste = async (files: File[]) => {
    setPasteProgress(0);
    try {
      for (const file of files) {
        const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const named = new File(
          [file],
          `pasted-background-${Date.now()}.${file.type.split("/")[1] ?? "png"}`,
          { type: file.type },
        );
        await uploadBackground(named, setPasteProgress, {
          label: `Pasted · ${stamp}`,
          extraTags: ["pasted"],
        });
      }
    } finally {
      setPasteProgress(null);
    }
  };

  const canPaste = pasteProgress === null && !s.keyDialogOpen;

  // The listener is registered once, so it reads the latest closure from a ref
  // rather than re-binding on every keystroke elsewhere on the page.
  const latest = useRef({ handlePaste, toast, canPaste });
  useEffect(() => {
    latest.current = { handlePaste, toast, canPaste };
  });

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

      const { handlePaste: run, toast: notify, canPaste: allowed } = latest.current;
      if (!allowed) return;

      const images = Array.from(e.clipboardData?.items ?? [])
        .filter((i) => i.kind === "file" && i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null);

      if (!images.length) return;
      e.preventDefault();

      const usable = images.filter((f) => PASTEABLE_TYPES.includes(f.type));
      if (!usable.length) {
        notify(`That's a ${images[0].type || "unknown"} image. Paste a PNG, JPEG, WebP or GIF.`, "error");
        return;
      }
      void run(usable);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  return (
    <Panel
      title="Your own background"
      help="scene.background"
      aside={
        <span className={cx("sticker", locked && "border-stamp-200 bg-stamp-50 text-stamp-700")}>
          {locked ? "Defining the scene" : "Optional"}
        </span>
      }
    >
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-ink-faint">
          Drop in a photo of a real place and the {noun} gets composited into it — same framing,
          same light, same everything. Selecting one locks the scene controls below; deselect it
          to go back to describing a scene.
        </p>

        <Uploader
          emoji="🏞️"
          accept="image/png,image/jpeg,image/webp,image/gif"
          title={locked ? "Swap the background" : "Drop, browse or paste a background"}
          subtitle={`A finished photograph of the location. The ${noun} is placed into it — nothing else about the shot changes.`}
          pasteable
          externalProgress={pasteProgress}
          onFile={uploadBackground}
        />

        {backgrounds.length > 0 && (
          <div className="grid grid-cols-3 gap-2.5">
            {backgrounds.map((a) => (
              <AssetTile
                key={a.id}
                asset={a}
                selectable
                selected={s.backgroundId === a.id}
                onSelect={() => s.setBackgroundId(s.backgroundId === a.id ? null : a.id)}
                onRemove={() => s.removeAsset(a.id)}
              />
            ))}
          </div>
        )}

        {backgrounds.length > 0 && !locked && (
          <p className="rounded-2xl bg-canvas-2 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
            <span className="font-bold text-ink">None selected.</span> The scene controls below are
            live and the shot is built from scratch. Tick a background to use it instead.
          </p>
        )}
      </div>
    </Panel>
  );
}
