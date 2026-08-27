"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  buildAnimatePrompt,
  buildCardOpenPrompt,
  buildOneShotPrompt,
  buildScenePrompt,
  buildInsideMessagePrompt,
  buildScreenReplacePrompt,
  byId,
  CARD_SIZES,
  DEVICES,
  imageSizeFor,
  MOTIONS,
  SCENES,
  type AspectId,
  type SurfaceKind,
} from "@/lib/options";
import { useModelChoices } from "@/lib/model-prefs";
import type { Asset } from "@/lib/studio-types";
import { useJobRunner, type JobSpec } from "@/lib/use-jobs";
import {
  addAssetsToRoll,
  firstUsableMotion,
  getPersisted,
  motionUsable,
  updatePersisted,
  usePersisted,
  type BaseConfig,
  type VideoConfig,
} from "@/lib/persisted-store";
import { composeScene } from "@/lib/compose";
import { stampVideoLogo } from "@/lib/video-logo";
import { useToast } from "./ui";

export type { BaseConfig, VideoConfig };

/** What the inside-message panel collects. See buildInsideMessagePrompt. */
export type InsideMessageSpec = {
  message: string;
  signature: string;
  styleId: string;
  inkId: string;
  placementId: string;
  notes: string;
};

/* ------------------------------- store ------------------------------ */

type FalImage = { url: string; content_type?: string; width?: number; height?: number };

type StudioValue = {
  step: number;
  setStep: (n: number) => void;
  surface: SurfaceKind;
  setSurface: (s: SurfaceKind) => void;

  assets: Asset[];
  addAssets: (a: Asset[]) => void;
  removeAsset: (id: string) => void;
  removeAssetsByUrl: (urls: string[]) => number;
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  clearAssets: () => void;

  base: BaseConfig;
  setBase: (patch: Partial<BaseConfig>) => void;
  video: VideoConfig;
  setVideo: (patch: Partial<VideoConfig>) => void;

  cardFrontId: string | null;
  setCardFrontId: (id: string | null) => void;
  cardInsideId: string | null;
  setCardInsideId: (id: string | null) => void;
  cardVideoId: string | null;
  setCardVideoId: (id: string | null) => void;
  backgroundId: string | null;
  setBackgroundId: (id: string | null) => void;
  baseId: string | null;
  setBaseId: (id: string | null) => void;

  jobs: ReturnType<typeof useJobRunner>["jobs"];
  busy: boolean;
  cancelAll: () => void;

  basePlanCount: number;
  generateScenes: () => void;
  generateInsideMessage: (spec: InsideMessageSpec) => void;
  generateVideo: () => void;
  generateOneShot: () => void;

  keyConnected: boolean;
  setKeyConnected: (v: boolean) => void;
  openKeyDialog: () => void;
  keyDialogOpen: boolean;
  setKeyDialogOpen: (v: boolean) => void;
  keyHint: string | null;
  setKeyHint: (h: string | null) => void;

  confettiKey: number;
};

const Ctx = createContext<StudioValue | null>(null);
export const useStudio = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudio must be used inside <StudioProvider>");
  return v;
};

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function StudioProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  // Which fal model each step runs on. Defaults until the user picks otherwise.
  const { modelFor } = useModelChoices();

  // assets / base / video / surface live in an external store so they survive a
  // reload without a hydration-mismatch dance. See lib/persisted-store.ts.
  const { assets, base, video, surface, cardFrontId, cardInsideId, cardVideoId, backgroundId, baseId } =
    usePersisted();

  const [step, setStepRaw] = useState(1);

  const setCardFrontId = useCallback(
    (cardFrontId: string | null) => updatePersisted({ cardFrontId }),
    [],
  );
  const setCardInsideId = useCallback(
    (cardInsideId: string | null) => updatePersisted({ cardInsideId }),
    [],
  );
  const setCardVideoId = useCallback(
    (cardVideoId: string | null) => updatePersisted({ cardVideoId }),
    [],
  );
  const setBackgroundId = useCallback(
    (backgroundId: string | null) => updatePersisted({ backgroundId }),
    [],
  );
  const setBaseId = useCallback((baseId: string | null) => updatePersisted({ baseId }), []);

  const [keyConnected, setKeyConnected] = useState(false);
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);

  /* ------------------------------ actions ----------------------------- */

  /** Each step is a full-page swap, so start it from the top. */
  const setStep = useCallback((n: number) => {
    setStepRaw(n);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Delegated so the open bench, which is outside this provider, adds to the
  // roll through the same function rather than a second copy of it.
  const addAssets = useCallback((next: Asset[]) => addAssetsToRoll(next), []);

  const removeAsset = useCallback((id: string) => {
    const current = getPersisted();
    const removed = current.assets.find((a) => a.id === id);
    const assets = current.assets.filter((a) => a.id !== id);

    // Screen-replace needs a clip; without one it would just fail at render time.
    const lostLastClip =
      removed?.kind === "card-video" && !assets.some((a) => a.kind === "card-video");
    // Likewise an opening motion with no inside spread left to reveal.
    const motionStranded = !motionUsable(current.video.motionId, assets, current.surface);

    // Fall back to the next asset of the same kind rather than clearing the
    // slot — an empty slot is how step 2 silently went back to blank screens.
    const nextOf = (kind: Asset["kind"]) =>
      assets.filter((a) => a.kind === kind).sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null;
    const nextPanel = (panel: "front" | "inside") =>
      assets
        .filter((a) => a.kind === "card-art" && a.panel === panel)
        .sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null;

    updatePersisted({
      assets,
      ...(current.cardFrontId === id ? { cardFrontId: nextPanel("front") } : {}),
      ...(current.cardInsideId === id ? { cardInsideId: nextPanel("inside") } : {}),
      ...(current.cardVideoId === id ? { cardVideoId: nextOf("card-video") } : {}),
      // No fallback here on purpose: a background locks every scene control, so
      // quietly swapping in a different one would relock the UI around a photo
      // the user never chose.
      ...(current.backgroundId === id ? { backgroundId: null } : {}),
      ...(current.baseId === id ? { baseId: nextOf("base") } : {}),
      ...(lostLastClip && current.video.engine === "screen-replace"
        ? { video: { ...current.video, engine: "animate" as const } }
        : {}),
      ...(motionStranded
        ? { video: { ...current.video, motionId: firstUsableMotion(assets, current.surface) } }
        : {}),
    });
  }, []);

  /**
   * Drops every asset pointing at a URL fal no longer has.
   *
   * Selections are repaired the same way a single removal does it, in one write
   * rather than N — clearing a slot that referenced an expired file is the part
   * that matters, since otherwise the next render fails on a 404 with an error
   * that says nothing about why.
   */
  const removeAssetsByUrl = useCallback((urls: string[]) => {
    if (!urls.length) return 0;
    const dead = new Set(urls);
    const current = getPersisted();
    const doomed = current.assets.filter((a) => dead.has(a.url));
    if (!doomed.length) return 0;

    const assets = current.assets.filter((a) => !dead.has(a.url));
    const gone = new Set(doomed.map((a) => a.id));

    const nextOf = (kind: Asset["kind"]) =>
      assets.filter((a) => a.kind === kind).sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null;
    const nextPanel = (panel: "front" | "inside") =>
      assets
        .filter((a) => a.kind === "card-art" && a.panel === panel)
        .sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null;
    const keep = <T extends string | null>(id: T, fallback: () => T) =>
      id && gone.has(id) ? fallback() : id;

    updatePersisted({
      assets,
      cardFrontId: keep(current.cardFrontId, () => nextPanel("front")),
      cardInsideId: keep(current.cardInsideId, () => nextPanel("inside")),
      cardVideoId: keep(current.cardVideoId, () => nextOf("card-video")),
      // A background locks the scene controls, so it is cleared rather than swapped.
      backgroundId: current.backgroundId && gone.has(current.backgroundId) ? null : current.backgroundId,
      baseId: keep(current.baseId, () => nextOf("base")),
      ...(motionUsable(current.video.motionId, assets, current.surface)
        ? {}
        : { video: { ...current.video, motionId: firstUsableMotion(assets, current.surface) } }),
    });
    return doomed.length;
  }, []);

  const updateAsset = useCallback((id: string, patch: Partial<Asset>) => {
    updatePersisted({
      assets: getPersisted().assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });
  }, []);

  const clearAssets = useCallback(() => {
    const current = getPersisted();
    updatePersisted({
      assets: [],
      video: { ...current.video, engine: "animate" },
      cardFrontId: null,
      cardInsideId: null,
      cardVideoId: null,
      backgroundId: null,
      baseId: null,
    });
  }, []);

  const setBase = useCallback(
    (patch: Partial<BaseConfig>) => updatePersisted({ base: { ...getPersisted().base, ...patch } }),
    [],
  );
  const setVideo = useCallback(
    (patch: Partial<VideoConfig>) => updatePersisted({ video: { ...getPersisted().video, ...patch } }),
    [],
  );

  /** Switching surface re-points the device and motion to ones that exist for it. */
  const setSurface = useCallback((next: SurfaceKind) => {
    const b = getPersisted().base;
    const v = getPersisted().video;

    const currentDevice = byId(DEVICES, b.deviceId);
    const nextBase =
      currentDevice?.surface === next
        ? b
        : (() => {
            const first = DEVICES.find((d) => d.surface === next);
            return first
              ? { ...b, deviceId: first.id, aspectIds: [(first.defaultAspect ?? "4:5") as AspectId] }
              : b;
          })();

    const motion = byId(MOTIONS, v.motionId);
    const nextVideo = !motion?.surface || motion.surface === next ? v : { ...v, motionId: "slow-push" };

    updatePersisted({ surface: next, base: nextBase, video: nextVideo });
  }, []);

  const runner = useJobRunner({
    onAssets: addAssets,
    onNeedKey: () => {
      setKeyDialogOpen(true);
      toast("Add your fal.ai key to run generations.", "error");
    },
    onBatchDone: ({ produced, failed, firstError }) => {
      if (produced > 0) {
        setConfettiKey((k) => k + 1);
        toast(`${produced} asset${produced === 1 ? "" : "s"} landed in your roll.`, "success");
      }
      if (failed > 0) {
        toast(
          `${failed} render${failed === 1 ? "" : "s"} failed${firstError ? ` — ${firstError}` : "."}`,
          "error",
        );
      }
    },
  });

  /* ------------------- step 2: the finished scene --------------------- */

  /*
   * A supplied location photograph already fixes where the camera is, so step 2
   * locks the angle chips and the batch collapses to one render per orientation
   * × variation rather than multiplying by angles that can't be honoured.
   */
  const backgroundAsset = assets.find((a) => a.id === backgroundId && a.kind === "background");
  // Both products can be composited into a supplied photograph now: printed
  // cards through the scene still, digital cards straight into the clip.
  const usingBackground = Boolean(backgroundAsset);
  const basePlanCount =
    (usingBackground ? 1 : base.angleIds.length) * base.aspectIds.length * base.variations;

  /**
   * One pass now does what used to take two. When card artwork is selected we
   * hand it to GPT-Image-2's edit endpoint as a reference and ask for the whole
   * lifestyle scene with the card already on the surface; with no artwork we
   * fall back to text-to-image and leave the surface blank.
   *
   * The HeartStamp emblem is then burned into the corner on a canvas — see
   * lib/watermark.ts for why that isn't left to the model.
   */
  const generateScenes = useCallback(() => {
    if (!keyConnected) {
      setKeyDialogOpen(true);
      return;
    }
    if (!base.aspectIds.length || (!usingBackground && !base.angleIds.length)) {
      toast(
        usingBackground
          ? "Pick at least one orientation."
          : "Pick at least one camera angle and one orientation.",
        "error",
      );
      return;
    }

    const cardAsset = assets.find((a) => a.id === cardFrontId && a.kind === "card-art");
    const hasCard = Boolean(cardAsset);

    /*
     * Screens get the artwork composited in the browser, so the model is asked
     * for a clean blank screen and nothing else. GPT-Image-2 re-typesets a
     * reference image and crops away its background, and an approximate first
     * frame is what makes Seedance stop believing the clip lives on the screen.
     *
     * Printed cards still go through the edit endpoint — paper curls and folds,
     * so a flat perspective warp isn't the right tool there.
     */
    const compositeHere = hasCard && surface === "screen";
    const modelPlacesCard = hasCard && surface === "print";

    /*
     * One list drives both the `image_urls` payload and the prompt's reference
     * key, so the model can never be told that image two is something other
     * than what image two actually is. GPT-Image-2's edit endpoint takes up to
     * 16, so there is headroom to add more (an inside spread, say) by pushing
     * another entry here — nothing else has to change.
     *
     * Either alone is valid: a background with no artwork still renders the
     * scene, just with a blank panel.
     */
    const references = [
      ...(modelPlacesCard ? [{ url: cardAsset!.url, label: "the card artwork" }] : []),
      ...(usingBackground ? [{ url: backgroundAsset!.url, label: "the location photograph" }] : []),
    ];
    const useEdit = references.length > 0;

    const scene = byId(SCENES, base.sceneId);
    const device = byId(DEVICES, base.deviceId);
    const shotLabel = usingBackground
      ? backgroundAsset!.label || "Background"
      : device?.label ?? "Scene";
    // Locked to one pass: the photograph is the angle.
    const angleIds = usingBackground ? [base.angleIds[0] ?? "pov"] : base.angleIds;
    const specs: JobSpec[] = [];

    for (const aspectId of base.aspectIds) {
      for (const angleId of angleIds) {
        for (let v = 1; v <= base.variations; v++) {
          const prompt = buildScenePrompt({
            surface,
            deviceId: base.deviceId,
            sceneId: base.sceneId,
            angleId,
            lightingId: base.lightingId,
            lookId: base.lookId,
            presenceId: base.presenceId,
            ethnicityId: base.ethnicityId,
            genderId: base.genderId,
            ageId: base.ageId,
            details: base.details,
            audienceId: base.audienceId,
            framingId: base.framingId,
            aspect: aspectId,
            hasCard: modelPlacesCard,
            hasBackground: usingBackground,
            cardSizeId: base.cardSizeId,
            references: references.map((r) => r.label),
            // GPT-Image-2 has no seed input, so variation comes from separate
            // calls plus a light nudge in the prompt.
            extraNotes: [
              base.notes,
              base.variations > 1
                ? `Variation ${v}: change the exact composition, props and micro-details while keeping every requirement above.`
                : "",
            ]
              .filter(Boolean)
              .join(" "),
          });

          const size = imageSizeFor(aspectId, base.imageResolution);

          specs.push({
            label: `${shotLabel} · ${aspectId} · v${v}`,
            kind: "base",
            slot: useEdit ? "compositeImage" : "baseImage",
            model: modelFor(useEdit ? "compositeImage" : "baseImage"),
            input: useEdit
              ? {
                  prompt,
                  image_urls: references.map((r) => r.url),
                  image_size: size,
                  quality: base.quality,
                  num_images: 1,
                  output_format: "png",
                }
              : {
                  prompt,
                  image_size: size,
                  quality: base.quality,
                  num_images: 1,
                  output_format: "png",
                },
            toAssets: async (data, jobId) => {
              const images = (data as { images?: FalImage[] }).images ?? [];
              return Promise.all(
                images.map(async (img, i) => {
                  const asset: Asset = {
                    id: `${jobId}-${i}`,
                    kind: "base" as const,
                    url: img.url,
                    contentType: img.content_type,
                    width: img.width,
                    height: img.height,
                    label: `${shotLabel} · v${v}`,
                    tags: [
                      aspectId,
                      usingBackground ? "your background" : angleId,
                      hasCard ? "card placed" : "blank surface",
                      usingBackground ? backgroundAsset!.label : scene?.label ?? "scene",
                    ],
                    createdAt: Date.now(),
                    prompt,
                    aspect: aspectId,
                    surface,
                  };

                  // The emblem is burned into the finished clip instead, so the
                  // still stays clean and there is one logo path, not two.
                  if (!compositeHere) return asset;

                  try {
                    const composed = await composeScene({
                      renderUrl: img.url,
                      cardUrl: cardAsset!.url,
                      withLogo: false,
                    });
                    return {
                      ...asset,
                      url: composed.url,
                      contentType: "image/png",
                      rawUrl: img.url,
                      cardUrl: compositeHere ? cardAsset!.url : undefined,
                      quad: composed.quad ?? undefined,
                      needsAlign: compositeHere && !composed.placed,
                      tags: compositeHere
                        ? [
                            aspectId,
                            angleId,
                            composed.placed ? "exact card" : "screen not found",
                            scene?.label ?? "scene",
                          ]
                        : asset.tags,
                    };
                  } catch (err) {
                    toast(
                      `Finishing pass failed, keeping the raw render. ${(err as Error).message}`,
                      "error",
                    );
                    return asset;
                  }
                }),
              );
            },
          });
        }
      }
    }

    void runner.run(specs);
  }, [assets, backgroundAsset, base, cardFrontId, keyConnected, modelFor, runner, surface, toast, usingBackground]);

  /* ------------------- writing inside the card ----------------------- */

  /**
   * Renders the message and signature onto the inside spread.
   *
   * A separate pass on purpose. Doing it here means the video model is handed a
   * spread that already carries the handwriting and is told only to reproduce
   * what it sees — rather than being asked to invent lettering while the card is
   * mid-open, which is the moment perspective and lighting are changing fastest.
   *
   * With a spread uploaded this edits it and everything already printed must
   * survive; without one the whole interior is generated blank and written on.
   */
  const generateInsideMessage = useCallback(
    (spec: InsideMessageSpec) => {
      if (!keyConnected) {
        setKeyDialogOpen(true);
        return;
      }
      if (!spec.message.trim() && !spec.signature.trim()) {
        toast("Write something first — a message or a signature.", "error");
        return;
      }

      const spread = assets.find((a) => a.id === cardInsideId && a.kind === "card-art");
      const hasSpread = Boolean(spread);

      const prompt = buildInsideMessagePrompt({
        ...spec,
        hasSpread,
        cardSizeId: base.cardSizeId,
        extraNotes: spec.notes,
      });

      // An open spread is landscape; match the card's real proportions so the
      // model isn't also deciding the shape of the paper.
      const card = CARD_SIZES.find((c) => c.id === base.cardSizeId) ?? CARD_SIZES[0];
      const [openW, openH] = card.open;
      const size = imageSizeFor(openW >= openH ? "16:9" : "4:5", base.imageResolution);

      void runner.run([
        {
          label: spec.signature.trim() ? `Inside · ${spec.signature.trim().slice(0, 20)}` : "Inside message",
          kind: "card-art",
          slot: hasSpread ? "compositeImage" : "baseImage",
          model: modelFor(hasSpread ? "compositeImage" : "baseImage"),
          input: {
            prompt,
            ...(hasSpread ? { image_urls: [spread!.url] } : {}),
            image_size: size,
            quality: base.quality,
            num_images: 1,
            output_format: "png",
          },
          toAssets: (data, jobId) => {
            const images = (data as { images?: FalImage[] }).images ?? [];
            return images.map((img, i) => ({
              id: `${jobId}-${i}`,
              kind: "card-art" as const,
              url: img.url,
              contentType: img.content_type,
              width: img.width,
              height: img.height,
              label: spec.signature.trim()
                ? `Signed · ${spec.signature.trim().slice(0, 20)}`
                : "Inside message",
              tags: ["inside spread", "handwritten", spec.styleId],
              createdAt: Date.now(),
              prompt,
              panel: "inside" as const,
            }));
          },
        },
      ]);
    },
    [assets, base.cardSizeId, base.imageResolution, base.quality, cardInsideId, keyConnected, modelFor, runner, toast],
  );

  /* -------------------------- step 3: video -------------------------- */

  /**
   * Turns a Seedance payload into a finished clip, burning the emblem in on the
   * way through.
   *
   * Every video path goes via here so there is exactly one logo mechanism. It
   * used to be stamped into the printed still and then held in place by prompt,
   * which asked the video model to preserve something exactly — the one thing
   * that has drifted every time it's been tried.
   */
  const finishVideo = useCallback(
    async (
      data: unknown,
      jobId: string,
      setStage: (stage: string | undefined) => void,
      meta: {
        label: string;
        tags: string[];
        parentId?: string;
        prompt: string;
        aspect?: Asset["aspect"];
      },
    ): Promise<Asset[]> => {
      const v = (data as { video?: { url: string; content_type?: string } }).video;
      if (!v) return [];

      const wantsLogo = getPersisted().base.logo;
      let url = v.url;
      let stamped = false;

      if (wantsLogo) {
        try {
          url = await stampVideoLogo(v.url, (p) =>
            setStage(p.pct != null ? `Logo ${p.pct}%` : p.stage),
          );
          stamped = true;
        } catch (err) {
          toast(`Logo stamp failed, keeping the un-stamped clip. ${(err as Error).message}`, "error");
        } finally {
          setStage(undefined);
        }
      }

      return [
        {
          id: `${jobId}-0`,
          kind: "video" as const,
          url,
          contentType: v.content_type ?? "video/mp4",
          label: meta.label,
          tags: [...meta.tags, wantsLogo ? (stamped ? "logo" : "no logo") : "no logo"],
          createdAt: Date.now(),
          parentId: meta.parentId,
          prompt: meta.prompt,
          aspect: meta.aspect,
          surface: getPersisted().surface,
          rawUrl: stamped ? v.url : undefined,
        },
      ];
    },
    [toast],
  );

  const generateVideo = useCallback(() => {
    if (!keyConnected) {
      setKeyDialogOpen(true);
      return;
    }

    const still = assets.find((a) => a.id === baseId);
    if (!still) {
      toast("Pick a still to animate first.", "error");
      return;
    }

    const cardClip = assets.find((a) => a.id === cardVideoId);
    const inside = assets.find((a) => a.id === cardInsideId && a.kind === "card-art");
    const motion = byId(MOTIONS, video.motionId);

    /*
     * A card that opens has to reveal the artwork the customer actually bought,
     * so the inside spread goes in as a second reference image. Without it the
     * model invents an inside, which is the one thing a greeting-card asset
     * can't get wrong.
     */
    if (surface === "print" && motion?.requiresInside) {
      if (!inside) {
        toast("That motion opens the card — add an inside spread in step 1 first.", "error");
        return;
      }
      const prompt = buildCardOpenPrompt({
        motionId: video.motionId,
        sceneId: base.sceneId,
        extraNotes: video.notes,
      });
      void runner.run([
        {
          label: `Opening · ${still.label}`,
          kind: "video",
          slot: "screenReplace",
          model: modelFor("screenReplace"),
          input: {
            prompt,
            image_urls: [still.url, inside.url],
            resolution: video.resolution,
            duration: video.duration,
            aspect_ratio: video.aspectRatio,
            generate_audio: video.generateAudio,
            bitrate_mode: "high",
          },
          toAssets: (data, jobId, setStage) =>
            finishVideo(data, jobId, setStage, {
              label: `Opening · ${still.label}`,
              tags: [video.resolution, "inside spread", motion.label],
              parentId: still.id,
              prompt,
              aspect: still.aspect,
            }),
        },
      ]);
      return;
    }

    if (video.engine === "screen-replace") {
      if (!cardClip) {
        toast("Screen-replace needs an uploaded card video from step 1.", "error");
        return;
      }
      const prompt = buildScreenReplacePrompt({
        surface,
        motionId: video.motionId,
        extraNotes: video.notes,
      });
      void runner.run([
        {
          label: `Screen replace · ${still.label}`,
          kind: "video",
          slot: "screenReplace",
          model: modelFor("screenReplace"),
          input: {
            prompt,
            image_urls: [still.url],
            video_urls: [cardClip.url],
            resolution: video.resolution,
            duration: video.duration,
            aspect_ratio: video.aspectRatio,
            generate_audio: video.generateAudio,
            bitrate_mode: "high",
          },
          toAssets: (data, jobId, setStage) =>
            finishVideo(data, jobId, setStage, {
              label: `Screen replace · ${still.label}`,
              tags: [video.resolution, `${video.duration}s`, "seedance"],
              parentId: still.id,
              prompt,
              aspect: still.aspect,
            }),
        },
      ]);
      return;
    }

    const prompt = buildAnimatePrompt({
      motionId: video.motionId,
      surface,
      sceneId: base.sceneId,
      extraNotes: video.notes,
    });

    void runner.run([
      {
        label: `Motion · ${still.label}`,
        kind: "video",
        slot: "animate",
        model: modelFor("animate"),
        input: {
          prompt,
          image_url: still.url,
          resolution: video.resolution,
          duration: video.duration,
          aspect_ratio: video.aspectRatio,
          generate_audio: video.generateAudio,
          bitrate_mode: "high",
        },
        toAssets: (data, jobId, setStage) =>
          finishVideo(data, jobId, setStage, {
            label: `Motion · ${still.label}`,
            tags: [video.resolution, `${video.duration}s`, byId(MOTIONS, video.motionId)?.label ?? "motion"],
            parentId: still.id,
            prompt,
            aspect: still.aspect,
          }),
      },
    ]);
  }, [
    assets, base.sceneId, baseId, cardVideoId, cardInsideId, finishVideo,
    keyConnected, modelFor, runner, surface, toast, video,
  ]);

  /* ------------------- straight to video (both products) -------------- */

  /**
   * One Seedance call, no still in between.
   *
   * Digital cards hand over the animation clip as @Video1. Printed cards hand
   * over the artwork itself — front as @Image1, inside spread as @Image2 when an
   * opening motion is picked — which also keeps the model from animating people
   * that a generated still had already invented.
   */
  const generateOneShot = useCallback(() => {
    if (!keyConnected) {
      setKeyDialogOpen(true);
      return;
    }

    const isPrint = surface === "print";
    const clip = assets.find((a) => a.id === cardVideoId && a.kind === "card-video");
    const front = assets.find((a) => a.id === cardFrontId && a.kind === "card-art");
    const inside = assets.find((a) => a.id === cardInsideId && a.kind === "card-art");
    const motion = byId(MOTIONS, video.motionId);
    const opensCard = Boolean(isPrint && motion?.requiresInside && inside);

    if (isPrint && !front) {
      toast("Add the printed front panel in step 1 first.", "error");
      return;
    }
    if (isPrint && motion?.requiresInside && !inside) {
      toast("That motion opens the card — add an inside spread in step 1 first.", "error");
      return;
    }
    if (!isPrint && !clip) {
      toast("Add the card animation clip in step 1 first.", "error");
      return;
    }

    const prompt = buildOneShotPrompt({
      surface,
      deviceId: base.deviceId,
      sceneId: base.sceneId,
      angleId: base.angleIds[0] ?? "pov",
      lightingId: base.lightingId,
      lookId: base.lookId,
      presenceId: base.presenceId,
      ethnicityId: base.ethnicityId,
      genderId: base.genderId,
      ageId: base.ageId,
      details: base.details,
      audienceId: base.audienceId,
      framingId: base.framingId,
      motionId: video.motionId,
      hasInside: Boolean(inside),
      hasBackground: !isPrint && usingBackground,
      extraNotes: [base.notes, video.notes].filter(Boolean).join(" "),
    });

    const device = byId(DEVICES, base.deviceId);
    /*
     * Seedance's reference-to-video takes images and video together, so a
     * digital card can be dropped into a real location the same way a printed
     * one is: the photograph goes in as @Image1, the card clip as @Video1.
     */
    const useBackground = !isPrint && usingBackground;
    const references = isPrint
      ? { image_urls: opensCard ? [front!.url, inside!.url] : [front!.url] }
      : {
          ...(useBackground ? { image_urls: [backgroundAsset!.url] } : {}),
          video_urls: [clip!.url],
        };

    void runner.run([
      {
        label: `${device?.label ?? "Scene"} · ${motion?.label ?? "motion"}`,
        kind: "video",
        slot: "screenReplace",
        model: modelFor("screenReplace"),
        input: {
          prompt,
          ...references,
          resolution: video.resolution,
          duration: video.duration,
          aspect_ratio: video.aspectRatio === "auto" ? "9:16" : video.aspectRatio,
          generate_audio: video.generateAudio,
          bitrate_mode: "high",
        },
        toAssets: (data, jobId, setStage) =>
          finishVideo(data, jobId, setStage, {
            label: `${device?.label ?? "Scene"} · ${motion?.label ?? "motion"}`,
            tags: [
              isPrint ? "printed card" : "digital card",
              ...(useBackground ? ["your background"] : []),
              video.resolution,
              ...(opensCard ? ["opens"] : []),
            ],
            parentId: isPrint ? front!.id : clip!.id,
            prompt,
          }),
      },
    ]);
  }, [
    assets, backgroundAsset, base, cardFrontId, cardInsideId, cardVideoId, finishVideo,
    keyConnected, modelFor, runner, surface, toast, usingBackground, video,
  ]);

  const value = useMemo<StudioValue>(
    () => ({
      step,
      setStep,
      surface,
      setSurface,
      assets,
      addAssets,
      removeAsset,
      removeAssetsByUrl,
      updateAsset,
      clearAssets,
      base,
      setBase,
      video,
      setVideo,
      cardFrontId,
      setCardFrontId,
      cardInsideId,
      setCardInsideId,
      cardVideoId,
      setCardVideoId,
      backgroundId,
      setBackgroundId,
      baseId,
      setBaseId,
      jobs: runner.jobs,
      busy: runner.busy,
      cancelAll: runner.cancelAll,
      basePlanCount,
      generateScenes,
      generateInsideMessage,
      generateVideo,
      generateOneShot,
      keyConnected,
      setKeyConnected,
      openKeyDialog: () => setKeyDialogOpen(true),
      keyDialogOpen,
      setKeyDialogOpen,
      keyHint,
      setKeyHint,
      confettiKey,
    }),
    [
      step, setStep, surface, setSurface, assets, addAssets, removeAsset, removeAssetsByUrl, updateAsset, clearAssets,
      base, setBase, video, setVideo,
      cardFrontId, setCardFrontId, cardInsideId, setCardInsideId,
      cardVideoId, setCardVideoId, backgroundId, setBackgroundId, baseId, setBaseId,
      runner.jobs, runner.busy, runner.cancelAll, basePlanCount,
      generateScenes, generateInsideMessage, generateVideo, generateOneShot,
      keyConnected, keyDialogOpen, keyHint, confettiKey,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { uid };
