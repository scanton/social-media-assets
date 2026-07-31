"use client";

import { useState } from "react";
import { buildCompositePrompt } from "@/lib/options";
import { useStudio } from "../studio-store";
import { AssetTile } from "../AssetTile";
import { Button, Stepper, Field, cx } from "../ui";
import { Panel, ResultsGrid, SectionHead } from "./shared";

export function Step3Place() {
  const s = useStudio();
  const [showPrompt, setShowPrompt] = useState(false);

  const bases = s.assets.filter((a) => a.kind === "base");
  const cardArt = s.assets.filter((a) => a.kind === "card-art");
  const composites = s.assets.filter((a) => a.kind === "composite");

  const selectedBase = bases.find((a) => a.id === s.baseId);
  const selectedCard = cardArt.find((a) => a.id === s.cardArtId);
  const ready = Boolean(selectedBase && selectedCard);

  const prompt = buildCompositePrompt({ surface: s.surface, hasBase: true, extraNotes: s.base.notes });

  return (
    <div className="space-y-8">
      <SectionHead
        step={3}
        title="Place the card"
        blurb={
          s.surface === "print"
            ? "Composite your artwork onto the blank printed panel. Perspective, paper texture, lighting and occlusions are matched so it reads as genuinely printed."
            : "Composite your card onto the blank screen. Perspective, glare, colour temperature and occlusions are matched so it reads as genuinely displayed."
        }
      />

      {/* Recipe strip */}
      <div className="grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
        <SlotCard
          title="Base image"
          empty="Pick one below"
          asset={selectedBase}
          onClear={() => s.setBaseId(null)}
        />
        <Operator symbol="+" />
        <SlotCard
          title="Card artwork"
          empty="Pick one below"
          asset={selectedCard}
          onClear={() => s.setCardArtId(null)}
        />
        <Operator symbol="=" />
        <div
          className={cx(
            "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-colors",
            ready ? "border-stamp-300 bg-stamp-50" : "border-hairline bg-canvas-2/50",
          )}
        >
          <span className={cx("text-2xl", ready && "animate-float")}>{ready ? "✨" : "🫥"}</span>
          <p className="mt-1.5 text-xs font-bold text-ink">
            {ready ? "Ready to composite" : "Missing an ingredient"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-5">
          <Panel title="Choose a base image" aside={<span className="sticker">{bases.length}</span>}>
            {bases.length ? (
              <div className="grid max-h-96 grid-cols-3 gap-2.5 overflow-y-auto pr-1">
                {bases.map((a) => (
                  <AssetTile
                    key={a.id}
                    asset={a}
                    selectable
                    selected={s.baseId === a.id}
                    onSelect={() => s.setBaseId(s.baseId === a.id ? null : a.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyHint
                emoji="📸"
                text="No base images yet."
                action={{ label: "Go to step 2", onClick: () => s.setStep(2) }}
              />
            )}
          </Panel>

          <Panel title="Choose card artwork" aside={<span className="sticker">{cardArt.length}</span>}>
            {cardArt.length ? (
              <div className="grid max-h-72 grid-cols-3 gap-2.5 overflow-y-auto pr-1">
                {cardArt.map((a) => (
                  <AssetTile
                    key={a.id}
                    asset={a}
                    selectable
                    selected={s.cardArtId === a.id}
                    onSelect={() => s.setCardArtId(s.cardArtId === a.id ? null : a.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyHint
                emoji="🎨"
                text="No card artwork uploaded yet."
                action={{ label: "Go to step 1", onClick: () => s.setStep(1) }}
              />
            )}
          </Panel>

          <Panel title="Options">
            <Field
              label="Composite variations"
              hint="Each attempt places the artwork slightly differently. Pick the cleanest one."
            >
              <Stepper
                value={s.base.compositeVariations}
                onChange={(compositeVariations) => s.setBase({ compositeVariations })}
                min={1}
                max={4}
                suffix="attempts"
              />
            </Field>
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
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                    Composite
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-ink-soft">
                    {ready ? "Card onto the blank surface, perspective-matched." : "Select a base and artwork."}
                  </p>
                </div>
                <div className="flex gap-2">
                  {s.busy && (
                    <Button variant="danger" onClick={s.cancelAll}>
                      Stop
                    </Button>
                  )}
                  <Button size="lg" onClick={s.generateComposites} loading={s.busy} disabled={!ready}>
                    {s.busy ? "Placing…" : "Place the card"}
                  </Button>
                </div>
              </div>

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
            assets={composites}
            kind="composite"
            selectedId={s.compositeId}
            onSelect={(id) => s.setCompositeId(s.compositeId === id ? null : id)}
            emptyEmoji="🪄"
            emptyText="Composites land here — the card sitting naturally inside the scene."
            cols="sm:grid-cols-3"
          />

          {composites.length > 0 && (
            <div className="flex justify-end">
              <Button
                size="lg"
                onClick={() => s.setStep(4)}
                disabled={!s.compositeId}
                title={s.compositeId ? undefined : "Select a composite first"}
              >
                Make it move
                <span aria-hidden>→</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Operator({ symbol }: { symbol: string }) {
  return (
    <div className="hidden items-center justify-center sm:flex">
      <span className="grid h-8 w-8 place-items-center rounded-full border border-hairline bg-white text-sm font-extrabold text-ink-faint">
        {symbol}
      </span>
    </div>
  );
}

function SlotCard({
  title,
  empty,
  asset,
  onClear,
}: {
  title: string;
  empty: string;
  asset?: { url: string; label: string; kind: string };
  onClear: () => void;
}) {
  return (
    <div
      className={cx(
        "relative flex items-center gap-3 rounded-2xl border p-3 transition-all duration-300",
        asset ? "border-stamp-300 bg-white" : "border-dashed border-hairline bg-canvas-2/50",
      )}
    >
      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-canvas-2">
        {asset ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={asset.url} alt={asset.label} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-ink-faint">?</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-ink-faint">{title}</p>
        <p className="truncate text-sm font-semibold text-ink">{asset ? asset.label : empty}</p>
      </div>
      {asset && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${title}`}
          className="focus-stamp shrink-0 rounded-full p-1.5 text-ink-faint transition-colors hover:bg-canvas-2 hover:text-stamp-600"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function EmptyHint({
  emoji,
  text,
  action,
}: {
  emoji: string;
  text: string;
  action: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-hairline bg-canvas-2/50 px-6 py-10 text-center">
      <span className="animate-float text-2xl">{emoji}</span>
      <p className="text-sm text-ink-faint">{text}</p>
      <Button variant="outline" size="sm" onClick={action.onClick}>
        {action.label}
      </Button>
    </div>
  );
}
