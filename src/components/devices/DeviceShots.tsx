"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ANGLES, ASPECTS, AUDIENCES, DEVICES, DEVICE_FRAMINGS, LIGHTING, LOOKS, SCENES,
  SUBJECT_AGES, SUBJECT_GENDERS, ETHNICITIES, imageSizeFor,
  buildDeviceShotPrompt,
  type AspectId, type SubjectAgeId, type SubjectGenderId,
} from "@/lib/options";
import { useJobRunner, type JobSpec } from "@/lib/use-jobs";
import { punchInOnScreen } from "@/lib/device-punch-in";
import { MODEL_SLOTS, slotFallback } from "@/lib/models";
import { useProviders } from "@/lib/use-provider";
import { PROVIDERS } from "@/lib/providers";
import { toPromptDialect } from "@/lib/prompt-dialect";
import type { Asset } from "@/lib/studio-types";
import { PendingTile } from "../AssetTile";
import { PlatePair, type PlateChoice } from "./PlatePair";
import { KeyDialog } from "../KeyDialog";
import { Panel } from "../steps/shared";
import { Button, Field, Select, Switch, cx, useToast } from "../ui";

/**
 * Device plates: an extreme closeup of a blank screen, in somebody's hand.
 *
 * A tool rather than a mode of the card pipelines, because the output is not an
 * asset in its own right — it is a PLATE, made to have card artwork composited
 * onto it afterwards. Everything about it follows from that: the screen is flat
 * white so it can be keyed, nothing may cross it, and the framing scale starts
 * where the scene step's ends.
 *
 * The taxonomies are shared rather than copied. "Whose hand, in what room, lit
 * how" already has an answer in this codebase, and this is the third place
 * asking the question.
 */

type Shot = {
  deviceId: string;
  sceneId: string;
  angleId: string;
  lightingId: string;
  lookId: string;
  framingId: string;
  audienceId: string;
  ethnicityId: string;
  genderId: SubjectGenderId;
  ageId: SubjectAgeId;
  handsOff: boolean;
  variations: number;
  notes: string;
};

/**
 * Renders come back a tier above the 1080p they are delivered at, so the
 * crop-in (lib/device-punch-in) can zoom a third of the way without upscaling.
 */
const RENDER_TIER = "1440p";

const DEFAULTS: Shot = {
  deviceId: "iphone-portrait",
  sceneId: "coffee-shop",
  angleId: "eye-level",
  lightingId: "golden",
  lookId: "editorial",
  framingId: "extreme",
  audienceId: "genz",
  ethnicityId: "unspecified",
  genderId: "unspecified",
  ageId: "adult",
  handsOff: false,
  variations: 1,
  notes: "",
};

export function DeviceShots() {
  const toast = useToast();
  const { providers } = useProviders();
  const [shot, setShot] = useState<Shot>(DEFAULTS);
  const [aspects, setAspects] = useState<AspectId[]>(["9:16"]);
  const [assets, setAssets] = useState<Asset[]>([]);
  // Which version of each plate is in use. Unset means the cropped one.
  const [choices, setChoices] = useState<Record<string, PlateChoice>>({});
  const [showPrompt, setShowPrompt] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyHint, setKeyHint] = useState<string | null>(null);

  const patch = (next: Partial<Shot>) => setShot((p) => ({ ...p, ...next }));

  const runner = useJobRunner({
    onAssets: (made) => setAssets((prev) => [...made, ...prev]),
    onNeedKey: () => setKeyOpen(true),
    onBatchDone: ({ produced, failed, firstError }) => {
      if (failed && firstError) toast(firstError, "error");
      else if (produced) toast(`${produced} plate${produced > 1 ? "s" : ""} ready.`, "success");
    },
  });

  // Screen devices only: a printed card has no screen to leave blank.
  const devices = useMemo(() => DEVICES.filter((d) => d.surface === "screen"), []);

  const preview = useMemo(
    () => buildDeviceShotPrompt({ ...shot, aspect: aspects[0] ?? "9:16", extraNotes: shot.notes }),
    [shot, aspects],
  );

  const planCount = aspects.length * Math.max(1, shot.variations);

  const generate = () => {
    if (!aspects.length) {
      toast("Pick at least one orientation.", "error");
      return;
    }
    const specs: JobSpec[] = [];
    for (const aspect of aspects) {
      for (let v = 1; v <= shot.variations; v++) {
        const prompt = buildDeviceShotPrompt({ ...shot, aspect, extraNotes: shot.notes });
        const finalSize = imageSizeFor(aspect, "1080p");
        specs.push({
          label: `${devices.find((d) => d.id === shot.deviceId)?.label ?? "Device"} · ${aspect} · v${v}`,
          kind: "base",
          slot: "baseImage",
          // The image provider's own default — a fal id means nothing to OpenAI.
          model: slotFallback(MODEL_SLOTS.baseImage, providers.image),
          input: {
            prompt,
            // A size up, so the crop-in below has pixels to spend.
            image_size: imageSizeFor(aspect, RENDER_TIER),
            num_images: 1,
            output_format: "png",
          },
          toAssets: async (data, jobId, setStage) => {
            const images = (data as { images?: { url: string; content_type?: string }[] }).images ?? [];
            setStage("Moving in on the screen");
            const out = await Promise.all(
              images.map(async (img) => {
                try {
                  return await punchInOnScreen({ url: img.url, framingId: shot.framingId, ...finalSize });
                } catch {
                  // A plate that could not be cropped is still a plate.
                  return { url: img.url, zoom: 1, found: false };
                }
              }),
            );
            setStage(undefined);
            return out.map((p, i): Asset => ({
              id: `${jobId}-${i}`,
              kind: "base" as const,
              url: p.url,
              contentType: p.url === images[i].url ? images[i].content_type : "image/png",
              // Kept so the plate can be shown both ways and the person can pick.
              // A plate that was only resized has nothing to compare.
              rawUrl: p.zoom > 1 ? images[i].url : undefined,
              cropZoom: p.zoom,
              label: `Plate · ${aspect} · v${v}`,
              tags: [
                aspect,
                shot.framingId,
                shot.handsOff ? "no hands" : "in hand",
                "blank screen",
                ...(p.found ? [] : ["screen not found"]),
              ],
              createdAt: Date.now(),
              prompt,
              aspect,
              surface: "screen" as const,
            }));
          },
        });
      }
    }
    void runner.run(specs);
  };

  const live = runner.jobs.filter((j) => j.state !== "done" && j.state !== "cancelled");

  return (
    <div className="mx-auto max-w-[110rem] px-4 py-8 sm:px-6">
      <header className="mb-6">
        <Link
          href="/"
          className="focus-stamp mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-ink-faint transition-colors hover:text-stamp-600"
        >
          <span aria-hidden>←</span> Asset Studio
        </Link>
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-stamp-600">PLATES</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Device Shots
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Extreme closeups of a device with a blank white screen, in a hand and a place you choose.
          These are plates: the screen is left clean so card artwork can be dropped onto it later,
          and nothing is allowed to cross it.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <Panel title="The device" help="plate.device">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Device" help="scene.device">
                  <Select
                    value={shot.deviceId}
                    onChange={(deviceId) => patch({ deviceId })}
                    options={devices.map((d) => ({ id: d.id, label: d.label, emoji: d.emoji }))}
                  />
                </Field>
                <Field
                  label="How close"
                  help="plate.framing"
                  hint="Every setting here is closer than the card pipelines go."
                >
                  <Select
                    value={shot.framingId}
                    onChange={(framingId) => patch({ framingId })}
                    options={DEVICE_FRAMINGS.map((f) => ({
                      id: f.id, label: f.label, emoji: f.emoji, hint: f.hint,
                    }))}
                  />
                </Field>
              </div>

              <Field label="Orientations" help="scene.aspect" hint="One render per orientation, per variation.">
                <div className="flex flex-wrap gap-2">
                  {ASPECTS.map((a) => {
                    const on = aspects.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() =>
                          setAspects((prev) =>
                            on ? prev.filter((x) => x !== a.id) : [...prev, a.id],
                          )
                        }
                        className={cx(
                          "focus-stamp rounded-full border px-3 py-1.5 text-xs font-bold transition-all",
                          on
                            ? "border-stamp-300 bg-stamp-50 text-stamp-800"
                            : "border-hairline bg-white text-ink-faint hover:border-stamp-300",
                        )}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>
          </Panel>

          <Panel title="Whose hand" help="plate.hands">
            <div className="space-y-4">
              <Switch
                checked={shot.handsOff}
                onChange={(handsOff) => patch({ handsOff })}
                label="No hands"
                hint={
                  shot.handsOff
                    ? "The device stands or lies on a surface by itself."
                    : "One hand, holding it by the edges — never over the screen."
                }
              />
              {!shot.handsOff && (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Reads as" help="scene.gender">
                    <Select
                      value={shot.genderId}
                      onChange={(genderId) => patch({ genderId: genderId as SubjectGenderId })}
                      options={SUBJECT_GENDERS.map((g) => ({ id: g.id, label: g.label, emoji: g.emoji }))}
                    />
                  </Field>
                  <Field label="Age" help="scene.age">
                    <Select
                      value={shot.ageId}
                      onChange={(ageId) => patch({ ageId: ageId as SubjectAgeId })}
                      options={SUBJECT_AGES.map((a) => ({ id: a.id, label: a.label, emoji: a.emoji }))}
                    />
                  </Field>
                  <Field label="Ethnicity" help="scene.ethnicity">
                    <Select
                      value={shot.ethnicityId}
                      onChange={(ethnicityId) => patch({ ethnicityId })}
                      searchable
                      options={ETHNICITIES.map((e) => ({ id: e.id, label: e.label, emoji: e.emoji }))}
                    />
                  </Field>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="The place" help="plate.place">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Setting" help="scene.setting" hint="Blurred behind the device.">
                  <Select
                    value={shot.sceneId}
                    onChange={(sceneId) => patch({ sceneId })}
                    searchable
                    options={SCENES.map((s) => ({ id: s.id, label: s.label, emoji: s.emoji }))}
                  />
                </Field>
                <Field label="Camera angle" help="scene.angleOne">
                  <Select
                    value={shot.angleId}
                    onChange={(angleId) => patch({ angleId })}
                    options={ANGLES.map((a) => ({ id: a.id, label: a.label, emoji: a.emoji }))}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Lighting" help="scene.lighting">
                  <Select
                    value={shot.lightingId}
                    onChange={(lightingId) => patch({ lightingId })}
                    options={LIGHTING.map((l) => ({ id: l.id, label: l.label, emoji: l.emoji }))}
                  />
                </Field>
                <Field label="Film look" help="scene.look">
                  <Select
                    value={shot.lookId}
                    onChange={(lookId) => patch({ lookId })}
                    options={LOOKS.map((l) => ({ id: l.id, label: l.label, emoji: l.emoji }))}
                  />
                </Field>
                <Field label="Audience" help="scene.audience">
                  <Select
                    value={shot.audienceId}
                    onChange={(audienceId) => patch({ audienceId })}
                    options={AUDIENCES.map((a) => ({ id: a.id, label: a.label, emoji: a.emoji }))}
                  />
                </Field>
              </div>
              <Field label="Extra direction" help="scene.extra" hint="Optional.">
                <textarea
                  value={shot.notes}
                  onChange={(e) => patch({ notes: e.target.value })}
                  rows={2}
                  placeholder="e.g. a chunky gold signet ring, chipped black nail polish"
                  className="focus-stamp w-full resize-none rounded-2xl border border-hairline bg-white px-4 py-3 text-sm"
                />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Panel title="Render" help="plate.render">
            <div className="space-y-3">
              <Field label="Variations" hint={`${planCount} render${planCount > 1 ? "s" : ""} in this batch.`}>
                <input
                  type="range" min={1} max={6} step={1}
                  value={shot.variations}
                  onChange={(e) => patch({ variations: Number(e.target.value) })}
                  className="focus-stamp w-full accent-stamp-600"
                />
              </Field>
              <Button onClick={generate} loading={runner.busy} disabled={runner.busy || !aspects.length}>
                {runner.busy ? "Rendering…" : `Render ${planCount}`}
              </Button>
              <p className="text-xs leading-relaxed text-ink-faint">
                Drawn on {PROVIDERS[providers.image].label}, on your own key.
              </p>
              <button
                type="button"
                onClick={() => setShowPrompt((v) => !v)}
                className="focus-stamp text-xs font-bold text-stamp-600 underline decoration-stamp-200 underline-offset-2"
              >
                {showPrompt ? "Hide" : "Show"} the compiled prompt
              </button>
              {showPrompt && (
                <p className="max-h-64 animate-rise overflow-y-auto rounded-2xl bg-canvas-2 p-3.5 font-mono text-[11px] leading-relaxed text-ink-soft">
                  {toPromptDialect(preview, providers.image)}
                </p>
              )}
            </div>
          </Panel>

          {(assets.length > 0 || live.length > 0) && (
            <Panel title="Plates">
              <div className="grid grid-cols-2 gap-3">
                {live.map((j) => (
                  <PendingTile
                    key={j.id}
                    label={j.label}
                    state={j.state}
                    queuePosition={j.queuePosition}
                    error={j.error}
                    stage={j.stage}
                  />
                ))}
                {assets.map((a) => (
                  <PlatePair
                    key={a.id}
                    asset={a}
                    choice={choices[a.id] ?? "cropped"}
                    onChoose={(next) => setChoices((c) => ({ ...c, [a.id]: next }))}
                    onRemove={() => setAssets((prev) => prev.filter((x) => x.id !== a.id))}
                  />
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      <KeyDialog
        open={keyOpen}
        provider={providers.image}
        connected={Boolean(keyHint)}
        hint={keyHint}
        onClose={() => setKeyOpen(false)}
        onSaved={(h) => setKeyHint(h)}
      />
    </div>
  );
}
