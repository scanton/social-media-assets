"use client";

import { useMemo, useState } from "react";
import {
  ANGLES,
  AUDIENCES,
  buildOneShotPrompt,
  DEVICES,
  FRAMINGS,
  LIGHTING,
  LOOKS,
  MOTIONS,
  PRESENCE,
  SCENES,
  VIDEO_DURATIONS,
  VIDEO_RESOLUTIONS,
} from "@/lib/options";
import { useStudio } from "./studio-store";
import { Button, Chip, Field, Select, Switch, cx } from "./ui";
import { Panel, ResultsGrid } from "./steps/shared";

/**
 * The experiment: describe the scene in words and hand Seedance the card clip,
 * with no still in between. Everything flow 1 spreads across steps 2 and 3 lives
 * on this one page.
 */
export function Flow2() {
  const s = useStudio();
  const { base, video } = s;
  const [showPrompt, setShowPrompt] = useState(false);

  const clip = s.assets.find((a) => a.id === s.cardVideoId && a.kind === "card-video");
  const videos = s.assets.filter((a) => a.kind === "video");

  const devices = DEVICES.filter((d) => d.surface === "screen");
  const scenes = useMemo(
    () => SCENES.filter((sc) => !sc.audience || sc.audience.includes(base.audienceId)),
    [base.audienceId],
  );
  const sceneMissing = !scenes.some((sc) => sc.id === base.sceneId);
  const motions = MOTIONS.filter((m) => !m.surface || m.surface === "screen");

  const prompt = buildOneShotPrompt({
    deviceId: base.deviceId,
    sceneId: base.sceneId,
    angleId: base.angleIds[0] ?? "pov",
    lightingId: base.lightingId,
    lookId: base.lookId,
    presenceId: base.presenceId,
    audienceId: base.audienceId,
    framingId: base.framingId,
    motionId: video.motionId,
    extraNotes: [base.notes, video.notes].filter(Boolean).join(" "),
  });

  return (
    <div className="space-y-8">
      <header className="animate-rise">
        <div className="flex items-center gap-2.5">
          <span className="sticker border-stamp-200 bg-stamp-50 text-stamp-700">Experiment</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stamp-600">
            One shot · no still
          </span>
        </div>
        <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Straight to video
        </h2>
        <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Describe the scene and hand Seedance your card clip in a single pass — no still image in
          between. Faster and simpler, but the artwork is whatever Seedance renders rather than a
          pixel-exact composite, and there&apos;s no still to stamp the logo onto.
        </p>
      </header>

      {!clip && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            ⚠️ Flow 2 needs an uploaded card clip — it&apos;s the only thing that goes on the screen.
          </p>
          <Button variant="outline" size="sm" onClick={() => s.setStep(1)}>
            Go to step 1
          </Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-5">
          <Panel title="The scene">
            <div className="space-y-4">
              <Field label="Audience">
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.map((a) => (
                    <Chip
                      key={a.id}
                      emoji={a.emoji}
                      active={base.audienceId === a.id}
                      onClick={() => s.setBase({ audienceId: a.id })}
                    >
                      {a.label}
                    </Chip>
                  ))}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Device">
                  <Select
                    value={base.deviceId}
                    onChange={(deviceId) => s.setBase({ deviceId })}
                    options={devices.map((d) => ({ id: d.id, label: d.label, emoji: d.emoji }))}
                  />
                </Field>
                <Field label="Setting">
                  <Select
                    value={base.sceneId}
                    onChange={(sceneId) => s.setBase({ sceneId })}
                    options={(sceneMissing ? SCENES : scenes).map((sc) => ({
                      id: sc.id,
                      label: sc.label,
                      emoji: sc.emoji,
                    }))}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Camera angle">
                  <Select
                    value={base.angleIds[0] ?? "pov"}
                    onChange={(id) => s.setBase({ angleIds: [id] })}
                    options={ANGLES.map((a) => ({ id: a.id, label: a.label, emoji: a.emoji }))}
                  />
                </Field>
                <Field label="How close">
                  <Select
                    value={base.framingId}
                    onChange={(framingId) => s.setBase({ framingId })}
                    options={FRAMINGS.map((f) => ({
                      id: f.id,
                      label: f.label,
                      emoji: f.emoji,
                      hint: f.hint,
                    }))}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lighting">
                  <Select
                    value={base.lightingId}
                    onChange={(lightingId) => s.setBase({ lightingId })}
                    options={LIGHTING.map((l) => ({ id: l.id, label: l.label, emoji: l.emoji }))}
                  />
                </Field>
                <Field label="Film look">
                  <Select
                    value={base.lookId}
                    onChange={(lookId) => s.setBase({ lookId })}
                    options={LOOKS.map((l) => ({ id: l.id, label: l.label, emoji: l.emoji }))}
                  />
                </Field>
              </div>

              <Field label="Who's in frame">
                <Select
                  value={base.presenceId}
                  onChange={(presenceId) => s.setBase({ presenceId })}
                  options={PRESENCE.map((p) => ({ id: p.id, label: p.label, emoji: p.emoji }))}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Motion" aside={<span className="sticker">{motions.length} options</span>}>
            <div className="grid grid-cols-2 gap-2">
              {motions.map((m) => (
                <Chip
                  key={m.id}
                  emoji={m.emoji}
                  active={video.motionId === m.id}
                  onClick={() => s.setVideo({ motionId: m.id })}
                >
                  {m.label}
                </Chip>
              ))}
            </div>
          </Panel>

          <Panel title="Output">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Resolution">
                  <Select
                    value={video.resolution}
                    onChange={(v) => s.setVideo({ resolution: v as typeof video.resolution })}
                    options={VIDEO_RESOLUTIONS.map((r) => ({ id: r, label: r.toUpperCase() }))}
                  />
                </Field>
                <Field label="Duration">
                  <Select
                    value={video.duration}
                    onChange={(duration) => s.setVideo({ duration })}
                    options={VIDEO_DURATIONS.map((d) => ({
                      id: d,
                      label: d === "auto" ? "Auto" : `${d}s`,
                    }))}
                  />
                </Field>
                <Field label="Orientation">
                  <Select
                    value={video.aspectRatio === "auto" ? "9:16" : video.aspectRatio}
                    onChange={(v) => s.setVideo({ aspectRatio: v as typeof video.aspectRatio })}
                    options={[
                      { id: "9:16", label: "9:16", hint: "TikTok / Reels" },
                      { id: "3:4", label: "3:4" },
                      { id: "1:1", label: "1:1" },
                      { id: "4:3", label: "4:3" },
                      { id: "16:9", label: "16:9" },
                      { id: "21:9", label: "21:9" },
                    ]}
                  />
                </Field>
              </div>

              <Switch
                checked={video.generateAudio}
                onChange={(generateAudio) => s.setVideo({ generateAudio })}
                label="Generate audio"
                hint="Ambience and effects at no extra cost. Usually off for social — you'll drop a trending sound over it."
              />

              <Field label="Extra direction" hint="Applies to both the scene and the motion.">
                <textarea
                  value={video.notes}
                  onChange={(e) => s.setVideo({ notes: e.target.value })}
                  rows={3}
                  placeholder="e.g. red nails, silver jewellery, she laughs at the end"
                  className="focus-stamp w-full resize-none rounded-2xl border border-hairline bg-white px-4 py-3 text-sm leading-relaxed transition-colors focus:border-stamp-600"
                />
              </Field>
            </div>
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
                  <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                    Render
                  </p>
                  <p className="mt-0.5 truncate text-sm font-medium text-ink-soft">
                    {clip ? clip.label : "No card clip selected"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {s.busy && (
                    <Button variant="danger" onClick={s.cancelAll}>
                      Stop
                    </Button>
                  )}
                  <Button size="lg" onClick={s.generateOneShot} loading={s.busy} disabled={!clip}>
                    {s.busy ? "Rendering…" : "Render video"}
                  </Button>
                </div>
              </div>

              <p className="mt-3 rounded-xl bg-canvas-2 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                🕐 One Seedance call, a few minutes. No still, so no logo stamp and no exact-card
                guarantee — that&apos;s the thing being tested.
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
            emptyText="One-shot clips land here. Compare them against flow 1 before picking a winner."
            cols="sm:grid-cols-2"
          />
        </div>
      </div>
    </div>
  );
}
