"use client";

import { useEffect, useRef, useState } from "react";
import { extractVideoFrame, readVideoDuration, uploadToFal } from "@/lib/client-api";
import { SURFACES } from "@/lib/options";
import type { Asset } from "@/lib/studio-types";
import { useStudio, uid } from "../studio-store";
import { Uploader } from "../Uploader";
import { AssetTile } from "../AssetTile";
import { Button, Chip, usePasteShortcut, useToast } from "../ui";
import { SectionHead } from "./shared";

/** Formats fal accepts and the image models handle cleanly. */
const PASTEABLE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export function Step1Card() {
  const s = useStudio();
  const toast = useToast();
  const pasteKey = usePasteShortcut();
  const [uploading, setUploading] = useState<null | "art" | "video">(null);
  const [pasteProgress, setPasteProgress] = useState<number | null>(null);

  const cardArt = s.assets.filter((a) => a.kind === "card-art");
  const cardVideos = s.assets.filter((a) => a.kind === "card-video");

  const upload = async (
    file: File,
    kind: "card-art" | "card-video",
    onProgress: (pct: number) => void,
    opts: { label?: string; extraTags?: string[]; parentId?: string; quiet?: boolean } = {},
  ): Promise<Asset | null> => {
    if (!s.keyConnected) {
      s.openKeyDialog();
      return null;
    }
    setUploading(kind === "card-art" ? "art" : "video");
    try {
      if (kind === "card-video") {
        const seconds = await readVideoDuration(file).catch(() => 0);
        if (seconds && (seconds < 2 || seconds > 15)) {
          toast(
            `That clip is ${seconds.toFixed(1)}s. Seedance reference clips must be 2–15s — trim it and retry.`,
            "error",
          );
          return null;
        }
      }
      const url = await uploadToFal(file, onProgress);
      const asset: Asset = {
        id: uid(),
        kind,
        url,
        contentType: file.type,
        label: opts.label ?? file.name.replace(/\.\w+$/, ""),
        tags: [
          kind === "card-art" ? "artwork" : "clip",
          ...(opts.extraTags ?? []),
          file.size < 1024 * 1024
            ? `${Math.max(1, Math.round(file.size / 1024))}KB`
            : `${(file.size / 1024 / 1024).toFixed(1)}MB`,
        ],
        createdAt: Date.now(),
        parentId: opts.parentId,
      };
      s.addAssets([asset]);
      if (kind === "card-art") s.setCardArtId(asset.id);
      else s.setCardVideoId(asset.id);
      if (!opts.quiet) toast("Uploaded to fal. Ready to use.", "success");
      return asset;
    } catch (err) {
      toast((err as Error).message, "error");
      return null;
    } finally {
      setUploading(null);
    }
  };

  /**
   * A clip on its own leaves step 2 with nothing to put on the screen, so the
   * scene renders blank and the video has to invent its way out of a white
   * screen. Grabbing frame one and registering it as card artwork means the
   * still already shows exactly what the clip opens on.
   */
  const uploadClip = async (file: File, onProgress: (pct: number) => void) => {
    const clip = await upload(file, "card-video", (p) => onProgress(Math.round(p * 0.8)), {
      quiet: true,
    });
    if (!clip) return;

    try {
      const frame = await extractVideoFrame(file, 0.04);
      await upload(frame, "card-art", (p) => onProgress(80 + Math.round(p * 0.2)), {
        label: `First frame · ${clip.label}`,
        extraTags: ["from clip"],
        parentId: clip.id,
        quiet: true,
      });
      toast("Clip uploaded, and its first frame is ready for the scene.", "success");
    } catch (err) {
      toast(
        `Clip uploaded, but the first frame couldn't be read (${(err as Error).message}) — add card artwork manually so step 2 isn't blank.`,
        "error",
      );
    }

    // Uploading a clip is a clear statement of intent for step 3.
    if (s.surface === "screen") s.setVideo({ engine: "screen-replace" });
  };

  /* ------------------------------ paste ------------------------------ */

  /**
   * Anything pasted here is treated as card artwork — never a clip. Videos are
   * far too big to live on a clipboard, so there's nothing to disambiguate.
   */
  const handlePaste = async (files: File[]) => {
    setPasteProgress(0);
    try {
      for (const file of files) {
        const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        // Clipboard files are usually called "image.png" — give it something
        // recognisable in the roll and in the download filename.
        const named = new File([file], `pasted-card-${Date.now()}.${file.type.split("/")[1] ?? "png"}`, {
          type: file.type,
        });
        await upload(named, "card-art", setPasteProgress, {
          label: `Pasted card · ${stamp}`,
          extraTags: ["pasted"],
        });
      }
    } finally {
      setPasteProgress(null);
    }
  };

  // Don't accept a paste mid-upload, or while the key dialog owns the keyboard.
  const canPaste = !uploading && pasteProgress === null && !s.keyDialogOpen;

  /*
   * One "latest values" box, refreshed after every render. This lets the document
   * listener below be registered exactly once instead of being torn down and
   * rebuilt on every progress tick.
   */
  const latest = useRef({ handlePaste, toast, canPaste });
  useEffect(() => {
    latest.current = { handlePaste, toast, canPaste };
  });

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // Don't hijack a paste meant for a text field — the fal key input, the
      // notes textareas, and so on.
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
    <div className="space-y-8">
      <SectionHead
        step={1}
        title="Bring your card"
        blurb="Start with what you're selling. Upload the printed card artwork, the digital 3D card clip, or both — they get placed into the scene in step 2 and brought to life in step 3."
      />

      <div>
        <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
          What are we selling?
        </p>
        <div className="flex flex-wrap gap-2">
          {SURFACES.map((opt) => (
            <Chip
              key={opt.id}
              emoji={opt.emoji}
              active={s.surface === opt.kind}
              onClick={() => s.setSurface(opt.kind)}
              sub={opt.hint}
            >
              {opt.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="card-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-ink">Card artwork</h3>
              <p className="mt-0.5 text-xs text-ink-faint">
                PNG, JPG, WebP or GIF. This is what gets printed on the panel or shown on the screen.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="sticker border-stamp-200 bg-stamp-50 text-stamp-700">{pasteKey}V ready</span>
              <span className="sticker">Step 2</span>
            </div>
          </div>

          <Uploader
            emoji="🎨"
            accept="image/png,image/jpeg,image/webp,image/gif"
            title="Drop, browse or paste"
            subtitle="Front panel, inside spread, or a still frame from your 3D card. Copy an image anywhere and paste it straight onto this page."
            disabled={uploading !== null}
            pasteable
            externalProgress={pasteProgress}
            onFile={async (f, p) => {
              await upload(f, "card-art", p);
            }}
          />

          {cardArt.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {cardArt.map((a) => (
                <AssetTile
                  key={a.id}
                  asset={a}
                  selectable
                  selected={s.cardArtId === a.id}
                  onSelect={() => s.setCardArtId(s.cardArtId === a.id ? null : a.id)}
                  onRemove={() => s.removeAsset(a.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="card-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-ink">3D card clip</h3>
              <p className="mt-0.5 text-xs text-ink-faint">
                MP4 or MOV, 2–15 seconds, up to 720p. Its first frame goes on the device in step 2, then the clip plays there in step 3.
              </p>
            </div>
            <span className="sticker shrink-0">Steps 2 &amp; 3</span>
          </div>

          <Uploader
            emoji="🎬"
            accept="video/mp4,video/quicktime"
            title="Drop the card animation"
            subtitle="Opening animation, envelope reveal, interaction — 8–13s is the sweet spot"
            disabled={uploading !== null}
            onFile={(f, p) => uploadClip(f, p)}
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
      </div>

      <div className="rounded-2xl border border-hairline bg-canvas-2/70 p-4">
        <p className="text-sm leading-relaxed text-ink-soft">
          <span className="font-semibold text-ink">No card yet?</span> You can skip straight to step 2 and
          batch out base images with blank screens. Come back and place artwork whenever it&apos;s ready.
        </p>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={() => s.setStep(2)}>
          Build the base scene
          <span aria-hidden>→</span>
        </Button>
      </div>
    </div>
  );
}
