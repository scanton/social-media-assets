import type { ProviderId } from "@/lib/providers";

/**
 * The same prompt, in the reference syntax the provider actually reads.
 *
 * Seedance is one model, and both providers host it, but they do not agree on
 * how a prompt names its reference media. Their own schemas say so:
 *
 *   fal        video_urls        "Refer to them in the prompt as @Video1, @Video2"
 *   Replicate  reference_videos  "Reference them in your prompt as [Video1], [Video2]"
 *
 * The studio's prompts were written against fal and say `@Video1`. Sent to
 * Replicate unchanged, that token matches nothing — so the reference is
 * attached to the request and never referred to by the prompt, and the model
 * does the reasonable thing with a description of a card animation and no
 * instruction to play one: it invents its own. Which is exactly what came back,
 * and it reads as a model limitation rather than a syntax mismatch.
 *
 * Applied where the request is built AND where the compiled prompt is shown, so
 * "this is what gets sent" stays true.
 */
export function toPromptDialect(prompt: string, provider: ProviderId): string {
  if (provider !== "replicate") return prompt;
  // @Video1 → [Video1]. Audio is included because seedance takes those too.
  return prompt.replace(/@(Video|Image|Audio)(\d+)/g, "[$1$2]");
}

/** The same, over a whole input payload. */
export function inputInDialect(
  input: Record<string, unknown>,
  provider: ProviderId,
): Record<string, unknown> {
  const prompt = input.prompt;
  if (typeof prompt !== "string") return input;
  const next = toPromptDialect(prompt, provider);
  return next === prompt ? input : { ...input, prompt: next };
}
