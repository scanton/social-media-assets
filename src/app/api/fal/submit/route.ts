import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { falForRequest } from "@/lib/fal-server";
import { fetchInputSchema, isModelAllowed } from "@/lib/model-catalog";
import { adaptInput } from "@/lib/model-input";
import { isModelSlotId } from "@/lib/models";
import { errorResponse } from "@/lib/api-errors";

/**
 * Queues a generation job on fal and hands the request id back for polling.
 *
 * The client sends the studio's canonical payload plus the step it belongs to;
 * the reshaping to whatever model was picked happens here, where the schema
 * already lives. Keeping it server-side means the client never has to know a
 * model's input format, and there is exactly one place adaptation can go wrong.
 */
export async function POST(req: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { model, slot, input } = (await req.json()) as {
      model?: string;
      slot?: string;
      input?: unknown;
    };

    if (!isModelSlotId(slot)) {
      return NextResponse.json({ error: `Unknown step: ${slot}` }, { status: 400 });
    }
    if (!model || typeof model !== "string") {
      return NextResponse.json({ error: "model is required." }, { status: 400 });
    }
    if (!input || typeof input !== "object") {
      return NextResponse.json({ error: "input must be an object." }, { status: 400 });
    }

    /*
     * The allowlist is no longer a fixed array, but it is still an allowlist:
     * the model has to be in this step's fal category *and* expose the inputs
     * this step sends. Without that check an open deployment would proxy any of
     * fal's ~1,400 endpoints.
     */
    if (!(await isModelAllowed(model, slot))) {
      return NextResponse.json(
        { error: `${model} can't run this step. Pick another model.` },
        { status: 400 },
      );
    }

    const schema = await fetchInputSchema(model);
    const adapted = adaptInput(input as Record<string, unknown>, schema);

    const fal = await falForRequest();
    const queued = await fal.queue.submit(model, { input: adapted.input });

    return NextResponse.json({
      requestId: queued.request_id,
      model,
      // Reported rather than silent: a dropped aspect ratio changes the asset.
      dropped: adapted.dropped,
      coerced: adapted.coerced,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
