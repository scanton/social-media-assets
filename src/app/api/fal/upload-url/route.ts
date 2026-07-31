import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { MissingKeyError, readFalKey } from "@/lib/fal-server";

/**
 * Mints a direct-to-fal upload URL.
 *
 * The browser PUTs the file bytes straight to fal's CDN, so a 40 MB card video
 * never touches our server (and never hits a serverless body-size limit).
 * Only the tiny "initiate" call needs the user's key, which stays server-side.
 */
export async function POST(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const key = await readFalKey();
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
    return NextResponse.json({ uploadUrl: json.upload_url, fileUrl: json.file_url });
  } catch (err) {
    if (err instanceof MissingKeyError) {
      return NextResponse.json({ error: err.message, code: "NO_KEY" }, { status: 428 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
