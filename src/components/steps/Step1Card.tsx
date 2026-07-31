"use client";

import { useState } from "react";
import { readVideoDuration, uploadToFal } from "@/lib/client-api";
import { SURFACES } from "@/lib/options";
import type { Asset } from "@/lib/studio-types";
import { useStudio, uid } from "../studio-store";
import { Uploader } from "../Uploader";
import { AssetTile } from "../AssetTile";
import { Button, Chip, useToast } from "../ui";
import { SectionHead } from "./shared";

export function Step1Card() {
  const s = useStudio();
  const toast = useToast();
  const [uploading, setUploading] = useState<null | "art" | "video">(null);

  const cardArt = s.assets.filter((a) => a.kind === "card-art");
  const cardVideos = s.assets.filter((a) => a.kind === "card-video");

  const upload = async (
    file: File,
    kind: "card-art" | "card-video",
    onProgress: (pct: number) => void,
  ) => {
    if (!s.keyConnected) {
      s.openKeyDialog();
      return;
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
          return;
        }
      }
      const url = await uploadToFal(file, onProgress);
      const asset: Asset = {
        id: uid(),
        kind,
        url,
        contentType: file.type,
        label: file.name.replace(/\.\w+$/, ""),
        tags: [kind === "card-art" ? "artwork" : "clip", `${(file.size / 1024 / 1024).toFixed(1)}MB`],
        createdAt: Date.now(),
      };
      s.addAssets([asset]);
      if (kind === "card-art") s.setCardArtId(asset.id);
      else s.setCardVideoId(asset.id);
      toast("Uploaded to fal. Ready to use.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-8">
      <SectionHead
        step={1}
        title="Bring your card"
        blurb="Start with what you're selling. Upload the printed card artwork, the digital 3D card clip, or both — they get placed into the scene in steps 3 and 4."
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
                PNG or JPG. This is what gets printed on the panel or shown on the screen.
              </p>
            </div>
            <span className="sticker shrink-0">Step 3</span>
          </div>

          <Uploader
            emoji="🎨"
            accept="image/png,image/jpeg,image/webp"
            title="Drop card artwork"
            subtitle="Front panel, inside spread, or a still frame from your 3D card"
            disabled={uploading !== null}
            onFile={(f, p) => upload(f, "card-art", p)}
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
                MP4 or MOV, 2–15 seconds, up to 720p. Plays on the device screen in step 4.
              </p>
            </div>
            <span className="sticker shrink-0">Step 4</span>
          </div>

          <Uploader
            emoji="🎬"
            accept="video/mp4,video/quicktime"
            title="Drop the card animation"
            subtitle="Opening animation, envelope reveal, interaction — 8–13s is the sweet spot"
            disabled={uploading !== null}
            onFile={(f, p) => upload(f, "card-video", p)}
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
