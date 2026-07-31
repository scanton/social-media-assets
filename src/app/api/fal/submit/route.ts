import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { falForRequest } from "@/lib/fal-server";
import { ALLOWED_MODELS } from "@/lib/models";
import { errorResponse } from "@/lib/api-errors";

/** Queues a generation job on fal and hands the request id back for polling. */
export async function POST(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { model, input } = (await req.json()) as { model?: string; input?: unknown };

    if (!model || !ALLOWED_MODELS.includes(model)) {
      return NextResponse.json({ error: `Unsupported model: ${model}` }, { status: 400 });
    }
    if (!input || typeof input !== "object") {
      return NextResponse.json({ error: "input must be an object." }, { status: 400 });
    }

    const fal = await falForRequest();
    const queued = await fal.queue.submit(model, {
      input: input as Record<string, unknown>,
    });

    return NextResponse.json({ requestId: queued.request_id, model });
  } catch (err) {
    return errorResponse(err);
  }
}
