"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  ASPECTS,
  buildAnimatePrompt,
  buildBasePrompt,
  buildCompositePrompt,
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
  compositeId: string | null;
  setCompositeId: (id: string | null) => void;

  jobs: ReturnType<typeof useJobRunner>["jobs"];
  busy: boolean;
  cancelAll: () => void;

  basePlanCount: number;
  generateBases: () => void;
  generateComposites: () => void;
  generateVideo: () => void;

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
  const { assets, base, video, surface } = usePersisted();

  const [step, setStepRaw] = useState(1);
  const [cardArtId, setCardArtId] = useState<string | null>(null);
  const [cardVideoId, setCardVideoId] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [compositeId, setCompositeId] = useState<string | null>(null);

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
    updatePersisted({ assets: getPersisted().assets.filter((a) => a.id !== id) });
    setCardArtId((v) => (v === id ? null : v));
    setCardVideoId((v) => (v === id ? null : v));
    setBaseId((v) => (v === id ? null : v));
    setCompositeId((v) => (v === id ? null : v));
  }, []);

  const clearAssets = useCallback(() => {
    updatePersisted({ assets: [] });
    setCardArtId(null);
    setCardVideoId(null);
    setBaseId(null);
    setCompositeId(null);
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

  /* -------------------------- step 2: base art ------------------------ */

  const basePlanCount = base.angleIds.length * base.aspectIds.length * base.variations;

  const generateBases = useCallback(() => {
    if (!keyConnected) {
      setKeyDialogOpen(true);
      return;
    }
    if (!base.angleIds.length || !base.aspectIds.length) {
      toast("Pick at least one camera angle and one orientation.", "error");
      return;
    }

    const scene = byId(SCENES, base.sceneId);
    const device = byId(DEVICES, base.deviceId);
    const specs: JobSpec[] = [];

    for (const aspectId of base.aspectIds) {
      const aspect = ASPECTS.find((a) => a.id === aspectId)!;
      for (const angleId of base.angleIds) {
        for (let v = 1; v <= base.variations; v++) {
          const prompt = buildBasePrompt({
            surface,
            deviceId: base.deviceId,
            sceneId: base.sceneId,
            angleId,
            lightingId: base.lightingId,
            lookId: base.lookId,
            presenceId: base.presenceId,
            audienceId: base.audienceId,
            aspect: aspectId,
            blankScreen: base.blankScreen,
            // GPT-Image-2 has no seed input, so variation comes from separate
            // calls plus a light nudge in the prompt.
            extraNotes: [base.notes, base.variations > 1 ? `Variation ${v}: change the exact composition, props and micro-details while keeping every requirement above.` : ""]
              .filter(Boolean)
              .join(" "),
          });

          specs.push({
            label: `${device?.label ?? "Base"} · ${aspectId} · v${v}`,
            kind: "base",
            model: MODELS.baseImage,
            input: {
              prompt,
              image_size: { width: aspect.width, height: aspect.height },
              quality: base.quality,
              num_images: 1,
              output_format: "png",
            },
            toAssets: (data, jobId) => {
              const images = (data as { images?: FalImage[] }).images ?? [];
              return images.map((img, i) => ({
                id: `${jobId}-${i}`,
                kind: "base" as const,
                url: img.url,
                contentType: img.content_type,
                width: img.width,
                height: img.height,
                label: `${device?.label ?? "Base"} · v${v}`,
                tags: [aspectId, angleId, scene?.label ?? "scene"],
                createdAt: Date.now(),
                prompt,
                aspect: aspectId,
                surface,
              }));
            },
          });
        }
      }
    }

    void runner.run(specs);
  }, [base, keyConnected, runner, surface, toast]);

  /* ------------------------ step 3: composite ------------------------ */

  const generateComposites = useCallback(() => {
    if (!keyConnected) {
      setKeyDialogOpen(true);
      return;
    }
    const baseAsset = assets.find((a) => a.id === baseId);
    const cardAsset = assets.find((a) => a.id === cardArtId);
    if (!baseAsset || !cardAsset) {
      toast("Pick a base image and a card artwork first.", "error");
      return;
    }

    const prompt = buildCompositePrompt({ surface, hasBase: true, extraNotes: base.notes });

    void runner.run([
      {
        label: `Card on ${baseAsset.label}`,
        kind: "composite",
        model: MODELS.compositeImage,
        input: {
          prompt,
          image_urls: [baseAsset.url, cardAsset.url],
          image_size: "auto",
          quality: base.quality,
          num_images: Math.min(4, Math.max(1, base.compositeVariations)),
          output_format: "png",
        },
        toAssets: (data, jobId) => {
          const images = (data as { images?: FalImage[] }).images ?? [];
          return images.map((img, i) => ({
            id: `${jobId}-${i}`,
            kind: "composite" as const,
            url: img.url,
            contentType: img.content_type,
            width: img.width,
            height: img.height,
            label: `Placed · ${baseAsset.label}`,
            tags: [baseAsset.aspect ?? "auto", "composite", `v${i + 1}`],
            createdAt: Date.now(),
            parentId: baseAsset.id,
            prompt,
            aspect: baseAsset.aspect,
            surface,
          }));
        },
      },
    ]);
  }, [assets, base.notes, base.quality, base.compositeVariations, baseId, cardArtId, keyConnected, runner, surface, toast]);

  /* -------------------------- step 4: video -------------------------- */

  const generateVideo = useCallback(() => {
    if (!keyConnected) {
      setKeyDialogOpen(true);
      return;
    }

    const still =
      assets.find((a) => a.id === compositeId) ??
      assets.find((a) => a.id === baseId);
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
      const prompt = buildScreenReplacePrompt({ surface, motionId: video.motionId, extraNotes: video.notes });
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
  }, [assets, base.sceneId, baseId, cardVideoId, compositeId, keyConnected, runner, surface, toast, video]);

  const value = useMemo<StudioValue>(
    () => ({
      step,
      setStep,
      surface,
      setSurface,
      assets,
      addAssets,
      removeAsset,
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
      compositeId,
      setCompositeId,
      jobs: runner.jobs,
      busy: runner.busy,
      cancelAll: runner.cancelAll,
      basePlanCount,
      generateBases,
      generateComposites,
      generateVideo,
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
      step, setStep, surface, setSurface, assets, addAssets, removeAsset, clearAssets,
      base, setBase, video, setVideo, cardArtId, cardVideoId, baseId, compositeId,
      runner.jobs, runner.busy, runner.cancelAll, basePlanCount,
      generateBases, generateComposites, generateVideo,
      keyConnected, keyDialogOpen, keyHint, confettiKey,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export { uid };
