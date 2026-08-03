/**
 * fal.ai endpoint ids used by the studio.
 * Schemas verified against https://fal.ai/api/openapi/queue/openapi.json?endpoint_id=<id>
 */
export const MODELS = {
  /** GPT-Image-2 text-to-image — builds the BASE asset. */
  baseImage: "openai/gpt-image-2",
  /** GPT-Image-2 edit — composites card artwork onto the blank surface. */
  compositeImage: "openai/gpt-image-2/edit",
  /** Seedance 2.0 image-to-video — animates a still. */
  animate: "bytedance/seedance-2.0/image-to-video",
  /** Seedance 2.0 reference-to-video — plays an uploaded card clip on the surface. */
  screenReplace: "bytedance/seedance-2.0/reference-to-video",
  /** ffmpeg timeline compose — used to burn the logo overlay into a finished clip. */
  videoCompose: "fal-ai/ffmpeg-api/compose",
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

export const ALLOWED_MODELS: string[] = Object.values(MODELS);

/** Rough per-call cost guidance shown in the UI. Indicative only. */
export const COST_HINTS: Record<string, string> = {
  [MODELS.baseImage]: "~$0.02–0.19 / image",
  [MODELS.compositeImage]: "~$0.02–0.19 / image",
  [MODELS.animate]: "video pricing by resolution × duration",
  [MODELS.screenReplace]: "video pricing by resolution × duration",
  [MODELS.videoCompose]: "~$0.0002 / second",
};
