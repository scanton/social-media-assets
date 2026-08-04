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
import { canStampVideo } from "@/lib/video-logo";
import { useStudio } from "./studio-store";
import { Button, Chip, Field, Select, Switch, cx } from "./ui";
import { Panel, ResultsGrid, SectionHead } from "./steps/shared";

/**
 * Scene, motion and output on one page, rendered straight through Seedance with
 * no still in between.
 *
 * Both products land here. A generated still turned out to cost more than it
 * gave: the digital flow fought it, and on printed cards it invented people
 * whose faces then had to be animated. Handing the model the artwork itself and
 * describing the scene in words avoids both.
 */
export function OneShot() {
  const s = useStudio();
  const { base, video } = s;
  const [showPrompt, setShowPrompt] = useState(false);
  // Re-encoding needs MediaRecorder + canvas capture; every current browser has
  // them, but fail visibly rather than silently dropping the logo.
  const stampable = canStampVideo();

  const isPrint = s.surface === "print";
  const clip = s.assets.find((a) => a.id === s.cardVideoId && a.kind === "card-video");
  const front = s.assets.find((a) => a.id === s.cardFrontId && a.kind === "card-art");
  const inside = s.assets.find((a) => a.id === s.cardInsideId && a.kind === "card-art");
  const videos = s.assets.filter((a) => a.kind === "video");

  const devices = DEVICES.filter((d) => d.surface === s.surface);
  const scenes = useMemo(
    () => SCENES.filter((sc) => !sc.audience || sc.audience.includes(base.audienceId)),
    [base.audienceId],
  );
  const sceneMissing = !scenes.some((sc) => sc.id === base.sceneId);

  // Opening motions have nothing truthful to reveal without the inside spread.
  const motions = MOTIONS.filter(
    (m) => (!m.surface || m.surface === s.surface) && (!m.requiresInside || Boolean(inside)),
  );
  const lockedOpeners = MOTIONS.filter(
    (m) => m.requiresInside && m.surface === s.surface && !inside,
  );

  const selectedMotion = MOTIONS.find((m) => m.id === video.motionId);
  const opensCard = Boolean(isPrint && selectedMotion?.requiresInside && inside);
  // "Card held — opened" shows the inside without an animated open, so it sends
  // the spread too. Mirrors the rule in studio-store's generateOneShot.
  const heldOpen = Boolean(
    isPrint && DEVICES.find((d) => d.id === base.deviceId)?.showsInside && inside && !opensCard,
  );
  const insideAttached = opensCard || heldOpen;
  const ready = isPrint ? Boolean(front) : Boolean(clip);

  const prompt = buildOneShotPrompt({
    surface: s.surface,
    deviceId: base.deviceId,
    sceneId: base.sceneId,
    angleId: base.angleIds[0] ?? "pov",
    lightingId: base.lightingId,
    lookId: base.lookId,
    presenceId: base.presenceId,
    audienceId: base.audienceId,
    framingId: base.framingId,
    motionId: video.motionId,
    hasInside: Boolean(inside),
    extraNotes: [base.notes, video.notes].filter(Boolean).join(" "),
  });

  return (
    <div className="space-y-8">
      <SectionHead
        step={2}
        title="Build the video"
        blurb={
          isPrint
            ? "Describe the scene and hand Seedance your card artwork in a single pass. It builds the whole shot around the real printed panels, so nothing has to be animated from an invented still. The logo is burned into the finished clip afterwards."
            : "Describe the scene and hand Seedance your card animation in a single pass. It plays on the device in the shot it builds. The logo is burned into the finished clip afterwards."
        }
      />

      {!ready && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            ⚠️{" "}
            {isPrint
              ? "Add the printed front panel — it's what the whole shot is built around."
              : "Add the card animation clip — it's the only thing that goes on the screen."}
          </p>
          <Button variant="outline" size="sm" onClick={() => s.setStep(1)}>
            Go to step 1
          </Button>
        </div>
      )}

      {/* What actually goes into the render. */}
      {ready && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-hairline bg-white px-4 py-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">
            References
          </span>
          {isPrint ? (
            <>
              <RefChip label="Front" sub="@Image1" asset={front!} active />
              {inside ? (
                <>
                  <RefChip
                    label="Inside spread"
                    sub={insideAttached ? "@Image2" : "not sent"}
                    asset={inside}
                    active={insideAttached}
                  />
                  {!insideAttached && (
                    <span className="text-xs leading-snug text-ink-faint">
                      Pick an opening motion — or the &ldquo;Card held — opened&rdquo; framing — to
                      send it.
                    </span>
                  )}
                </>
              ) : (
                <span className="text-xs leading-snug text-ink-faint">
                  No inside spread — the card stays closed.
                </span>
              )}
            </>
          ) : (
            <RefChip label={clip!.label} sub="@Video1" asset={clip!} active video />
          )}
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

            {lockedOpeners.length > 0 && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-amber-900">
                  🔒 {lockedOpeners.map((m) => m.label).join(", ")}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                  Opening the card needs the inside spread, otherwise the model invents what&apos;s
                  printed inside.{" "}
                  <button
                    type="button"
                    onClick={() => s.setStep(1)}
                    className="focus-stamp font-bold underline underline-offset-2"
                  >
                    Add it in step 1
                  </button>
                  .
                </p>
              </div>
            )}
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
                checked={base.logo && stampable}
                onChange={(logo) => s.setBase({ logo })}
                label="Stamp the HeartStamp logo"
                hint={
                  stampable
                    ? "Redraws the finished clip through a canvas with the emblem burned into the bottom-right corner, exactly where Flow 1 puts it. Runs in this tab and takes about as long as the clip."
                    : "Unavailable — this browser can't re-encode video. Try Chrome, Edge or Safari."
                }
              />

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
                    {opensCard
                      ? "Card opens to the inside spread"
                      : isPrint
                        ? "Front panel only"
                        : clip
                          ? clip.label
                          : "No card clip selected"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {s.busy && (
                    <Button variant="danger" onClick={s.cancelAll}>
                      Stop
                    </Button>
                  )}
                  <Button size="lg" onClick={s.generateOneShot} loading={s.busy} disabled={!ready}>
                    {s.busy ? "Rendering…" : "Render video"}
                  </Button>
                </div>
              </div>

              <p className="mt-3 rounded-xl bg-canvas-2 px-3 py-2 text-xs leading-relaxed text-ink-soft">
                🕐 One Seedance call, a few minutes{base.logo && stampable ? ", then a logo pass in this tab that runs about as long as the clip" : ""}.
                Keep this tab open.
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
            emptyText="Finished clips land here, ready to download for TikTok, Reels and Pinterest."
            cols="sm:grid-cols-2"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * One reference that will be handed to Seedance. `active` is the honest bit:
 * an uploaded inside spread is only sent when the shot actually shows it, so a
 * greyed chip means "we have it, we're not sending it this time".
 */
function RefChip({
  label,
  sub,
  asset,
  active,
  video,
}: {
  label: string;
  sub: string;
  asset: { url: string; label: string };
  active: boolean;
  video?: boolean;
}) {
  return (
    <span
      className={cx(
        "flex items-center gap-2 rounded-xl border py-1 pl-1 pr-2.5 transition-opacity",
        active ? "border-stamp-200 bg-stamp-50" : "border-hairline bg-canvas-2 opacity-55",
      )}
    >
      {video ? (
        <video
          src={asset.url}
          className="h-9 w-9 rounded-lg object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={asset.url} alt="" className="h-9 w-9 rounded-lg object-cover" />
      )}
      <span className="min-w-0">
        <span className={cx("block max-w-40 truncate text-[11px] font-bold", active ? "text-stamp-800" : "text-ink")}>
          {label}
        </span>
        <span
          className={cx(
            "block font-mono text-[10px] leading-tight",
            active ? "text-stamp-600" : "text-ink-faint",
          )}
        >
          {sub}
        </span>
      </span>
    </span>
  );
}
