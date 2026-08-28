import { NextResponse } from "next/server";
import { MissingKeyError } from "@/lib/fal-server";

/**
 * fal's validation errors are structured. We were throwing that away.
 *
 * A rejected job comes back FastAPI-shaped — a `detail` array where every entry
 * names the offending field, says what is wrong with it in a sentence, and
 * carries a machine-readable `type`. The old code ran `JSON.stringify` over the
 * whole thing and truncated it at 600 characters, so what reached the user was:
 *
 *   Unprocessable Entity — {"detail":[{"loc":["body","reference_video_urls",0],
 *   "msg":"Video duration exceeds the maximum allowed. Maximum is 3.0 seconds.",
 *   "type":"video_duration_too_long","url":"https://docs.fal.ai/errors#video_…
 *
 * Every word needed to fix the problem was in there, behind punctuation. Now it
 * reads:
 *
 *   reference_video_urls[0]: Video duration exceeds the maximum allowed.
 *   Maximum is 3.0 seconds.
 *
 * Nothing is interpreted or rewritten — fal's own sentence is the message. This
 * only decides where it ends up in the string.
 */

type ValidationItem = {
  loc?: unknown[];
  msg?: string;
  type?: string;
};

/** `["body","reference_video_urls",0]` → `reference_video_urls[0]`. */
function fieldPath(loc: unknown[] | undefined): string {
  if (!Array.isArray(loc) || !loc.length) return "";
  // "body" is where every input lives; saying so on every line is noise.
  const parts = loc[0] === "body" ? loc.slice(1) : loc;
  return parts.reduce<string>((acc, part) => {
    if (typeof part === "number") return `${acc}[${part}]`;
    return acc ? `${acc}.${part}` : String(part);
  }, "");
}

function readValidation(body: unknown): string | undefined {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return undefined;

  const lines = detail
    .map((raw) => {
      const item = raw as ValidationItem;
      if (typeof item?.msg !== "string") return null;
      const where = fieldPath(item.loc);
      return where ? `${where}: ${item.msg}` : item.msg;
    })
    .filter((l): l is string => Boolean(l));

  return lines.length ? lines.join("; ") : undefined;
}

/** Normalises fal client / network errors into a JSON response the studio can render. */
export function errorResponse(err: unknown) {
  if (err instanceof MissingKeyError) {
    return NextResponse.json({ error: err.message, code: "NO_KEY" }, { status: 428 });
  }
  const e = err as { status?: number; message?: string; body?: unknown };
  const status = typeof e.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500;

  let detail: string | undefined;
  if (e.body) {
    detail = readValidation(e.body);
    if (!detail) {
      // Not a shape we recognise. The raw body still beats nothing.
      try {
        detail = JSON.stringify(e.body).slice(0, 600);
      } catch {
        /* not serialisable — skip */
      }
    }
  }
  return NextResponse.json({ error: e.message ?? "fal request failed.", detail }, { status });
}
