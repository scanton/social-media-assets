import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { activeProvider } from "@/lib/active-provider";
import { submitToProvider } from "@/lib/generate";
import { fetchInputSchema, isModelAllowed, isModelInOpenCategory } from "@/lib/model-catalog";
import { adaptInput } from "@/lib/model-input";
import { isModelSlotId, type ModelSlotId } from "@/lib/models";
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

    /*
     * `slot` is a guided step; `freeform` is the open page. Both are guarded,
     * differently: a step demands its own category AND the inputs it sends, and
     * freeform demands only that the model is one of the image or video ones.
     * Freeform sends whatever the model's own schema declares, so requiring a
     * fixed shape there would defeat the point of the page.
     */
    const freeform = slot === "freeform";

    if (!freeform && !isModelSlotId(slot)) {
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
    const provider0 = await activeProvider();
    const allowed = freeform
      ? await isModelInOpenCategory(model, provider0)
      : await isModelAllowed(model, slot as ModelSlotId, provider0);
    if (!allowed) {
      return NextResponse.json(
        {
          error: freeform
            ? `${model} is not an image or video model.`
            : `${model} can't run this step. Pick another model.`,
        },
        { status: 400 },
      );
    }

    const provider = provider0;
    const schema = await fetchInputSchema(model, provider);
    const adapted = adaptInput(input as Record<string, unknown>, schema);

    const requestId = await submitToProvider(provider, model, adapted.input);

    return NextResponse.json({
      requestId,
      provider,
      model,
      // Reported rather than silent: a dropped aspect ratio changes the asset.
      dropped: adapted.dropped,
      coerced: adapted.coerced,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
