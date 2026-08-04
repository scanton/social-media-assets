"use client";

import { useMemo, useState } from "react";
import { uploadToFal } from "@/lib/client-api";
import type { Asset } from "@/lib/studio-types";
import {
  ANGLES,
  ASPECTS,
  AUDIENCES,
  buildScenePrompt,
  DEVICES,
  LIGHTING,
  LOOKS,
  FRAMINGS,
  PRESENCE,
  SCENES,
  type AspectId,
} from "@/lib/options";
import { useStudio, uid } from "../studio-store";
import { Uploader } from "../Uploader";
import { ScreenAligner } from "../ScreenAligner";
import { Button, Chip, Field, Select, Stepper, cx, useToast } from "../ui";
import { Panel, ResultsGrid, SectionHead } from "./shared";

export function Step2Scene() {
  const s = useStudio();
  const toast = useToast();
  const { base } = s;
  const [showPrompt, setShowPrompt] = useState(false);
  const [aligning, setAligning] = useState<Asset | null>(null);

  /**
   * Scenes rendered in an earlier session (or shot elsewhere) can be dropped
   * straight in — they become normal `base` assets and go through step 3 the
   * same way. Uploaded as-is: anything saved out of this tool already carries
   * the logo, and re-stamping would double it up.
   */
  const uploadScene = async (file: File, onProgress: (pct: number) => void) => {
    if (!s.keyConnected) {
      s.openKeyDialog();
      return;
    }
    try {
      const url = await uploadToFal(file, onProgress);
      const asset: Asset = {
        id: uid(),
        kind: "base",
        url,
        contentType: file.type,
        label: file.name.replace(/\.\w+$/, ""),
        tags: [
          "uploaded",
          file.size < 1024 * 1024
            ? `${Math.max(1, Math.round(file.size / 1024))}KB`
            : `${(file.size / 1024 / 1024).toFixed(1)}MB`,
        ],
        createdAt: Date.now(),
        surface: s.surface,
      };
      s.addAssets([asset]);
      s.setBaseId(asset.id);
      toast("Scene added. Head to step 3 to animate it.", "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const devices = DEVICES.filter((d) => d.surface === s.surface);
  const scenes = useMemo(
    () => SCENES.filter((sc) => !sc.audience || sc.audience.includes(base.audienceId)),
    [base.audienceId],
  );

  const baseAssets = s.assets.filter((a) => a.kind === "base");

  const toggleIn = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

  const cardAsset = s.assets.find((a) => a.id === s.cardFrontId && a.kind === "card-art");
  const hasCard = Boolean(cardAsset);

  const previewPrompt = buildScenePrompt({
    surface: s.surface,
    deviceId: base.deviceId,
    sceneId: base.sceneId,
    angleId: base.angleIds[0] ?? "pov",
    lightingId: base.lightingId,
    lookId: base.lookId,
    presenceId: base.presenceId,
    audienceId: base.audienceId,
    framingId: base.framingId,
    aspect: base.aspectIds[0] ?? "9:16",
    hasCard,
    extraNotes: base.notes,
  });

  // Scene may not exist for the newly-picked audience — fall back visibly.
  const sceneMissing = !scenes.some((sc) => sc.id === base.sceneId);

  return (
    <div className="space-y-8">
      <SectionHead
        step={2}
        title="Build the scene"
        blurb={
          hasCard
            ? "Photoreal lifestyle shots with your front panel already printed on the card. Check multiple angles and orientations to batch a whole shoot at once — the logo goes on in step 3."
            : "No front panel selected, so the card will render blank. Pick artwork in step 1 to have it printed straight into the scene."
        }
      />

      {!hasCard && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-900">
            ⚠️ No front panel selected — the card will come out blank.
          </p>
          <Button variant="outline" size="sm" onClick={() => s.setStep(1)}>
            Add front artwork
          </Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ------------------------- controls ------------------------- */}
        <div className="space-y-5">
          <Panel title="The scene">
            <div className="space-y-4">
              <Field label="Audience" hint="Filters the scene list and steers wardrobe and props.">
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

              <Field
                label="Device / surface"
                hint="Mix these up across a campaign so every asset isn't the same hardware."
              >
                <Select
                  value={base.deviceId}
                  onChange={(deviceId) => {
                    const d = DEVICES.find((x) => x.id === deviceId);
                    s.setBase({
                      deviceId,
                      aspectIds: d?.defaultAspect
                        ? Array.from(new Set([...base.aspectIds, d.defaultAspect as AspectId]))
                        : base.aspectIds,
                    });
                  }}
                  options={devices.map((d) => ({ id: d.id, label: d.label, emoji: d.emoji }))}
                />
              </Field>

              <Field
                label="Setting"
                hint={sceneMissing ? "This setting isn't typical for that audience — still fair game." : undefined}
              >
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

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Who's in frame">
                  <Select
                    value={base.presenceId}
                    onChange={(presenceId) => s.setBase({ presenceId })}
                    options={PRESENCE.map((p) => ({ id: p.id, label: p.label, emoji: p.emoji }))}
                  />
                </Field>
                <Field
                  label="How close"
                  hint="How much of the frame the card takes up."
                >
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
            </div>
          </Panel>

          <Panel
            title="Camera angles"
            aside={
              <span className="sticker">
                {base.angleIds.length} selected
              </span>
            }
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ANGLES.map((a) => (
                <Chip
                  key={a.id}
                  emoji={a.emoji}
                  active={base.angleIds.includes(a.id)}
                  onClick={() => s.setBase({ angleIds: toggleIn(base.angleIds, a.id) })}
                >
                  {a.label}
                </Chip>
              ))}
            </div>
          </Panel>

          <Panel
            title="Orientations"
            aside={<span className="sticker">{base.aspectIds.length} selected</span>}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ASPECTS.map((a) => (
                <Chip
                  key={a.id}
                  active={base.aspectIds.includes(a.id)}
                  onClick={() => s.setBase({ aspectIds: toggleIn(base.aspectIds, a.id) })}
                  sub={a.channel}
                >
                  {a.label}
                </Chip>
              ))}
            </div>
          </Panel>

          <Panel title="Output">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Variations per combo" hint="Each is a separate render — GPT-Image-2 has no seed input, so re-rolls are how you get variety.">
                  <Stepper
                    value={base.variations}
                    onChange={(variations) => s.setBase({ variations })}
                    min={1}
                    max={6}
                    suffix="per combo"
                  />
                </Field>
                <Field label="Quality">
                  <Select
                    value={base.quality}
                    onChange={(q) => s.setBase({ quality: q as typeof base.quality })}
                    options={[
                      { id: "high", label: "High", emoji: "💎", hint: "Best detail, slowest" },
                      { id: "medium", label: "Medium", emoji: "⚖️" },
                      { id: "low", label: "Low", emoji: "⚡", hint: "Fast drafts" },
                      { id: "auto", label: "Auto", emoji: "🪄" },
                    ]}
                  />
                </Field>
              </div>

              <Field label="Extra direction" hint="Optional. Anything specific — props, wardrobe, a colour story.">
                <textarea
                  value={base.notes}
                  onChange={(e) => s.setBase({ notes: e.target.value })}
                  rows={3}
                  placeholder="e.g. red nails, silver jewellery, a Labubu keychain on the bag"
                  className="focus-stamp w-full resize-none rounded-2xl border border-hairline bg-white px-4 py-3 text-sm leading-relaxed transition-colors focus:border-stamp-600"
                />
              </Field>
            </div>
          </Panel>
        </div>

        {/* -------------------------- results -------------------------- */}
        <div className="space-y-5">
          <div className="sticky top-[8.5rem] z-20 space-y-4">
            <div
              className={cx(
                "rounded-3xl border p-5 transition-colors",
                s.busy ? "border-stamp-300 bg-stamp-50" : "border-hairline bg-white",
              )}
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                    This batch
                  </p>
                  <p className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
                    <span key={s.basePlanCount} className="inline-block animate-pop-in">
                      {s.basePlanCount}
                    </span>{" "}
                    <span className="text-base font-bold text-ink-soft">
                      image{s.basePlanCount === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {base.angleIds.length} angle{base.angleIds.length === 1 ? "" : "s"} ×{" "}
                    {base.aspectIds.length} orientation{base.aspectIds.length === 1 ? "" : "s"} ×{" "}
                    {base.variations} variation{base.variations === 1 ? "" : "s"}
                  </p>

                  {/* Exactly what will land on the screen — a blank render used
                      to be silently possible with no way to see it coming. */}
                  <div
                    className={cx(
                      "mt-3 flex items-center gap-2 rounded-2xl border px-2.5 py-2",
                      hasCard ? "border-hairline bg-white" : "border-amber-200 bg-amber-50",
                    )}
                  >
                    {hasCard ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={cardAsset!.url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-hairline"
                      />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-base ring-1 ring-amber-200">
                        ⬜
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                        On the card
                      </span>
                      <span
                        className={cx(
                          "block truncate text-xs font-semibold",
                          hasCard ? "text-ink" : "text-amber-900",
                        )}
                      >
                        {hasCard ? cardAsset!.label : "Blank — no front panel selected"}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  {s.busy ? (
                    <Button variant="danger" onClick={s.cancelAll}>
                      Stop
                    </Button>
                  ) : null}
                  <Button size="lg" onClick={s.generateScenes} loading={s.busy} disabled={s.basePlanCount === 0}>
                    {s.busy ? "Rendering…" : "Generate scenes"}
                  </Button>
                </div>
              </div>

              {s.basePlanCount > 12 && !s.busy && (
                <p className="mt-3 rounded-xl bg-white px-3 py-2 text-xs font-medium text-ink-soft">
                  ⚠️ That&apos;s {s.basePlanCount} billable renders on your fal account. Runs 3 at a time.
                </p>
              )}

              <button
                type="button"
                onClick={() => setShowPrompt((v) => !v)}
                className="focus-stamp mt-3 text-xs font-bold text-stamp-600 underline decoration-stamp-200 underline-offset-2 hover:decoration-stamp-600"
              >
                {showPrompt ? "Hide" : "Show"} the compiled prompt
              </button>
              {showPrompt && (
                <p className="mt-2 max-h-52 animate-rise overflow-y-auto rounded-2xl bg-canvas-2 p-3.5 font-mono text-[11px] leading-relaxed text-ink-soft">
                  {previewPrompt}
                </p>
              )}
            </div>
          </div>

          <details className="group rounded-3xl border border-hairline bg-white p-4">
            <summary className="focus-stamp flex cursor-pointer list-none items-center justify-between gap-3">
              <span>
                <span className="font-display text-sm font-bold text-ink">
                  Already have a scene?
                </span>
                <span className="mt-0.5 block text-xs text-ink-faint">
                  Drop in a still you rendered earlier and skip straight to step 3.
                </span>
              </span>
              <span className="shrink-0 text-xs font-bold text-stamp-600 transition-transform duration-300 group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="mt-4">
              <Uploader
                emoji="🖼️"
                accept="image/png,image/jpeg,image/webp"
                title="Drop a finished scene"
                subtitle="Uploaded as-is. The logo is added to the video in step 3, not to the still."
                onFile={uploadScene}
              />
            </div>
          </details>

          <ResultsGrid
            assets={baseAssets}
            kind="base"
            selectedId={s.baseId}
            onSelect={(id) => s.setBaseId(s.baseId === id ? null : id)}
            emptyEmoji="📸"
            emptyText="Your finished scenes land here. Pick the combos on the left, then hit generate."
            cols="sm:grid-cols-3"
            onAlign={setAligning}
          />

          {baseAssets.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={() => s.setStep(3)}
                disabled={!s.baseId}
                title={s.baseId ? undefined : "Select a scene first"}
              >
                Make it move
                <span aria-hidden>→</span>
              </Button>
            </div>
          )}
        </div>
      </div>

      {aligning && <ScreenAligner asset={aligning} onClose={() => setAligning(null)} />}
    </div>
  );
}
