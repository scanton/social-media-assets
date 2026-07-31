"use client";

import { useState } from "react";
import {
  buildAnimatePrompt,
  buildScreenReplacePrompt,
  MOTIONS,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
} from "@/lib/options";
import { useStudio } from "../studio-store";
import { AssetTile } from "../AssetTile";
import { Button, Chip, Field, Select, Switch, cx } from "../ui";
import { Panel, ResultsGrid, SectionHead } from "./shared";

export function Step3Motion() {
  const s = useStudio();
  const [showPrompt, setShowPrompt] = useState(false);

  const stills = s.assets.filter((a) => a.kind === "base");
  const videos = s.assets.filter((a) => a.kind === "video");
  const cardClip = s.assets.find((a) => a.id === s.cardVideoId);

  const selectedStillId = s.baseId;
  const selectedStill = stills.find((a) => a.id === selectedStillId);

  const motions = MOTIONS.filter((m) => !m.surface || m.surface === s.surface);
  const cameraMotions = motions.filter((m) => m.kind === "camera");
  const actionMotions = motions.filter((m) => m.kind === "action");
  const screenReplaceReady = Boolean(cardClip);
  const ready = Boolean(selectedStill) && (s.video.engine === "animate" || screenReplaceReady);

  const prompt =
    s.video.engine === "screen-replace"
      ? buildScreenReplacePrompt({
          surface: s.surface,
          motionId: s.video.motionId,
          hasLogo: s.base.logo,
          extraNotes: s.video.notes,
        })
      : buildAnimatePrompt({
          motionId: s.video.motionId,
          surface: s.surface,
          sceneId: s.base.sceneId,
          hasLogo: s.base.logo,
          extraNotes: s.video.notes,
        });

  return (
    <div className="space-y-8">
      <SectionHead
        step={3}
        title="Make it move"
        blurb="Turn the still into a scroll-stopping clip with Seedance 2.0. Animate the scene, or play your uploaded card video directly on the device in it."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-5">
          <Panel title="Engine">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <EngineCard
                active={s.video.engine === "animate"}
                onClick={() => s.setVideo({ engine: "animate" })}
                emoji="🎞️"
                title="Animate the still"
                body="Brings your scene to life. The card already on the surface stays locked in place."
                foot="Seedance 2.0 · image-to-video"
              />
              <EngineCard
                active={s.video.engine === "screen-replace"}
                onClick={() => s.setVideo({ engine: "screen-replace" })}
                emoji="📲"
                title="Play the card clip"
                body="Uses your uploaded 3D card video as a reference so it plays on the surface in the scene."
                foot="Seedance 2.0 · reference-to-video"
                warning={
                  screenReplaceReady
                    ? undefined
                    : "Needs a 2–15s card clip from step 1."
                }
              />
            </div>
          </Panel>

          <Panel title="Motion" aside={<span className="sticker">{motions.length} options</span>}>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                  Make the scene come alive
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {actionMotions.map((m) => (
                    <Chip
                      key={m.id}
                      emoji={m.emoji}
                      active={s.video.motionId === m.id}
                      onClick={() => s.setVideo({ motionId: m.id })}
                    >
                      {m.label}
                    </Chip>
                  ))}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                  People do something and the world moves around them — reactions, background life,
                  wind and weight. Stops the clip reading like a slow pan over a photo.
                </p>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                  Camera only
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {cameraMotions.map((m) => (
                    <Chip
                      key={m.id}
                      emoji={m.emoji}
                      active={s.video.motionId === m.id}
                      onClick={() => s.setVideo({ motionId: m.id })}
                    >
                      {m.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Output">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Resolution">
                  <Select
                    value={s.video.resolution}
                    onChange={(v) => s.setVideo({ resolution: v as typeof s.video.resolution })}
                    options={VIDEO_RESOLUTIONS.map((r) => ({ id: r, label: r.toUpperCase() }))}
                  />
                </Field>
                <Field label="Duration">
                  <Select
                    value={s.video.duration}
                    onChange={(duration) => s.setVideo({ duration })}
                    options={VIDEO_DURATIONS.map((d) => ({
                      id: d,
                      label: d === "auto" ? "Auto" : `${d}s`,
                    }))}
                  />
                </Field>
                <Field label="Aspect">
                  <Select
                    value={s.video.aspectRatio}
                    onChange={(v) => s.setVideo({ aspectRatio: v as typeof s.video.aspectRatio })}
                    options={[
                      { id: "auto", label: "Match still" },
                      { id: "9:16", label: "9:16" },
                      { id: "4:3", label: "4:3" },
                      { id: "3:4", label: "3:4" },
                      { id: "1:1", label: "1:1" },
                      { id: "16:9", label: "16:9" },
                      { id: "21:9", label: "21:9" },
                    ]}
                  />
                </Field>
              </div>

              <Switch
                checked={s.video.generateAudio}
                onChange={(generateAudio) => s.setVideo({ generateAudio })}
                label="Generate audio"
                hint="Seedance can score the clip with ambience and effects at no extra cost. Off is usually right for social — you'll drop a trending sound over it anyway."
              />

              <Field label="Extra direction" hint="Optional notes on the motion.">
                <textarea
                  value={s.video.notes}
                  onChange={(e) => s.setVideo({ notes: e.target.value })}
                  rows={2}
                  placeholder="e.g. she smiles at the end, hair moves in the breeze"
                  className="focus-stamp w-full resize-none rounded-2xl border border-hairline bg-white px-4 py-3 text-sm leading-relaxed transition-colors focus:border-stamp-600"
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Source still" aside={<span className="sticker">{stills.length}</span>}>
            {stills.length ? (
              <div className="grid max-h-80 grid-cols-3 gap-2.5 overflow-y-auto pr-1">
                {stills.map((a) => (
                  <AssetTile
                    key={a.id}
                    asset={a}
                    selectable
                    selected={selectedStillId === a.id}
                    onSelect={() => s.setBaseId(s.baseId === a.id ? null : a.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-2xl border-2 border-dashed border-hairline bg-canvas-2/50 px-6 py-10 text-center text-sm text-ink-faint">
                Generate a scene in step 2 first.
              </p>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <div className="sticky top-[8.5rem] z-20">
            <div
              className={cx(
                "rounded-3xl border p-5 transition-colors",
                s.busy ? "border-stamp-300 bg-stamp-50" : "border-hairline bg-white",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">Render</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-ink-soft">
                    {selectedStill ? selectedStill.label : "Select a still to animate"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {s.busy && (
                    <Button variant="danger" onClick={s.cancelAll}>
                      Stop
                    </Button>
                  )}
                  <Button size="lg" onClick={s.generateVideo} loading={s.busy} disabled={!ready}>
                    {s.busy ? "Rendering…" : "Render video"}
                  </Button>
                </div>
              </div>

              <p className="mt-3 rounded-xl bg-canvas-2 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                🕐 Video renders take a few minutes. Leave this tab open — progress is tracked below.
              </p>

              <button
                type="button"
                onClick={() => setShowPrompt((v) => !v)}
                className="focus-stamp mt-3 text-xs font-bold text-stamp-600 underline decoration-stamp-200 underline-offset-2 hover:decoration-stamp-600"
              >
                {showPrompt ? "Hide" : "Show"} the compiled prompt
              </button>
              {showPrompt && (
                <p className="mt-2 max-h-52 animate-rise overflow-y-auto rounded-2xl bg-canvas-2 p-3.5 font-mono text-[11px] leading-relaxed text-ink-soft">
                  {prompt}
                </p>
              )}
            </div>
          </div>

          <ResultsGrid
            assets={videos}
            kind="video"
            emptyEmoji="🎬"
            emptyText="Finished videos land here, ready to download for TikTok, Reels and Pinterest."
            cols="sm:grid-cols-2"
          />
        </div>
      </div>
    </div>
  );
}

function EngineCard({
  active,
  onClick,
  emoji,
  title,
  body,
  foot,
  warning,
}: {
  active: boolean;
  onClick: () => void;
  emoji: string;
  title: string;
  body: string;
  foot: string;
  warning?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "focus-stamp group flex flex-col rounded-2xl border p-4 text-left transition-all duration-300 active:scale-[0.98]",
        active
          ? "border-stamp-600 bg-stamp-50 shadow-[0_0_0_3px_rgba(190,30,46,0.1)]"
          : "border-hairline bg-white hover:-translate-y-0.5 hover:border-stamp-300",
      )}
    >
      <span className={cx("text-2xl transition-transform duration-300", active && "animate-wobble")}>{emoji}</span>
      <span className="mt-2 font-display text-sm font-bold text-ink">{title}</span>
      <span className="mt-1 flex-1 text-xs leading-relaxed text-ink-soft">{body}</span>
      <span className="mt-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">{foot}</span>
      {warning && (
        <span className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">
          {warning}
        </span>
      )}
    </button>
  );
}
