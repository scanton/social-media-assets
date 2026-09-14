"use client";

import { useState } from "react";
import { toPromptDialect } from "@/lib/prompt-dialect";
import { uploadToFal } from "@/lib/client-api";
import { useProvider } from "@/lib/use-provider";
import type { Asset } from "@/lib/studio-types";
import {
  buildInsideMessagePrompt,
  HANDWRITING_STYLES,
  INK_COLOURS,
  MESSAGE_PLACEMENTS,
} from "@/lib/options";
import { useStudio, uid, type InsideMessageSpec } from "./studio-store";
import { AssetTile, PendingTile } from "./AssetTile";
import { Uploader } from "./Uploader";
import { Button, Field, Select, cx, useToast } from "./ui";
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
  const toast = useToast();
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
  // An uploaded signature counts on its own — a card carrying nothing but
  // somebody's real signature is a perfectly good card.
  const hasContent = Boolean(
    spec.message.trim() || spec.signature.trim() || s.assets.some((a) => a.id === s.signatureId),
  );

  const samples = s.assets.filter((a) => a.kind === "handwriting");
  const sample = samples.find((a) => a.id === s.handwritingId);
  const signatures = s.assets.filter((a) => a.kind === "signature");
  const signature = signatures.find((a) => a.id === s.signatureId);

  /*
   * One uploader, two meanings. The kind decides everything downstream — a
   * "handwriting" asset is imitated and a "signature" asset is copied — so the
   * only thing that differs here is which slot it lands in.
   */
  const uploadReference = (kind: "handwriting" | "signature") =>
    async (file: File, onProgress: (pct: number) => void) => {
      if (!s.keyConnected) {
        s.openKeyDialog();
        return;
      }
      try {
        const url = await uploadToFal(file, onProgress);
        const asset: Asset = {
          id: uid(),
          kind,
          url,
          contentType: file.type,
          label: file.name.replace(/\.\w+$/, ""),
          tags: [kind === "signature" ? "signature" : "handwriting sample"],
          createdAt: Date.now(),
        };
        s.addAssets([asset]);
        if (kind === "signature") {
          s.setSignatureId(asset.id);
          toast("Signature added — it will be reproduced on the card.", "success");
        } else {
          s.setHandwritingId(asset.id);
          toast("Sample added — the message will be written in that hand.", "success");
        }
      } catch (err) {
        toast((err as Error).message, "error");
      }
    };

  const live = s.jobs.filter(
    (j) => j.kind === "card-art" && j.state !== "done" && j.state !== "cancelled",
  );

  const prompt = buildInsideMessagePrompt({
    ...spec,
    hasSpread: Boolean(spread),
    hasHandSample: Boolean(sample),
    hasSignatureSample: Boolean(signature),
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
          {sample && (
            <>
              {" "}
              It will be written in{" "}
              <span className="font-semibold text-ink">your own hand</span>, copied from{" "}
              <span className="font-semibold text-ink">{sample.label}</span>.
            </>
          )}
          {signature && (
            <>
              {" "}
              It will be signed with{" "}
              <span className="font-semibold text-ink">your own signature</span>, reproduced from{" "}
              <span className="font-semibold text-ink">{signature.label}</span>.
            </>
          )}
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

            <Field
              label="Signature"
              help="hand.signature"
              hint={
                signature
                  ? "Not in use — your uploaded signature is being reproduced instead."
                  : undefined
              }
              badge={signature ? <span className="sticker">Overridden</span> : undefined}
            >
              <input
                value={spec.signature}
                onChange={(e) => patch({ signature: e.target.value })}
                placeholder="Love, Sarah"
                className={input}
              />
            </Field>

            <Field
              label="Your own signature"
              help="hand.signatureSample"
              hint="Optional. Reproduced as-is, not imitated."
            >
              <div className="space-y-2.5">
                <Uploader
                  emoji="🖋️"
                  accept="image/png,image/jpeg,image/webp"
                  title={signature ? "Swap the signature" : "Drop or browse a signature"}
                  subtitle="Your signature on plain paper, square-on. It is redrawn in ink on the card — the paper and pen of the photo are discarded."
                  onFile={uploadReference("signature")}
                />
                {signatures.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5">
                    {signatures.map((a) => (
                      <AssetTile
                        key={a.id}
                        asset={a}
                        selectable
                        selected={s.signatureId === a.id}
                        onSelect={() => s.setSignatureId(s.signatureId === a.id ? null : a.id)}
                        onRemove={() => s.removeAsset(a.id)}
                      />
                    ))}
                  </div>
                )}
                {signatures.length > 0 && !signature && (
                  <p className="rounded-2xl bg-canvas-2 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
                    <span className="font-bold text-ink">None selected.</span> The card is signed
                    with whatever is typed above. Tick one to use your real signature instead.
                  </p>
                )}
              </div>
            </Field>
          </div>

          <div className="space-y-4">
            {/*
              * Left interactive rather than disabled while a sample is in use.
              * A greyed-out control that still takes keyboard focus is worse
              * than a live one labelled honestly, and the preset is what comes
              * back the moment the sample is deselected.
              */}
            <Field
              label="Handwriting"
              help="hand.style"
              hint={
                sample
                  ? "Not in use — your uploaded sample is being copied instead."
                  : "Grouped by how the hand reads."
              }
              badge={sample ? <span className="sticker">Overridden</span> : undefined}
            >
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

            <Field
              label="Your own handwriting"
              help="hand.sample"
              hint="Optional. A photo of your writing, copied as a style."
            >
              <div className="space-y-2.5">
                <Uploader
                  emoji="✍️"
                  accept="image/png,image/jpeg,image/webp"
                  title={sample ? "Swap the sample" : "Drop or browse a handwriting sample"}
                  subtitle="A few lines on plain paper, square-on and in focus. What it says is never copied — only the shape of the writing."
                  onFile={uploadReference("handwriting")}
                />
                {samples.length > 0 && (
                  <div className="grid grid-cols-3 gap-2.5">
                    {samples.map((a) => (
                      <AssetTile
                        key={a.id}
                        asset={a}
                        selectable
                        selected={s.handwritingId === a.id}
                        onSelect={() =>
                          s.setHandwritingId(s.handwritingId === a.id ? null : a.id)
                        }
                        onRemove={() => s.removeAsset(a.id)}
                      />
                    ))}
                  </div>
                )}
                {samples.length > 0 && !sample && (
                  <p className="rounded-2xl bg-canvas-2 px-3.5 py-2.5 text-xs leading-relaxed text-ink-soft">
                    <span className="font-bold text-ink">None selected.</span> The message is
                    written in the preset hand above. Tick a sample to use your own instead.
                  </p>
                )}
              </div>
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

            {/* Follows the same rule as the job: any reference at all needs the
                image-to-image model, and a sample is a reference. */}
            <ModelPicker slot={spread || sample || signature ? "compositeImage" : "baseImage"} />
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
            title={hasContent ? undefined : "Write a message or signature first, or upload one"}
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
