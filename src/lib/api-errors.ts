import { NextResponse } from "next/server";
import { MissingKeyError } from "@/lib/fal-server";

/** Normalises fal client / network errors into a JSON response the studio can render. */
export function errorResponse(err: unknown) {
  if (err instanceof MissingKeyError) {
    return NextResponse.json({ error: err.message, code: "NO_KEY" }, { status: 428 });
  }
  const e = err as { status?: number; message?: string; body?: unknown };
  const status = typeof e.status === "number" && e.status >= 400 && e.status < 600 ? e.status : 500;
  let detail: string | undefined;
  if (e.body) {
    try {
      detail = JSON.stringify(e.body).slice(0, 600);
    } catch {
      /* not serialisable — skip */
    }
  }
  return NextResponse.json({ error: e.message ?? "fal request failed.", detail }, { status });
}
