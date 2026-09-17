import { NextResponse } from "next/server";
import { currentUser } from "@/auth";
import { activeProvider } from "@/lib/active-provider";
import type { Capability } from "@/lib/providers";
import { submitToProvider } from "@/lib/generate";
import { fetchInputSchema, isModelAllowed, isModelInOpenCategory } from "@/lib/model-catalog";
import { adaptInput } from "@/lib/model-input";
import { isModelSlotId, slotCapability, type ModelSlotId } from "@/lib/models";
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
    const { model, slot, input, category } = (await req.json()) as {
      model?: string;
      slot?: string;
      input?: unknown;
      /** Freeform only: which of the four open categories this is. */
      category?: string;
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
    /*
     * Who serves this, which is a per-capability question: images and video are
     * chosen separately. Resolved here rather than in the client so the
     * allowlist, the schema and the submit all agree about who is being talked
     * to on this one request.
     */
    /*
     * Freeform says which category it is submitting, because a model id alone
     * does not: `bytedance/seedance-2.5` is a video model and
     * `openai/gpt-image-2.5-flare` an image one, and nothing about the strings
     * says so. The guided steps do not need telling — their slot already knows.
     */
    const need: Capability = freeform
      ? (typeof category === "string" && category.endsWith("-video") ? "video" : "image")
      : slotCapability(slot as ModelSlotId);
    const provider0 = await activeProvider(need);

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

    /*
     * OpenAI is the one provider with no published input schema to adapt
     * against, so it maps the payload itself — see toOpenAIRequest. Running it
     * through adaptInput with a schema invented here would be guessing with
     * extra steps, and would drop fields the real API accepts.
     */
    const adapted =
      provider === "openai"
        ? { input: input as Record<string, unknown>, dropped: [], coerced: [] }
        : adaptInput(input as Record<string, unknown>, await fetchInputSchema(model, provider));

    const { requestId, data } = await submitToProvider(provider, model, adapted.input);

    return NextResponse.json({
      requestId,
      // Present only when the provider answered with the picture rather than a
      // ticket. The client skips polling when it is there.
      ...(data !== undefined ? { data } : {}),
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
