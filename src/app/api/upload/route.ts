import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { requireReplicateKey } from "@/lib/replicate-server";
import { errorResponse } from "@/lib/api-errors";

/**
 * Uploads a file to Replicate, through here.
 *
 * fal hands out a signed URL and the browser PUTs straight to its CDN, so a
 * 40 MB card animation never touches our origin. Replicate has no such thing:
 * /v1/files is a multipart POST authenticated with the token, and the token is
 * httpOnly precisely so the browser never holds it. So the bytes come through
 * this route.
 *
 * That is a real cost and worth stating: it is bounded by the platform's
 * request-body limit rather than by fal's 90 MB, and it spends function time
 * proportional to the file. Replicate caps files at 100 MB, which is the
 * smaller number in practice.
 *
 * Not a general-purpose proxy: it forwards exactly one multipart field to
 * exactly one upstream URL, with the caller's own credential.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const key = await requireReplicateKey();

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required." }, { status: 400 });
    }

    const upstream = new FormData();
    upstream.append("content", file, file.name || "upload");
    upstream.append("filename", file.name || "upload");

    const res = await fetch("https://api.replicate.com/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: upstream,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const detail = (body as { detail?: unknown } | null)?.detail;
      return NextResponse.json(
        {
          error: `Replicate rejected the upload (${res.status}).`,
          detail: typeof detail === "string" ? detail : undefined,
        },
        { status: res.status },
      );
    }

    const json = (await res.json()) as { urls?: { get?: string } };
    const fileUrl = json.urls?.get;
    if (!fileUrl) {
      return NextResponse.json({ error: "Replicate returned no file URL." }, { status: 502 });
    }
    return NextResponse.json({ fileUrl });
  } catch (err) {
    return errorResponse(err);
  }
}
