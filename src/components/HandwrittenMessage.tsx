"use client";

import { useState } from "react";
import { toPromptDialect } from "@/lib/prompt-dialect";
import { useProvider } from "@/lib/use-provider";
import {
  buildInsideMessagePrompt,
  HANDWRITING_STYLES,
  INK_COLOURS,
  MESSAGE_PLACEMENTS,
} from "@/lib/options";
import { useStudio, type InsideMessageSpec } from "./studio-store";
import { AssetTile, PendingTile } from "./AssetTile";
import { Button, Field, Select, cx } from "./ui";
import { ModelPicker } from "./ModelPicker";
import { Panel } from "./steps/shared";

/**
 * Writes a personal message and signature inside the card.
 *
 * A render step of its own, deliberately. The video model is good at opening a
 * card and bad at inventing lettering while it does — so the message is put on
 * the paper here, and by the time the clip is made the spread already carries
 * it and the model is only asked to reproduce what it can see.
 *
 * The result is an ordinary inside-spread asset, so step 3's opening motions
 * pick it up with no further wiring.
 */
export function HandwrittenMessage() {
  const s = useStudio();
  const { provider } = useProvider();
  const [showPrompt, setShowPrompt] = useState(false);

  const [spec, setSpec] = useState<InsideMessageSpec>({
    message: "",
    signature: "",
    styleId: "neat",
    inkId: "blue",
    placementId: "lower-right",
    notes: "",
  });
  const patch = (next: Partial<InsideMessageSpec>) => setSpec((p) => ({ ...p, ...next }));

  const spread = s.assets.find((a) => a.id === s.cardInsideId && a.kind === "card-art");
  const written = s.assets.filter((a) => a.kind === "card-art" && a.tags.includes("handwritten"));
  const hasContent = Boolean(spec.message.trim() || spec.signature.trim());

  const live = s.jobs.filter(
    (j) => j.kind === "card-art" && j.state !== "done" && j.state !== "cancelled",
  );

  const prompt = buildInsideMessagePrompt({
    ...spec,
    hasSpread: Boolean(spread),
    cardSizeId: s.base.cardSizeId,
    extraNotes: spec.notes,
  });

  const input =
    "focus-stamp w-full rounded-2xl border border-hairline bg-white px-4 py-3 text-sm transition-colors focus:border-stamp-600";

  return (
    <Panel title="Handwritten message" help="hand.panel" aside={<span className="sticker">Optional</span>}>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-ink-faint">
          {spread ? (
            <>
              Writes your message onto <span className="font-semibold text-ink">{spread.label}</span>{" "}
              in the empty space, leaving everything already printed on it untouched.
            </>
          ) : (
            <>
              No inside spread selected, so a blank open card is generated and written on. Upload a
              spread above to have the message written onto your own artwork instead.
            </>
          )}{" "}
          The finished spread becomes your inside panel, so step 3 reveals it as the card opens —
          the video model never has to letter anything itself.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label="Message" help="hand.message">
              <textarea
                value={spec.message}
                onChange={(e) => patch({ message: e.target.value })}
                rows={6}
                placeholder={"Dear Mom,\n\nHope your day is every bit as wonderful as you are. Can't wait to see you next month!"}
                className={cx(input, "resize-none leading-relaxed")}
              />
            </Field>

            <Field label="Signature" help="hand.signature">
              <input
                value={spec.signature}
                onChange={(e) => patch({ signature: e.target.value })}
                placeholder="Love, Sarah"
                className={input}
              />
            </Field>
          </div>

          <div className="space-y-4">
            <Field label="Handwriting" help="hand.style" hint="Grouped by how the hand reads.">
              <Select
                value={spec.styleId}
                onChange={(styleId) => patch({ styleId })}
                options={HANDWRITING_STYLES.map((h) => ({
                  id: h.id,
                  label: h.label,
                  emoji: h.emoji,
                  hint: `${h.gender === "any" ? "Any" : h.gender === "feminine" ? "Feminine" : "Masculine"} · ${h.hint ?? ""}`.trim(),
                }))}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Pen" help="hand.ink">
                <Select
                  value={spec.inkId}
                  onChange={(inkId) => patch({ inkId })}
                  options={INK_COLOURS.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji }))}
                />
              </Field>
              <Field label="Written" help="hand.placement">
                <Select
                  value={spec.placementId}
                  onChange={(placementId) => patch({ placementId })}
                  options={MESSAGE_PLACEMENTS.map((m) => ({
                    id: m.id,
                    label: m.label,
                    emoji: m.emoji,
                    hint: m.hint,
                  }))}
                />
              </Field>
            </div>

            <Field label="Extra direction" help="scene.extra" hint="Optional. Anything else about the writing.">
              <textarea
                value={spec.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                rows={2}
                placeholder="e.g. a small heart doodle under the signature"
                className={cx(input, "resize-none leading-relaxed")}
              />
            </Field>

            <ModelPicker slot={spread ? "compositeImage" : "baseImage"} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowPrompt((v) => !v)}
            className="focus-stamp text-xs font-bold text-stamp-600 underline decoration-stamp-200 underline-offset-2 hover:decoration-stamp-600"
          >
            {showPrompt ? "Hide" : "Show"} the compiled prompt
          </button>
          <Button
            onClick={() => s.generateInsideMessage(spec)}
            loading={s.busy}
            disabled={!hasContent}
            title={hasContent ? undefined : "Write a message or signature first"}
          >
            {s.busy ? "Writing…" : "Write the message"}
          </Button>
        </div>

        {showPrompt && (
          <p className="max-h-52 animate-rise overflow-y-auto rounded-2xl bg-canvas-2 p-3.5 font-mono text-[11px] leading-relaxed text-ink-soft">
            {toPromptDialect(prompt, provider)}
          </p>
        )}

        {(written.length > 0 || live.length > 0) && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
              Written spreads — pick the one to use
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              {written.map((a) => (
                <AssetTile
                  key={a.id}
                  asset={a}
                  selectable
                  selected={s.cardInsideId === a.id}
                  onSelect={() => s.setCardInsideId(s.cardInsideId === a.id ? null : a.id)}
                  onRemove={() => s.removeAsset(a.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
