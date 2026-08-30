/* --------------------------- output shapes --------------------------- */

/**
 * Replicate's output, rewritten as the shape the studio already reads.
 *
 * fal answers `{ images: [{ url }] }` or `{ video: { url } }`, and every
 * `toAssets` handler in the app is written against that. Replicate answers with
 * the bare thing: a URL string, or an array of them, or an object with a url in
 * it depending on the model. Translating here means one place understands the
 * difference instead of every call site growing a second branch.
 *
 * Both keys are filled when the type is ambiguous. A caller looking for images
 * finds images, a caller looking for video finds video, and the asset it
 * creates carries the kind the *step* meant rather than the kind this function
 * guessed from a file extension.
 */
export function normaliseOutput(output: unknown): unknown {
  const urls = collectUrls(output);
  if (!urls.length) return output;

  const video = urls.find((u) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u));
  return {
    images: urls.map((url) => ({ url })),
    video: { url: video ?? urls[0] },
    /* Kept so a caller that knows better can read past the translation. */
    output,
  };
}

function collectUrls(value: unknown, depth = 0): string[] {
  if (depth > 3) return [];
  if (typeof value === "string") return /^https?:\/\//.test(value) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((v) => collectUrls(v, depth + 1));
  if (value && typeof value === "object") {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string") return [url];
    return Object.values(value).flatMap((v) => collectUrls(v, depth + 1));
  }
  return [];
}
