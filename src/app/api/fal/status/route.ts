import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { activeProvider } from "@/lib/active-provider";
import { statusFromProvider } from "@/lib/generate";
import { errorResponse } from "@/lib/api-errors";

/**
 * A shape check, not an allowlist.
 *
 * Polling is per-poll-tick and can't afford a catalogue lookup, and it doesn't
 * need one: the job was already vetted at submit, and reading queue status uses
 * the caller's own key against their own request id. This exists so the value
 * can't be anything but a fal endpoint path.
 */
const ENDPOINT_ID = /^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9._-]*){1,3}$/i;

/**
 * Polls a queued job. When it's COMPLETED we fetch the payload in the same
 * round-trip so the client doesn't need a second call.
 */
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const model = url.searchParams.get("model");
  const requestId = url.searchParams.get("requestId");

  if (!model || !ENDPOINT_ID.test(model)) {
    return NextResponse.json({ error: `Unsupported model: ${model}` }, { status: 400 });
  }
  if (!requestId) {
    return NextResponse.json({ error: "requestId is required." }, { status: 400 });
  }

  try {
    /*
     * Polled against whoever issued the id. Only video and non-OpenAI image
     * jobs are ever polled at all — OpenAI answers inline — so resolving by
     * "video" here would be wrong for a fal or Replicate image job. The active
     * provider is right in every case except OpenAI, which never gets here.
     */
    const image = await activeProvider("image");
    const provider = image === "openai" ? await activeProvider("video") : image;
    return NextResponse.json(await statusFromProvider(provider, model, requestId));
  } catch (err) {
    return errorResponse(err);
  }
}
