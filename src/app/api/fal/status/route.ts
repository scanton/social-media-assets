import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { falForRequest } from "@/lib/fal-server";
import { ALLOWED_MODELS } from "@/lib/models";
import { errorResponse } from "@/lib/api-errors";

/**
 * Polls a queued job. When it's COMPLETED we fetch the payload in the same
 * round-trip so the client doesn't need a second call.
 */
export async function GET(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const model = url.searchParams.get("model");
  const requestId = url.searchParams.get("requestId");

  if (!model || !ALLOWED_MODELS.includes(model)) {
    return NextResponse.json({ error: `Unsupported model: ${model}` }, { status: 400 });
  }
  if (!requestId) {
    return NextResponse.json({ error: "requestId is required." }, { status: 400 });
  }

  try {
    const fal = await falForRequest();
    const status = await fal.queue.status(model, { requestId, logs: true });

    if (status.status !== "COMPLETED") {
      return NextResponse.json({
        status: status.status,
        queuePosition: "queue_position" in status ? status.queue_position : undefined,
      });
    }

    const result = await fal.queue.result(model, { requestId });
    return NextResponse.json({ status: "COMPLETED", data: result.data });
  } catch (err) {
    return errorResponse(err);
  }
}
