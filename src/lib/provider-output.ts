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

  /*
   * Each URL appears under exactly one key.
   *
   * The first version filled both — `images` for callers looking for stills and
   * `video` for callers looking for clips — on the theory that the step reading
   * it knows which it wanted. The freeform page does not read a key: it walks
   * whatever it is given and collects every `{ url }` it finds, which is what
   * makes it work with any model. So one render came back as two identical
   * tiles in the roll.
   *
   * Splitting by what the URL actually is costs nothing and cannot double: an
   * image step finds its images, a video step finds its video, and a walker
   * finds each asset once. The raw output is not passed through either, for the
   * same reason — it would be a third copy of the same URLs.
   */
  const isVideo = (u: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(u);
  const videos = urls.filter(isVideo);
  const images = urls.filter((u) => !isVideo(u));

  const out: { images?: { url: string }[]; video?: { url: string } } = {};
  if (images.length) out.images = images.map((url) => ({ url }));
  if (videos.length) out.video = { url: videos[0] };
  /*
   * A single asset whose extension says nothing — a signed URL with no suffix,
   * which Replicate does hand out — is offered as an image rather than dropped.
   * `collectUrls` found it, so something is there.
   */
  if (!out.images && !out.video) out.images = urls.map((url) => ({ url }));
  return out;
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
