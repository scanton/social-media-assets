"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  ASPECTS,
  buildAnimatePrompt,
  buildOneShotPrompt,
  buildScenePrompt,
  buildScreenReplacePrompt,
  byId,
  DEVICES,
  MOTIONS,
  SCENES,
  type AspectId,
  type SurfaceKind,
} from "@/lib/options";
import { MODELS } from "@/lib/models";
import type { Asset } from "@/lib/studio-types";
import { useJobRunner, type JobSpec } from "@/lib/use-jobs";
import {
  getPersisted,
  updatePersisted,
  usePersisted,
  type BaseConfig,
  type VideoConfig,
} from "@/lib/persisted-store";
import { composeScene } from "@/lib/compose";
import { stampVideoLogo } from "@/lib/video-logo";
import { useToast } from "./ui";

export type { BaseConfig, VideoConfig };

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
  updateAsset: (id: string, patch: Partial<Asset>) => void;
  clearAssets: () => void;

  base: BaseConfig;
  setBase: (patch: Partial<BaseConfig>) => void;
  video: VideoConfig;
  setVideo: (patch: Partial<VideoConfig>) => void;

  cardArtId: string | null;
  setCardArtId: (id: string | null) => void;
  cardVideoId: string | null;
  setCardVideoId: (id: string | null) => void;
  baseId: string | null;
  setBaseId: (id: string | null) => void;

  jobs: ReturnType<typeof useJobRunner>["jobs"];
  busy: boolean;
  cancelAll: () => void;

  flow: 1 | 2;
  setFlow: (f: 1 | 2) => void;

  basePlanCount: number;
  generateScenes: () => void;
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

  // assets / base / video / surface live in an external store so they survive a
  // reload without a hydration-mismatch dance. See lib/persisted-store.ts.
  const { assets, base, video, surface, cardArtId, cardVideoId, baseId, flow } = usePersisted();
  const setFlow = useCallback((f: 1 | 2) => updatePersisted({ flow: f }), []);

  const [step, setStepRaw] = useState(1);

  const setCardArtId = useCallback((cardArtId: string | null) => updatePersisted({ cardArtId }), []);
  const setCardVideoId = useCallback(
    (cardVideoId: string | null) => updatePersisted({ cardVideoId }),
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

  const addAssets = useCallback((next: Asset[]) => {
    updatePersisted({ assets: [...next, ...getPersisted().assets] });
  }, []);

  const removeAsset = useCallback((id: string) => {
    const current = getPersisted();
    const removed = current.assets.find((a) => a.id === id);
    const assets = current.assets.filter((a) => a.id !== id);

    // Screen-replace needs a clip; without one it would just fail at render time.
    const lostLastClip =
      removed?.kind === "card-video" && !assets.some((a) => a.kind === "card-video");

    // Fall back to the next asset of the same kind rather than clearing the
    // slot — an empty slot is how step 2 silently went back to blank screens.
    const nextOf = (kind: Asset["kind"]) =>
      assets.filter((a) => a.kind === kind).sort((a, b) => b.createdAt - a.createdAt)[0]?.id ?? null;

    updatePersisted({
      assets,
      ...(current.cardArtId === id ? { cardArtId: nextOf("card-art") } : {}),
      ...(current.cardVideoId === id ? { cardVideoId: nextOf("card-video") } : {}),
      ...(current.baseId === id ? { baseId: nextOf("base") } : {}),
      ...(lostLastClip && current.video.engine === "screen-replace"
        ? { video: { ...current.video, engine: "animate" as const } }
        : {}),
    });
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
      cardArtId: null,
      cardVideoId: null,
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

  const basePlanCount = base.angleIds.length * base.aspectIds.length * base.variations;

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
    if (!base.angleIds.length || !base.aspectIds.length) {
      toast("Pick at least one camera angle and one orientation.", "error");
      return;
    }

    const cardAsset = assets.find((a) => a.id === cardArtId && a.kind === "card-art");
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

    const scene = byId(SCENES, base.sceneId);
    const device = byId(DEVICES, base.deviceId);
    const specs: JobSpec[] = [];

    for (const aspectId of base.aspectIds) {
      const aspect = ASPECTS.find((a) => a.id === aspectId)!;
      for (const angleId of base.angleIds) {
        for (let v = 1; v <= base.variations; v++) {
          const prompt = buildScenePrompt({
            surface,
            deviceId: base.deviceId,
            sceneId: base.sceneId,
            angleId,
            lightingId: base.lightingId,
            lookId: base.lookId,
            presenceId: base.presenceId,
            audienceId: base.audienceId,
            framingId: base.framingId,
            aspect: aspectId,
            hasCard: modelPlacesCard,
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

          const size = { width: aspect.width, height: aspect.height };

          specs.push({
            label: `${device?.label ?? "Scene"} · ${aspectId} · v${v}`,
            kind: "base",
            model: modelPlacesCard ? MODELS.compositeImage : MODELS.baseImage,
            input: modelPlacesCard
              ? {
                  prompt,
                  image_urls: [cardAsset!.url],
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
                    label: `${device?.label ?? "Scene"} · v${v}`,
                    tags: [
                      aspectId,
                      angleId,
                      hasCard ? "card placed" : "blank surface",
                      scene?.label ?? "scene",
                    ],
                    createdAt: Date.now(),
                    prompt,
                    aspect: aspectId,
                    surface,
                  };

                  if (!compositeHere && !base.logo) return asset;

                  try {
                    const composed = await composeScene({
                      renderUrl: img.url,
                      cardUrl: compositeHere ? cardAsset!.url : null,
                      withLogo: base.logo,
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
  }, [assets, base, cardArtId, keyConnected, runner, surface, toast]);

  /* -------------------------- step 3: video -------------------------- */

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

    if (video.engine === "screen-replace") {
      if (!cardClip) {
        toast("Screen-replace needs an uploaded card video from step 1.", "error");
        return;
      }
      const prompt = buildScreenReplacePrompt({
        surface,
        motionId: video.motionId,
        hasLogo: base.logo,
        extraNotes: video.notes,
      });
      void runner.run([
        {
          label: `Screen replace · ${still.label}`,
          kind: "video",
          model: MODELS.screenReplace,
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
          toAssets: (data, jobId) => {
            const v = (data as { video?: { url: string; content_type?: string } }).video;
            if (!v) return [];
            return [
              {
                id: `${jobId}-0`,
                kind: "video" as const,
                url: v.url,
                contentType: v.content_type ?? "video/mp4",
                label: `Screen replace · ${still.label}`,
                tags: [video.resolution, `${video.duration}s`, "seedance"],
                createdAt: Date.now(),
                parentId: still.id,
                prompt,
                aspect: still.aspect,
                surface,
              },
            ];
          },
        },
      ]);
      return;
    }

    const prompt = buildAnimatePrompt({
      motionId: video.motionId,
      surface,
      sceneId: base.sceneId,
      hasLogo: base.logo,
      extraNotes: video.notes,
    });

    void runner.run([
      {
        label: `Motion · ${still.label}`,
        kind: "video",
        model: MODELS.animate,
        input: {
          prompt,
          image_url: still.url,
          resolution: video.resolution,
          duration: video.duration,
          aspect_ratio: video.aspectRatio,
          generate_audio: video.generateAudio,
          bitrate_mode: "high",
        },
        toAssets: (data, jobId) => {
          const v = (data as { video?: { url: string; content_type?: string } }).video;
          if (!v) return [];
          return [
            {
              id: `${jobId}-0`,
              kind: "video" as const,
              url: v.url,
              contentType: v.content_type ?? "video/mp4",
              label: `Motion · ${still.label}`,
              tags: [video.resolution, `${video.duration}s`, byId(MOTIONS, video.motionId)?.label ?? "motion"],
              createdAt: Date.now(),
              parentId: still.id,
              prompt,
              aspect: still.aspect,
              surface,
            },
          ];
        },
      },
    ]);
  }, [assets, base.sceneId, base.logo, baseId, cardVideoId, keyConnected, runner, surface, toast, video]);

  /* --------------------- flow 2: straight to video -------------------- */

  const generateOneShot = useCallback(() => {
    if (!keyConnected) {
      setKeyDialogOpen(true);
      return;
    }
    const clip = assets.find((a) => a.id === cardVideoId && a.kind === "card-video");
    if (!clip) {
      toast("Flow 2 needs an uploaded card clip — add one in step 1.", "error");
      return;
    }

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

    const device = byId(DEVICES, base.deviceId);

    void runner.run([
      {
        label: `One-shot · ${device?.label ?? "scene"}`,
        kind: "video",
        model: MODELS.screenReplace,
        input: {
          prompt,
          video_urls: [clip.url],
          resolution: video.resolution,
          duration: video.duration,
          aspect_ratio: video.aspectRatio === "auto" ? "9:16" : video.aspectRatio,
          generate_audio: video.generateAudio,
          bitrate_mode: "high",
        },
        toAssets: async (data, jobId, setStage) => {
          const v = (data as { video?: { url: string; content_type?: string } }).video;
          if (!v) return [];

          /*
           * Flow 1 inherits the logo from the still it animates. Flow 2 has no
           * still, so the emblem is burned in afterwards with ffmpeg compose.
           */
          let url = v.url;
          let stamped = false;
          if (base.logo) {
            try {
              url = await stampVideoLogo(v.url, (p) =>
                setStage(p.pct != null ? `Logo ${p.pct}%` : p.stage),
              );
              stamped = true;
            } catch (err) {
              toast(
                `Logo stamp failed, keeping the un-stamped clip. ${(err as Error).message}`,
                "error",
              );
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
              label: `One-shot · ${device?.label ?? "scene"}`,
              tags: [
                "flow 2",
                video.resolution,
                base.logo ? (stamped ? "logo" : "no logo") : "no logo",
                byId(MOTIONS, video.motionId)?.label ?? "motion",
              ],
              createdAt: Date.now(),
              parentId: clip.id,
              prompt,
              surface,
              rawUrl: stamped ? v.url : undefined,
            },
          ];
        },
      },
    ]);
  }, [assets, base, cardVideoId, keyConnected, runner, surface, toast, video]);

  const value = useMemo<StudioValue>(
    () => ({
      step,
      setStep,
      surface,
      setSurface,
      assets,
      addAssets,
      removeAsset,
      updateAsset,
      clearAssets,
      base,
      setBase,
      video,
      setVideo,
      cardArtId,
      setCardArtId,
      cardVideoId,
      setCardVideoId,
      baseId,
      setBaseId,
      jobs: runner.jobs,
      busy: runner.busy,
      cancelAll: runner.cancelAll,
      flow,
      setFlow,
      basePlanCount,
      generateScenes,
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
      step, setStep, surface, setSurface, assets, addAssets, removeAsset, updateAsset, clearAssets,
      base, setBase, video, setVideo,
      cardArtId, setCardArtId, cardVideoId, setCardVideoId, baseId, setBaseId,
      runner.jobs, runner.busy, runner.cancelAll, basePlanCount,
      generateScenes, generateVideo, generateOneShot, flow, setFlow,
      keyConnected, keyDialogOpen, keyHint, confettiKey,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { uid };
