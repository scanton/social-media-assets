import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { MissingKeyError, readFalKey } from "@/lib/fal-server";
import { activeProvider } from "@/lib/active-provider";

/**
 * Mints a direct-to-fal upload URL.
 *
 * The browser PUTs the file bytes straight to fal's CDN, so a 40 MB card video
 * never touches our server (and never hits a serverless body-size limit).
 * Only the tiny "initiate" call needs the user's key, which stays server-side.
 *
 * Used for Replicate too, whenever a fal key is on the browser — which reads
 * oddly until you see what the alternative costs.
 *
 * Replicate has no signed-URL upload: /v1/files is a multipart POST carrying
 * the token, and the token is httpOnly precisely so the browser never holds
 * it, so those bytes have to come through our own function. Vercel caps a
 * function's request body at 4.5 MB — a platform limit, not a setting, with no
 * config key to raise it — and a 10 MB card animation dies there on a 413.
 * That is not a hypothetical: it is how this route got written up.
 *
 * fal's CDN is already paid for, already public, and already expires in a
 * week, and Replicate takes any public HTTPS URL as a file input. So the file
 * goes to fal's CDN and Replicate is handed the link. Nothing about the
 * generation moves: it still runs on the user's Replicate account.
 *
 * Only when there is no fal key does Replicate fall back to the proxy, which
 * still works — under 4.5 MB.
 */
export async function POST(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    /*
     * fal's CDN is the upload route for both providers, so this only needs the
     * fal key — not the active one. A Replicate user with a fal key on the
     * browser gets the direct upload and no size ceiling.
     */
    const key = await readFalKey();
    const provider = await activeProvider();

    if (provider === "replicate" && !key) {
      /*
       * No fal key, so the bytes have to come through our own function, and
       * the platform's ceiling applies. Declared rather than discovered:
       * without it a 10 MB file uploads in full and is then answered with a
       * bare 413, so the user waits through the whole transfer to be told
       * nothing they can act on.
       *
       * Only on Vercel. `next dev` has no such limit, which is exactly why
       * this reached production without showing up locally, and hard-coding
       * the smaller number everywhere would hide the difference rather than
       * report it.
       *
       * Under the 4.5 MB by a margin, because the multipart envelope — the
       * boundary lines, the filename, the headers — is counted too.
       */
      const maxBytes = process.env.VERCEL ? 4_300_000 : undefined;
      return NextResponse.json({ mode: "proxy", uploadUrl: "/api/upload", fileUrl: null, maxBytes });
    }

    if (!key) throw new MissingKeyError();

    const { fileName, contentType } = (await req.json()) as {
      fileName?: string;
      contentType?: string;
    };
    if (!fileName || !contentType) {
      return NextResponse.json({ error: "fileName and contentType are required." }, { status: 400 });
    }

    const res = await fetch(
      "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${key}`,
          "Content-Type": "application/json",
          // Assets are working files — let fal expire them in a week.
          "X-Fal-Object-Lifecycle": JSON.stringify({ expiration_duration_seconds: 604800 }),
        },
        body: JSON.stringify({ content_type: contentType, file_name: fileName }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: `fal rejected the upload request (${res.status}).`, detail: detail.slice(0, 400) },
        { status: res.status },
      );
    }

    const json = (await res.json()) as { upload_url: string; file_url: string };
    return NextResponse.json({ mode: "direct", uploadUrl: json.upload_url, fileUrl: json.file_url });
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json({ error: err.message, code: "NO_KEY" }, { status: 428 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
