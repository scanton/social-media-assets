"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { awaitJob, submitJob, uploadToFal } from "@/lib/client-api";
import { useProvider } from "@/lib/use-provider";
import { PROVIDERS, PROVIDER_IDS } from "@/lib/providers";
import { HINT_GROUPS, compilePrompt, DEFAULT_NEGATIVE } from "@/lib/freeform";
import { addAssetsToRoll, removeAssetFromRoll, usePersisted } from "@/lib/persisted-store";
import type { CatalogModel, InputSchema } from "@/lib/model-catalog";
import type { Asset } from "@/lib/studio-types";
import { Field, Select, cx } from "../ui";
import { Uploader } from "../Uploader";
import { HelpTip } from "../HelpTip";
import { AssetTile, PendingTile } from "../AssetTile";
import { SchemaFields } from "./SchemaFields";

/**
 * The open bench.
 *
 * The two card pipelines write your prompt for you and the model is a detail.
 * Here the prompt is yours and the model is the point, so the page is arranged
 * the other way round: pick the thing, say what you want, and everything else
 * is optional help that stays out of the way.
 *
 * The controls are drawn from whatever model is selected rather than from a
 * fixed list, which is the only honest way to cover a catalogue this varied.
 */

const CATEGORIES = [
  {
    id: "text-to-image",
    label: "Image from a prompt",
    video: false,
    // fal returns its catalogue newest-first, which lands a landing on
    // whatever shipped this week — sometimes a novelty like a try-on model.
    // A generalist opens better, and it's only the starting point.
    prefer: "openai/gpt-image-2",
    /*
     * The same intent on Replicate, written out rather than derived. Neither
     * provider's ids are a transform of the other's — `bytedance/seedance-2.5`
     * is one model on Replicate and four endpoints on fal — so a rule that
     * tried to convert between them would be wrong more often than right.
     * A preference that does not exist is simply not honoured; the list still
     * opens on something.
     */
    preferReplicate: "openai/gpt-image-2",
  },
  {
    id: "image-to-image", label: "Image from an image", video: false,
    prefer: "fal-ai/nano-banana-2/edit", preferReplicate: "google/nano-banana-pro",
  },
  {
    id: "text-to-video", label: "Video from a prompt", video: true,
    prefer: "bytedance/seedance-2.5/text-to-video", preferReplicate: "bytedance/seedance-2.5",
  },
  {
    id: "image-to-video", label: "Video from an image", video: true,
    prefer: "bytedance/seedance-2.5/image-to-video", preferReplicate: "bytedance/seedance-2.5",
  },
] as const;

/**
 * Settings we open a model on, where its own default is not what we want.
 *
 * Only the fields named here are overridden; everything else still comes from
 * the model's published schema, and anything touched afterwards is the
 * person's. Kept as a table rather than special-cased in the seeding loop so
 * that "which models do we disagree with, and about what" is one thing to read.
 */
const HOUSE_DEFAULTS: Record<string, Record<string, unknown>> = {
  // The schema opens on `high`. Medium is the better default here: the
  // difference is hard to see at social sizes and easy to see on the bill,
  // and the control is right there for the render that earns it.
  "openai/gpt-image-2": { quality: "medium" },
};

type CategoryId = (typeof CATEGORIES)[number]["id"];

interface Result {
  url: string;
  kind: "image" | "video";
  contentType?: string;
}

/** Finds the media in whatever shape a model returns. */
function readResult(data: unknown): Result[] {
  const out: Result[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const o = node as Record<string, unknown>;
    if (typeof o.url === "string") {
      const t = typeof o.content_type === "string" ? o.content_type : "";
      const isVideo = t.startsWith("video/") || /\.(mp4|webm|mov)(\?|$)/i.test(o.url);
      out.push({ url: o.url, kind: isVideo ? "video" : "image", contentType: t || undefined });
      return;
    }
    Object.values(o).forEach(walk);
  };
  walk(data);
  return out;
}

export function Freeform() {
  const { provider, setProvider } = useProvider();
  const [category, setCategory] = useState<CategoryId>("text-to-image");

  /*
   * Everything fetched is keyed by what it was fetched for, rather than reset
   * when the selection changes.
   *
   * Two reasons. Clearing state at the top of an effect is a synchronous
   * setState inside a render pass, which cascades; and coming back to a
   * category you were just in should find your model still chosen rather than
   * snapped back to the first in the list.
   */
  /*
   * Keyed by `provider:category`, not category.
   *
   * The two catalogues share no model ids, so a list fetched for fal is not a
   * stale answer for Replicate — it is a wrong one, and every entry in it would
   * fail at submit. Widening the key keeps the "come back and find your choice"
   * behaviour within each provider and keeps them from bleeding into each other.
   */
  const [modelsBy, setModelsBy] = useState<Record<string, CatalogModel[]>>({});
  const [chosenBy, setChosenBy] = useState<Record<string, string>>({});
  const [schemaBy, setSchemaBy] = useState<Record<string, InputSchema>>({});
  const [valuesBy, setValuesBy] = useState<Record<string, Record<string, unknown>>>({});

  const [prompt, setPrompt] = useState("");
  const [negative, setNegative] = useState("");
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [refUrl, setRefUrl] = useState("");

  /*
   * Structured rather than a formatted string: the pending tile wants the
   * queue position as a number, and the render button wants a sentence.
   */
  const [busy, setBusy] = useState<{ state: string; queuePosition?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  /*
   * Results come from the roll, not from this page's own memory.
   *
   * They used to live in local state, so leaving the page threw away every
   * render that had not been downloaded — while the card pipelines kept theirs
   * and showed them again on return. The roll already persists, already knows
   * when fal has dropped something, and is already where these were being
   * written; reading them back from it is what makes them outlast the visit.
   */
  const roll = usePersisted().assets;
  const results = useMemo(() => roll.filter((a) => a.kind === "freeform"), [roll]);

  /*
   * fal returns its catalogue newest-first, which is the right order for a
   * "what's new" page and the wrong one for finding a model you already have
   * in mind among four hundred. Sorted here rather than in the API route: the
   * card pages' own picker reads the same endpoint and its slot ordering is
   * deliberate. `localeCompare` with numeric collation so Seedance 2.5 sorts
   * after Seedance 2.0 rather than between 2.0 and 2.1.
   */
  /** Everything below is scoped to one provider's catalogue. */
  const catKey = `${provider}:${category}`;

  const models = useMemo(
    () =>
      [...(modelsBy[catKey] ?? [])].sort((a, b) =>
        a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" }),
      ),
    [modelsBy, catKey],
  );
  const spec = CATEGORIES.find((c) => c.id === category);
  const preferred = provider === "replicate" ? spec?.preferReplicate : spec?.prefer;
  const model =
    chosenBy[catKey] ??
    (models.some((m) => m.id === preferred) ? preferred : models[0]?.id) ??
    "";
  const schema = schemaBy[model] ?? null;
  const current = models.find((m) => m.id === model);
  // Memoised because it feeds a useCallback: a fresh {} each render would make
  // that callback new each render too.
  const values = useMemo(() => valuesBy[model] ?? {}, [valuesBy, model]);
  // Derived rather than a flag: "not fetched yet" is exactly "not in the map".
  const loadingModels = modelsBy[catKey] === undefined;

  const isVideo = spec?.video ?? false;
  const needsImage = category === "image-to-image" || category === "image-to-video";

  const setModel = useCallback(
    (id: string) => setChosenBy((s) => ({ ...s, [catKey]: id })),
    [catKey],
  );

  /* ---- the catalogue, once per category ---- */
  useEffect(() => {
    if (modelsBy[catKey]) return;
    let cancelled = false;
    fetch(`/api/fal/models?category=${category}`)
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((body: { models?: CatalogModel[] }) => {
        if (!cancelled) setModelsBy((s) => ({ ...s, [catKey]: body.models ?? [] }));
      })
      .catch(() => {
        if (!cancelled) setModelsBy((s) => ({ ...s, [catKey]: [] }));
      });
    return () => {
      cancelled = true;
    };
  }, [category, catKey, modelsBy]);

  /* ---- the chosen model's own knobs, once per model ---- */
  useEffect(() => {
    if (!model || schemaBy[model]) return;
    let cancelled = false;
    fetch(`/api/fal/schema?model=${encodeURIComponent(model)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { schema?: InputSchema } | null) => {
        if (cancelled || !body?.schema) return;
        setSchemaBy((s) => ({ ...s, [model]: body.schema as InputSchema }));
        // Start from the model's own defaults rather than blank, so a render
        // works before anything has been touched — then apply ours over the
        // top for the few fields we disagree with. See HOUSE_DEFAULTS.
        const next: Record<string, unknown> = {};
        for (const [k, p] of Object.entries(body.schema.properties)) {
          if (p.default !== undefined) next[k] = p.default;
        }
        for (const [k, v] of Object.entries(HOUSE_DEFAULTS[model] ?? {})) {
          if (k in body.schema.properties) next[k] = v;
        }
        setValuesBy((s) => (s[model] ? s : { ...s, [model]: next }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [model, schemaBy]);

  const finalPrompt = useMemo(
    () => compilePrompt(prompt, picks, isVideo),
    [prompt, picks, isVideo],
  );

  const groups = useMemo(
    () => HINT_GROUPS.filter((g) => g.media === "both" || isVideo),
    [isVideo],
  );

  const run = useCallback(async () => {
    if (!model || !finalPrompt.trim()) return;
    setError(null);
    setBusy({ state: "queued" });
    try {
      const input: Record<string, unknown> = { ...values, prompt: finalPrompt };
      if (negative.trim() && schema?.properties.negative_prompt) input.negative_prompt = negative.trim();
      if (needsImage && refUrl.trim()) {
        // Whichever name this model uses; the adapter renames the rest away.
        input.image_url = refUrl.trim();
        input.image_urls = [refUrl.trim()];
      }

      const requestId = await submitJob(model, "freeform", input);
      const data = await awaitJob<unknown>(model, requestId, {
        onUpdate: (u) => setBusy({ state: u.status, queuePosition: u.queuePosition }),
      });
      const found = readResult(data);
      if (!found.length) throw new Error("That model returned nothing this page knows how to show.");
      const made: Asset[] = found.map((r, i) => ({
        id: `ff-${requestId}-${i}`,
        kind: "freeform",
        url: r.url,
        contentType: r.contentType,
        label: prompt.trim().slice(0, 60) || current?.title || "Untitled",
        tags: [current?.title ?? model, r.kind === "video" ? "video" : "image"],
        createdAt: Date.now(),
        prompt: finalPrompt,
      }));
      /*
       * Into the shared roll, not just this page's own list.
       *
       * fal drops media after a while and this page had no other memory, so a
       * render that only ever existed in local state was gone on reload. The
       * roll is where the rest of the app already keeps its output, and it is
       * reachable from every page.
       */
      addAssetsToRoll(made);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [model, finalPrompt, values, negative, schema, needsImage, refUrl, prompt, current]);


  return (
    <div className="mx-auto max-w-[110rem] px-4 py-6 sm:px-6">
      <header className="mb-6">
        <Link href="/" className="focus-stamp text-xs font-bold text-ink-faint hover:text-ink">
          ← Asset Studio
        </Link>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-stamp-600">Open bench</p>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          Make anything
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Any image or video model on {PROVIDERS[provider].label}, your own prompt. The controls
          come from whichever model you pick, so they change when it does. Everything under the
          prompt is optional.
        </p>

        {/*
          * The same switch as the studio header. The bench is where a provider
          * change is most visible — the whole catalogue below is theirs — so it
          * belongs on the page rather than only on the page you came from.
          */}
        <div
          role="group"
          aria-label="Generation provider"
          className="mt-4 flex w-fit items-center rounded-full border border-hairline bg-canvas-2/60 p-0.5"
        >
          {PROVIDER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => void setProvider(id)}
              aria-pressed={provider === id}
              className={cx(
                "focus-stamp rounded-full px-3 py-1.5 text-[11px] font-bold transition-all",
                provider === id ? "bg-white text-ink shadow-sm" : "text-ink-faint hover:text-ink",
              )}
            >
              {PROVIDERS[id].label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ------------------------------ the ask ------------------------------ */}
        <div className="space-y-5">
          <div className="card-surface space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What are you making" help="bench.category">
                <Select
                  value={category}
                  onChange={(v) => setCategory(v as CategoryId)}
                  options={CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
                />
              </Field>
              <Field
                label="Model"
                help="bench.model"
                hint={loadingModels ? "Loading the catalogue…" : `${models.length} available`}
              >
                <Select
                  value={model}
                  onChange={setModel}
                  // The endpoint under each title: several models share a
                  // family name ("Seedream", "Nano Banana") and the id is the
                  // only thing that says which one this row actually is.
                  options={models.map((m) => ({ id: m.id, label: m.title, hint: m.id }))}
                  placeholder={loadingModels ? "Loading…" : "No models"}
                  searchable
                  searchPlaceholder="Search by name or endpoint…"
                />
              </Field>
            </div>

            {current?.description && (
              <p className="text-xs leading-relaxed text-ink-soft">{current.description}</p>
            )}

            <Field label="Prompt" help="bench.prompt" hint="Your words. The choices below are added after them, never woven in.">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="A hand setting a letterpressed card on a sunlit kitchen table…"
                className="focus-stamp w-full resize-none rounded-2xl border border-hairline bg-white px-4 py-3 text-sm leading-relaxed transition-colors focus:border-stamp-600"
              />
            </Field>

            {needsImage && (
              <Field
                label="Starting image"
                help="bench.startImage"
                hint="This kind of model starts from a picture. Drop one in, or paste a link."
              >
                <div className="space-y-2">
                  {refUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={refUrl}
                      alt=""
                      className="max-h-40 w-full rounded-2xl border border-hairline object-contain"
                    />
                  ) : (
                    <Uploader
                      accept="image/*"
                      emoji="🖼️"
                      title="Drop an image"
                      subtitle="PNG, JPG or WebP"
                      onFile={async (file, onProgress) => {
                        try {
                          setError(null);
                          setRefUrl(await uploadToFal(file, onProgress));
                        } catch (e) {
                          setError(e instanceof Error ? e.message : String(e));
                        }
                      }}
                    />
                  )}
                  <input
                    value={refUrl}
                    onChange={(e) => setRefUrl(e.target.value)}
                    placeholder="…or paste an image URL"
                    className="focus-stamp w-full rounded-xl border border-hairline bg-white px-3 py-2 text-sm"
                  />
                </div>
              </Field>
            )}

            {schema?.properties.negative_prompt && (
              <Field label="Negative prompt" help="bench.negative" hint="What to keep out. Optional.">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={negative}
                    onChange={(e) => setNegative(e.target.value)}
                    placeholder="Leave empty for none"
                    className="focus-stamp min-w-0 flex-1 rounded-xl border border-hairline bg-white px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setNegative(DEFAULT_NEGATIVE)}
                    className="focus-stamp shrink-0 rounded-xl border border-hairline bg-white px-3 py-2 text-xs font-bold text-ink hover:border-stamp-300"
                  >
                    Use the usual
                  </button>
                </div>
              </Field>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!model || !finalPrompt.trim() || !!busy}
                onClick={run}
                className="focus-stamp rounded-full bg-stamp-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-ink/20 disabled:hover:translate-y-0"
              >
                {busy
                  ? busy.queuePosition != null
                    ? `#${busy.queuePosition} in queue…`
                    : `${busy.state === "queued" ? "Submitting" : "Rendering"}…`
                  : "Render"}
              </button>
              {finalPrompt.trim() !== prompt.trim() && (
                <span className="text-xs text-ink-faint">
                  {finalPrompt.length - prompt.length} characters of help appended
                </span>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                {error}
              </p>
            )}
          </div>

          {/* the compiled prompt, always visible */}
          {finalPrompt.trim() && (
            <div className="card-surface p-5">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                What gets sent
                <HelpTip id="bench.compiled" />
              </p>
              <p className="whitespace-pre-wrap rounded-xl border border-hairline bg-paper px-3 py-2.5 font-mono text-xs leading-relaxed text-ink">
                {finalPrompt}
              </p>
            </div>
          )}

          {/* results */}
          {/*
            * The same tiles the card pipelines use, so a bench render gets the
            * same download, the same zoom preview and the same "fal dropped
            * this" check for free — and looks like the rest of the app rather
            * than like a second, worse gallery.
            */}
          {(busy || results.length > 0) && (
            <div className="card-surface space-y-3 p-5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">Results</p>
                <p className="text-[11px] text-ink-faint">
                  Kept in the roll until fal drops them
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {busy && (
                  <PendingTile
                    label={prompt.trim().slice(0, 40) || current?.title || "Rendering"}
                    state={busy.state}
                    queuePosition={busy.queuePosition}
                  />
                )}
                {results.map((a) => (
                  <AssetTile key={a.id} asset={a} onRemove={() => removeAssetFromRoll(a.id)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* --------------------- the model, then the help --------------------- */}
        <div className="space-y-5">
          {/*
           * Settings first. These are the model's real controls — size, quality,
           * how many — and burying them under nine optional prompt taxonomies
           * read as though the taxonomies were the point. The helpers are the
           * garnish; this is the machine.
           */}
          <div className="card-surface space-y-4 p-5">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                {current?.title ?? "Model"} settings
                <HelpTip id="bench.settings" />
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                Read from this model. Pick another and these change with it.
              </p>
            </div>
            <SchemaFields
              schema={schema}
              values={values}
              onChange={(k, v) => setValuesBy((s) => ({ ...s, [model]: { ...(s[model] ?? {}), [k]: v } }))}
            />
          </div>

          <div className="card-surface space-y-5 p-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">A hand with the prompt</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">
                Optional, and all off by default. Each one adds a clause after your words.
              </p>
            </div>

            {groups.map((g) => (
              <div key={g.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-ink-faint">
                    {g.label}
                    <HelpTip id={`bench.hint.${g.id}`} />
                  </span>
                  {picks[g.id] && (
                    <button
                      type="button"
                      onClick={() => setPicks((p) => ({ ...p, [g.id]: "" }))}
                      className="focus-stamp text-[10px] font-bold text-ink-faint hover:text-ink"
                    >
                      clear
                    </button>
                  )}
                </div>
                <p className="mb-2 text-xs text-ink-faint">{g.blurb}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.options.map((o) => {
                    const on = picks[g.id] === o.id;
                    return (
                      <button
                        key={o.id}
                        type="button"
                        title={o.hint ? `${o.prompt}\n\n${o.hint}` : o.prompt}
                        onClick={() => setPicks((p) => ({ ...p, [g.id]: on ? "" : o.id }))}
                        className={cx(
                          "focus-stamp rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-all",
                          on
                            ? "border-stamp-600 bg-stamp-100 text-ink"
                            : "border-hairline bg-white text-ink/70 hover:border-stamp-300",
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
