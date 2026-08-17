"use client";

import { useEffect, useRef, useState } from "react";
import { readVideoDuration, uploadToFal } from "@/lib/client-api";
import type { Asset, CardPanel } from "@/lib/studio-types";
import { useStudio, uid } from "../studio-store";
import { Uploader } from "../Uploader";
import { AssetThumb } from "../AssetThumb";
import { AssetTile } from "../AssetTile";
import { HandwrittenMessage } from "../HandwrittenMessage";
import { Button, cx, usePasteShortcut, useToast } from "../ui";
import { SectionHead } from "./shared";

/** Formats fal accepts and the image models handle cleanly. */
const PASTEABLE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const sizeTag = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))}KB`
    : `${(bytes / 1024 / 1024).toFixed(1)}MB`;

/**
 * Card fronts are portrait, inside spreads are two panels side by side and so
 * come out landscape. Good enough to pick a default; the tiles let it be changed.
 */
async function guessPanel(file: File): Promise<CardPanel> {
  try {
    const bitmap = await createImageBitmap(file);
    const landscape = bitmap.width > bitmap.height * 1.05;
    bitmap.close();
    return landscape ? "inside" : "front";
  } catch {
    return "front";
  }
}

export function Step1Card() {
  const s = useStudio();
  const toast = useToast();
  const pasteKey = usePasteShortcut();
  const [uploading, setUploading] = useState(false);
  const [pasteProgress, setPasteProgress] = useState<number | null>(null);

  const isPrint = s.surface === "print";
  const cardArt = s.assets.filter((a) => a.kind === "card-art");
  const cardVideos = s.assets.filter((a) => a.kind === "card-video");

  /* ----------------------------- uploads ----------------------------- */

  const uploadArtwork = async (
    file: File,
    onProgress: (pct: number) => void,
    opts: { label?: string; extraTags?: string[]; panel?: CardPanel } = {},
  ): Promise<Asset | null> => {
    if (!s.keyConnected) {
      s.openKeyDialog();
      return null;
    }
    setUploading(true);
    try {
      /*
       * Dropping into a named slot is an explicit choice and wins. Aspect ratio
       * only decides when there's no slot to go on — a paste, mainly — but it
       * still gets a look in so an obvious mis-drop doesn't pass silently.
       */
      const detected = await guessPanel(file);
      const panel = opts.panel ?? detected;
      if (opts.panel && detected !== opts.panel) {
        toast(
          detected === "inside"
            ? "That looks like a landscape inside spread but you dropped it on the front. Switch it below if that wasn't intended."
            : "That looks like a portrait front panel but you dropped it on the inside. Switch it below if that wasn't intended.",
          "info",
        );
      }
      const url = await uploadToFal(file, onProgress);
      const asset: Asset = {
        id: uid(),
        kind: "card-art",
        url,
        contentType: file.type,
        label: opts.label ?? file.name.replace(/\.\w+$/, ""),
        tags: [panel === "inside" ? "inside spread" : "front", ...(opts.extraTags ?? []), sizeTag(file.size)],
        createdAt: Date.now(),
        panel,
      };
      s.addAssets([asset]);
      if (panel === "inside") s.setCardInsideId(asset.id);
      else s.setCardFrontId(asset.id);
      toast(
        panel === "inside"
          ? "Inside spread added — opening motions are now available in step 3."
          : "Card front added.",
        "success",
      );
      return asset;
    } catch (err) {
      toast((err as Error).message, "error");
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadClip = async (file: File, onProgress: (pct: number) => void) => {
    if (!s.keyConnected) {
      s.openKeyDialog();
      return;
    }
    setUploading(true);
    try {
      const seconds = await readVideoDuration(file).catch(() => 0);
      if (seconds && (seconds < 2 || seconds > 15)) {
        toast(
          `That clip is ${seconds.toFixed(1)}s. Seedance reference clips must be 2–15s — trim it and retry.`,
          "error",
        );
        return;
      }
      const url = await uploadToFal(file, onProgress);
      const asset: Asset = {
        id: uid(),
        kind: "card-video",
        url,
        contentType: file.type,
        label: file.name.replace(/\.\w+$/, ""),
        tags: ["clip", sizeTag(file.size)],
        createdAt: Date.now(),
      };
      s.addAssets([asset]);
      s.setCardVideoId(asset.id);
      toast("Clip uploaded. Head to the video step.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  /* ------------------------------ paste ------------------------------ */

  const handlePaste = async (files: File[]) => {
    setPasteProgress(0);
    try {
      for (const file of files) {
        const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const named = new File([file], `pasted-card-${Date.now()}.${file.type.split("/")[1] ?? "png"}`, {
          type: file.type,
        });
        await uploadArtwork(named, setPasteProgress, {
          label: `Pasted · ${stamp}`,
          extraTags: ["pasted"],
        });
      }
    } finally {
      setPasteProgress(null);
    }
  };

  // Pasting only makes sense where artwork is the input.
  const canPaste = isPrint && !uploading && pasteProgress === null && !s.keyDialogOpen;

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

  /* ------------------------------ render ----------------------------- */

  const front = cardArt.find((a) => a.id === s.cardFrontId);
  const inside = cardArt.find((a) => a.id === s.cardInsideId);

  return (
    <div className="space-y-8">
      <SectionHead
        step={1}
        title={isPrint ? "Bring your card artwork" : "Bring your card animation"}
        blurb={
          isPrint
            ? "Upload the printed front panel. Add the full inside spread too and step 3 can open the card and reveal it."
            : "Upload the digital card animation that plays on the device. Everything else is set up on the next page."
        }
      />

      {isPrint ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <PanelSlot
              panel="front"
              title="Front panel"
              hint="Portrait. The printed face of the card — this is what the scene is built around."
              emoji="🎴"
              required
              asset={front}
              pasteKey={pasteKey}
              pasteProgress={pasteProgress}
              disabled={uploading}
              onFile={(f, p) => uploadArtwork(f, p, { panel: "front" }).then(() => {})}
            />
            <PanelSlot
              panel="inside"
              title="Inside spread"
              hint="Landscape. Both inside panels in one image. Optional — but it's what unlocks the opening motions."
              emoji="📖"
              asset={inside}
              disabled={uploading}
              onFile={(f, p) => uploadArtwork(f, p, { panel: "inside" }).then(() => {})}
            />
          </div>

          {cardArt.length > 0 && (
            <div>
              <div className="mb-2.5 flex items-baseline justify-between gap-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                  Uploaded artwork
                </p>
                <p className="text-xs text-ink-faint">
                  Side detected from the aspect ratio — switch it below if it guessed wrong.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {cardArt.map((a) => (
                  <div key={a.id} className="space-y-1.5">
                    <AssetTile
                      asset={a}
                      selectable
                      selected={s.cardFrontId === a.id || s.cardInsideId === a.id}
                      onSelect={() =>
                        a.panel === "inside"
                          ? s.setCardInsideId(s.cardInsideId === a.id ? null : a.id)
                          : s.setCardFrontId(s.cardFrontId === a.id ? null : a.id)
                      }
                      onRemove={() => s.removeAsset(a.id)}
                    />
                    <div className="flex gap-1">
                      {(["front", "inside"] as CardPanel[]).map((panel) => (
                        <button
                          key={panel}
                          type="button"
                          onClick={() => {
                            s.updateAsset(a.id, {
                              panel,
                              tags: [
                                panel === "inside" ? "inside spread" : "front",
                                ...a.tags.filter((tg) => tg !== "front" && tg !== "inside spread"),
                              ],
                            });
                            if (panel === "inside") {
                              s.setCardInsideId(a.id);
                              if (s.cardFrontId === a.id) s.setCardFrontId(null);
                            } else {
                              s.setCardFrontId(a.id);
                              if (s.cardInsideId === a.id) s.setCardInsideId(null);
                            }
                          }}
                          className={cx(
                            "focus-stamp flex-1 rounded-lg px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors",
                            a.panel === panel
                              ? "bg-stamp-600 text-white"
                              : "bg-canvas-2 text-ink-faint hover:bg-stamp-50 hover:text-stamp-700",
                          )}
                        >
                          {panel}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <HandwrittenMessage />

          <div className="rounded-2xl border border-hairline bg-canvas-2/70 p-4">
            <p className="text-sm leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">Front only?</span> That&apos;s fine — you&apos;ll
              get a scene and a clip built around the printed face. Add the inside spread whenever
              you want the card to open on camera.
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="card-surface mx-auto max-w-2xl p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-ink">Digital card clip</h3>
                <p className="mt-0.5 text-xs text-ink-faint">
                  MP4 or MOV, 2–15 seconds, up to 720p. This plays on the device in the video.
                </p>
              </div>
              <span className="sticker shrink-0">Required</span>
            </div>

            <Uploader
              emoji="🎬"
              accept="video/mp4,video/quicktime"
              title="Drop the card animation"
              subtitle="Opening animation, envelope reveal, interaction — 8–13s is the sweet spot"
              disabled={uploading}
              onFile={uploadClip}
            />

            {cardVideos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2.5">
                {cardVideos.map((a) => (
                  <AssetTile
                    key={a.id}
                    asset={a}
                    selectable
                    selected={s.cardVideoId === a.id}
                    onSelect={() => s.setCardVideoId(s.cardVideoId === a.id ? null : a.id)}
                    onRemove={() => s.removeAsset(a.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={() => s.setStep(2)}>
          {isPrint ? "Build the scene" : "Set up the video"}
          <span aria-hidden>→</span>
        </Button>
      </div>
    </div>
  );
}

function PanelSlot({
  title,
  hint,
  emoji,
  asset,
  required,
  disabled,
  pasteKey,
  pasteProgress,
  onFile,
}: {
  panel: CardPanel;
  title: string;
  hint: string;
  emoji: string;
  asset?: Asset;
  required?: boolean;
  disabled?: boolean;
  pasteKey?: string;
  pasteProgress?: number | null;
  onFile: (file: File, onProgress: (pct: number) => void) => Promise<void>;
}) {
  return (
    <div className="card-surface p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-bold text-ink">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">{hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {pasteKey && (
            <span className="sticker border-stamp-200 bg-stamp-50 text-stamp-700">{pasteKey}V ready</span>
          )}
          <span className="sticker">{required ? "Required" : "Optional"}</span>
        </div>
      </div>

      {asset ? (
        <div className="flex items-center gap-3 rounded-2xl border border-stamp-300 bg-white p-3">
          <AssetThumb
            url={asset.url}
            className="h-20 w-20 rounded-xl object-cover ring-1 ring-hairline"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{asset.label}</p>
            <p className="mt-0.5 text-xs text-ink-faint">Selected — replace it by dropping another below.</p>
          </div>
        </div>
      ) : null}

      <div className={cx(asset && "mt-3")}>
        <Uploader
          emoji={emoji}
          accept="image/png,image/jpeg,image/webp,image/gif"
          title={asset ? "Replace it" : "Drop, browse or paste"}
          subtitle={hint}
          disabled={disabled}
          pasteable={Boolean(pasteKey)}
          externalProgress={pasteProgress}
          onFile={onFile}
        />
      </div>
    </div>
  );
}
