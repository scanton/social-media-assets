"use client";

import { useEffect, useState } from "react";
import { MODEL_SLOTS, type ModelSlotId } from "@/lib/models";
import { loadCatalog, useModelChoices, type CatalogEntry } from "@/lib/model-prefs";
import { useProvider } from "@/lib/use-provider";
import { Select, cx } from "./ui";
import { HelpTip } from "./HelpTip";

/**
 * Lets a step run on a different model, on whichever provider is active.
 *
 * The list is fetched on first open rather than on mount: it costs a catalogue
 * sweep upstream, and most sessions never touch it. Until then the collapsed
 * row just names what's running, which is the common case.
 *
 * Only models that can actually carry this step's payload are offered — see
 * lib/model-catalog.ts. The trade is that `supports` may still be false for
 * tuning controls, so the honest thing is to say which of them this model will
 * ignore before a render is spent finding out.
 */
export function ModelPicker({ slot }: { slot: ModelSlotId }) {
  const definition = MODEL_SLOTS[slot];
  const { setChoice, modelFor } = useModelChoices();
  const selected = modelFor(slot);

  const [open, setOpen] = useState(false);
  const { provider } = useProvider();
  /*
   * The loaded list remembers which provider it came from.
   *
   * Derived rather than reset in an effect: the two catalogues share no model
   * ids, so a list fetched for fal is simply not an answer to "what can run on
   * Replicate", and treating a mismatch as "nothing loaded" states that once
   * instead of racing a reset against the fetch that follows it.
   */
  const [loaded, setLoaded] = useState<{
    provider: string;
    models: CatalogEntry[];
    partial: boolean;
  } | null>(null);
  const [failure, setFailure] = useState<{ provider: string; message: string } | null>(null);

  const models = loaded && loaded.provider === provider ? loaded.models : null;
  const partial = loaded?.provider === provider ? loaded.partial : false;
  const error = failure?.provider === provider ? failure.message : null;

  // `error` gates the fetch too, so a failure doesn't immediately retry itself.
  // Clearing it is what Retry does, which is also what re-arms this effect.
  useEffect(() => {
    if (!open || models || error) return;
    let live = true;
    loadCatalog(slot)
      .then((res) => {
        if (!live) return;
        setLoaded({ provider, models: res.models, partial: res.partial });
      })
      .catch((err: Error) => live && setFailure({ provider, message: err.message }));
    return () => {
      live = false;
    };
  }, [open, models, error, slot, provider]);

  const current = models?.find((m) => m.id === selected);
  const isDefault = selected === definition.fallback;

  /*
   * Only the controls this kind of step actually has. Warning an image model
   * that it has no `duration` is noise — it was never going to.
   */
  const isVideoStep = definition.category === "image-to-video";
  const ignored = current
    ? (isVideoStep
        ? ([
            [current.supports.resolution, "resolution"],
            [current.supports.duration, "duration"],
            [current.supports.aspectRatio, "orientation"],
            [current.supports.audio, "audio"],
          ] as const)
        : ([
            // The studio sets orientation by sending exact pixel dimensions, so
            // a model without image_size decides the crop for itself.
            [current.supports.imageSize, "orientation"],
            [current.supports.numImages, "images per render"],
          ] as const)
      )
        .filter(([ok]) => !ok)
        .map(([, name]) => name)
    : [];

  return (
    /*
     * `relative z-30` is load-bearing, not decoration.
     *
     * The expanded body below uses `animate-rise`, which ends on
     * `transform: translateY(0)` with fill-mode `both` — so the transform sticks
     * around after the animation and permanently makes that element a stacking
     * context. The model list's own `z-40` is therefore scoped *inside* it and
     * loses to the panels further down the column, which is how the card-size
     * control ended up painting over the list. Raising the whole picker fixes it
     * at the right level. z-30 clears the sibling panels and the sticky batch
     * card (z-20) while staying under the sticky header (z-40).
     */
    <div className="relative z-30 rounded-2xl border border-hairline bg-canvas-2/60 p-3">
      {/* Outside the header button, which is the whole row. */}
      <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="focus-stamp flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">
            {definition.label} model
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <span className="truncate font-mono text-[11px] font-semibold text-ink">
              {current?.title ?? selected}
            </span>
            {!isDefault && (
              <span className="shrink-0 rounded-full bg-stamp-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                custom
              </span>
            )}
          </span>
        </span>
        <span
          className={cx(
            "shrink-0 text-xs font-bold text-stamp-600 transition-transform duration-300",
            open && "rotate-180",
          )}
        >
          ▾
        </span>
      </button>
      <HelpTip id={`model.${slot}`} />
      </div>

      {open && (
        <div className="mt-3 animate-rise space-y-2.5">
          <p className="text-xs leading-relaxed text-ink-faint">{definition.blurb}</p>

          {error ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
              {error}{" "}
              <button
                type="button"
                onClick={() => {
                  setFailure(null);
                  setLoaded(null);
                }}
                className="focus-stamp font-bold underline underline-offset-2"
              >
                Retry
              </button>
            </p>
          ) : !models ? (
            <p className="flex items-center gap-2 px-1 text-xs text-ink-faint">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-stamp-300 border-t-transparent" />
              Checking which models can run this step…
            </p>
          ) : (
            <>
              <Select
                value={selected}
                onChange={(id) => setChoice(slot, id, provider)}
                options={models.map((m) => ({
                  id: m.id,
                  label: m.title,
                  hint: m.isDefault ? "Default" : m.group,
                }))}
              />

              <p className="px-1 font-mono text-[10px] leading-relaxed text-ink-faint">{selected}</p>

              {current?.description && (
                <p className="text-xs leading-relaxed text-ink-soft">{current.description}</p>
              )}

              {ignored.length > 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                  This model has no {ignored.join(", ")} setting — those controls are dropped and
                  its own defaults apply.
                </p>
              )}

              {/*
                * Louder than the one above, because it is a different kind of
                * problem. A dropped control gives you a render you did not
                * quite ask for; a clip the model will not accept gives you no
                * render at all, and the studio cannot adapt around it — the
                * limit is enforced by fal and absent from the schema. Gemini
                * Omni Flash takes three seconds of reference video, and a card
                * animation is eight to thirteen.
                */}
              {current?.clipLimit && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-relaxed text-rose-900">
                  <span className="font-semibold">Reference clip limits:</span> {current.clipLimit}{" "}
                  Your card animation has to fit, or the render is rejected before it starts.
                </p>
              )}

              {partial ? (
                <p className="text-xs text-ink-faint">
                  fal&apos;s model list is unreachable, so only the built-in default is offered.
                </p>
              ) : (
                <p className="text-xs text-ink-faint">
                  {models.length} model{models.length === 1 ? "" : "s"} can run this step, newest
                  first.{" "}
                  {!isDefault && (
                    <button
                      type="button"
                      onClick={() => setChoice(slot, null, provider)}
                      className="focus-stamp font-bold text-stamp-600 underline underline-offset-2"
                    >
                      Reset to default
                    </button>
                  )}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
